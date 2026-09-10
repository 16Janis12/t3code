/**
 * AutomationReactor - Background reactor that triggers automations defined in `t3.json`.
 *
 * Supports:
 * - Recurring cron schedules (evaluated every minute)
 * - GitHub pull request events (polled via `gh` CLI)
 * - GitHub issue events (polled via `gh` CLI)
 *
 * Actions:
 * - Spawn an agent thread with an interpolated prompt template
 * - Run a project script or shell command at the project workspace root
 */
import {
  CommandId,
  DEFAULT_MODEL,
  DEFAULT_PROVIDER_INTERACTION_MODE,
  DEFAULT_RUNTIME_MODE,
  MessageId,
  ProviderInstanceId,
  ThreadId,
  type AutomationGitHubIssueEvent,
  type AutomationGitHubIssueTrigger,
  type AutomationGitHubPrEvent,
  type AutomationGitHubPrTrigger,
  type ModelSelection,
  type OrchestrationProjectShell,
  type T3ProjectFile,
  type T3ProjectFileAutomation,
} from "@t3tools/contracts";
import { makeDrainableWorker } from "@t3tools/shared/DrainableWorker";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schedule from "effect/Schedule";
import type * as Scope from "effect/Scope";

import { ProcessRunner } from "../processRunner.ts";
import { T3ProjectFileLoader } from "../project/T3ProjectFileLoader.ts";
import { forkParked } from "../serverActivation.ts";
import { GitHubCli } from "../sourceControl/GitHubCli.ts";
import { matchesCron } from "./AutomationCron.ts";
import { renderTemplate } from "./AutomationTemplate.ts";
import * as OrchestrationEngine from "./Services/OrchestrationEngine.ts";
import * as ProjectionSnapshotQuery from "./Services/ProjectionSnapshotQuery.ts";

export class AutomationReactor extends Context.Service<
  AutomationReactor,
  {
    readonly start: () => Effect.Effect<void, never, Scope.Scope>;
    readonly drain: Effect.Effect<void>;
    readonly pollOnce: (options?: { readonly now?: Date } | undefined) => Effect.Effect<void>;
  }
>()("t3/orchestration/AutomationReactor") {}

interface PrStateSnapshot {
  readonly state: string;
  readonly updatedAt: string;
  readonly baseRefName: string;
  readonly headRefName: string;
}

interface IssueStateSnapshot {
  readonly state: string;
  readonly updatedAt: string;
  readonly labels: ReadonlyArray<string>;
}

export const make = Effect.gen(function* () {
  const engine = yield* OrchestrationEngine.OrchestrationEngineService;
  const snapshotQuery = yield* ProjectionSnapshotQuery.ProjectionSnapshotQuery;
  const projectFileLoader = yield* T3ProjectFileLoader;
  const githubCli = yield* GitHubCli;
  const processRunner = yield* ProcessRunner;
  const crypto = yield* Crypto.Crypto;

  // In-memory state tracking to detect changes and avoid re-triggering
  const seenCronRuns = new Set<string>();
  const prBaselines = new Map<string, Map<number, PrStateSnapshot>>();
  const issueBaselines = new Map<string, Map<number, IssueStateSnapshot>>();

  const executeAction = Effect.fn("AutomationReactor.executeAction")(function* (
    automation: T3ProjectFileAutomation,
    project: OrchestrationProjectShell,
    projectFile: T3ProjectFile,
    context: Record<string, unknown>,
  ) {
    const action = automation.action;

    if (action.type === "thread") {
      const renderedTitle = renderTemplate(
        action.title ?? `[Automation] ${automation.name}`,
        context,
      );
      const renderedPrompt = renderTemplate(action.prompt, context);
      const threadUuid = yield* crypto.randomUUIDv4;
      const cmd1Uuid = yield* crypto.randomUUIDv4;
      const cmd2Uuid = yield* crypto.randomUUIDv4;
      const msgUuid = yield* crypto.randomUUIDv4;

      const threadId = ThreadId.make(threadUuid);
      const createCommandId = CommandId.make(`automation:${automation.id}:create:${cmd1Uuid}`);
      const turnCommandId = CommandId.make(`automation:${automation.id}:turn:${cmd2Uuid}`);
      const messageId = MessageId.make(msgUuid);
      const nowIso = new Date().toISOString();

      const modelSelection: ModelSelection = action.modelSelection ??
        project.defaultModelSelection ?? {
          instanceId: ProviderInstanceId.make("codex"),
          model: DEFAULT_MODEL,
        };

      yield* engine.dispatch({
        type: "thread.create",
        commandId: createCommandId,
        threadId,
        projectId: project.id,
        title: renderedTitle,
        modelSelection,
        runtimeMode: action.runtimeMode ?? DEFAULT_RUNTIME_MODE,
        interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
        branch: null,
        worktreePath: null,
        createdAt: nowIso,
      });

      yield* engine.dispatch({
        type: "thread.turn.start",
        commandId: turnCommandId,
        threadId,
        message: {
          messageId,
          role: "user",
          text: renderedPrompt,
          attachments: [],
        },
        runtimeMode: action.runtimeMode ?? DEFAULT_RUNTIME_MODE,
        interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
        createdAt: nowIso,
      });

      yield* Effect.logInfo("Automation spawned thread", {
        automationId: automation.id,
        projectId: project.id,
        threadId,
      });
    } else if (action.type === "script") {
      let commandStr = action.command;
      if (!commandStr && action.scriptName) {
        const found = projectFile.scripts?.find((s) => s.name === action.scriptName);
        commandStr = found?.command;
      }

      if (commandStr) {
        const renderedCommand = renderTemplate(commandStr, context);
        yield* processRunner.run({
          command: "sh",
          args: ["-c", renderedCommand],
          cwd: project.workspaceRoot,
        });

        yield* Effect.logInfo("Automation executed script", {
          automationId: automation.id,
          projectId: project.id,
          command: renderedCommand,
        });
      }
    }
  });

  const pollProject = Effect.fn("AutomationReactor.pollProject")(function* (
    project: OrchestrationProjectShell,
    now: Date,
  ) {
    const projectFileOpt = yield* projectFileLoader.load(project.workspaceRoot);
    if (Option.isNone(projectFileOpt)) return;

    const projectFile = projectFileOpt.value;
    const automations = projectFile.automations?.filter((a) => a.enabled !== false) ?? [];
    if (automations.length === 0) return;

    const cronAutomations = automations.filter((a) => a.trigger.type === "cron");
    const prAutomations = automations.filter((a) => a.trigger.type === "github_pr");
    const issueAutomations = automations.filter((a) => a.trigger.type === "github_issue");

    // 1. Evaluate Cron Automations
    for (const automation of cronAutomations) {
      if (automation.trigger.type !== "cron") continue;
      if (matchesCron(automation.trigger.schedule, now)) {
        const minuteKey = `${project.id}:${automation.id}:${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}-${now.getUTCHours()}:${now.getUTCMinutes()}`;
        if (!seenCronRuns.has(minuteKey)) {
          seenCronRuns.add(minuteKey);
          if (seenCronRuns.size > 2000) {
            seenCronRuns.clear();
            seenCronRuns.add(minuteKey);
          }

          const context = {
            event: { type: "cron" },
            automation: {
              id: automation.id,
              name: automation.name,
              schedule: automation.trigger.schedule,
            },
            project: {
              id: project.id,
              title: project.title,
              workspaceRoot: project.workspaceRoot,
            },
            date: now.toISOString(),
            now: now.toISOString(),
          };

          yield* executeAction(automation, project, projectFile, context).pipe(
            Effect.catch((err) =>
              Effect.logWarning("Automation cron action failed", {
                automationId: automation.id,
                cause: String(err),
              }),
            ),
          );
        }
      }
    }

    // 2. Evaluate GitHub Pull Request Automations
    if (prAutomations.length > 0) {
      const ghPrEffect = githubCli
        .execute({
          cwd: project.workspaceRoot,
          args: [
            "pr",
            "list",
            "--state",
            "all",
            "--limit",
            "30",
            "--json",
            "number,title,state,updatedAt,url,headRefName,baseRefName,isDraft",
          ],
        })
        .pipe(
          Effect.flatMap((output) =>
            Effect.try({
              try: () => JSON.parse(output.stdout) as ReadonlyArray<Record<string, unknown>>,
              catch: (e) => new Error(`Failed to parse gh pr list: ${e}`),
            }),
          ),
        );

      const prsResult = yield* Effect.option(ghPrEffect);
      if (Option.isSome(prsResult)) {
        const prs = prsResult.value;
        let projectPrMap = prBaselines.get(project.id);

        if (!projectPrMap) {
          // Initialize baseline on first run without triggering old events
          projectPrMap = new Map();
          for (const raw of prs) {
            const num = Number(raw.number);
            projectPrMap.set(num, {
              state: String(raw.state ?? ""),
              updatedAt: String(raw.updatedAt ?? ""),
              baseRefName: String(raw.baseRefName ?? ""),
              headRefName: String(raw.headRefName ?? ""),
            });
          }
          prBaselines.set(project.id, projectPrMap);
        } else {
          for (const raw of prs) {
            const num = Number(raw.number);
            const currentState = String(raw.state ?? "").toUpperCase();
            const currentUpdatedAt = String(raw.updatedAt ?? "");
            const currentBaseRef = String(raw.baseRefName ?? "");
            const currentHeadRef = String(raw.headRefName ?? "");

            const prev = projectPrMap.get(num);
            let eventType: AutomationGitHubPrEvent | null = null;

            if (!prev) {
              eventType = "opened";
            } else if (prev.updatedAt !== currentUpdatedAt) {
              const prevState = prev.state.toUpperCase();
              if (prevState === "OPEN" && currentState === "CLOSED") {
                eventType = "closed";
              } else if (prevState === "OPEN" && currentState === "MERGED") {
                eventType = "merged";
              } else if (prevState !== "OPEN" && currentState === "OPEN") {
                eventType = "reopened";
              } else if (currentState === "OPEN") {
                eventType = "synchronize";
              }
            }

            projectPrMap.set(num, {
              state: currentState,
              updatedAt: currentUpdatedAt,
              baseRefName: currentBaseRef,
              headRefName: currentHeadRef,
            });

            if (eventType) {
              for (const automation of prAutomations) {
                const trigger = automation.trigger as AutomationGitHubPrTrigger;
                const allowedEvents = trigger.events ?? ["opened", "synchronize"];
                if (!allowedEvents.includes(eventType)) continue;

                if (trigger.targetBranches && trigger.targetBranches.length > 0) {
                  if (!trigger.targetBranches.includes(currentBaseRef)) continue;
                }

                const context = {
                  event: { type: eventType },
                  pr: {
                    number: num,
                    title: String(raw.title ?? ""),
                    state: currentState,
                    url: String(raw.url ?? ""),
                    headRefName: currentHeadRef,
                    baseRefName: currentBaseRef,
                    isDraft: Boolean(raw.isDraft),
                  },
                  project: {
                    id: project.id,
                    title: project.title,
                    workspaceRoot: project.workspaceRoot,
                  },
                };

                yield* executeAction(automation, project, projectFile, context).pipe(
                  Effect.catch((err) =>
                    Effect.logWarning("Automation PR action failed", {
                      automationId: automation.id,
                      cause: String(err),
                    }),
                  ),
                );
              }
            }
          }
        }
      }
    }

    // 3. Evaluate GitHub Issue Automations
    if (issueAutomations.length > 0) {
      const ghIssueEffect = githubCli
        .execute({
          cwd: project.workspaceRoot,
          args: [
            "issue",
            "list",
            "--state",
            "all",
            "--limit",
            "30",
            "--json",
            "number,title,state,updatedAt,url,labels,assignees",
          ],
        })
        .pipe(
          Effect.flatMap((output) =>
            Effect.try({
              try: () => JSON.parse(output.stdout) as ReadonlyArray<Record<string, unknown>>,
              catch: (e) => new Error(`Failed to parse gh issue list: ${e}`),
            }),
          ),
        );

      const issuesResult = yield* Effect.option(ghIssueEffect);
      if (Option.isSome(issuesResult)) {
        const issues = issuesResult.value;
        let projectIssueMap = issueBaselines.get(project.id);

        if (!projectIssueMap) {
          projectIssueMap = new Map();
          for (const raw of issues) {
            const num = Number(raw.number);
            const labelsArray = Array.isArray(raw.labels)
              ? raw.labels.map((l) =>
                  typeof l === "object" && l !== null
                    ? String((l as Record<string, unknown>).name ?? "")
                    : String(l),
                )
              : [];
            projectIssueMap.set(num, {
              state: String(raw.state ?? "").toUpperCase(),
              updatedAt: String(raw.updatedAt ?? ""),
              labels: labelsArray,
            });
          }
          issueBaselines.set(project.id, projectIssueMap);
        } else {
          for (const raw of issues) {
            const num = Number(raw.number);
            const currentState = String(raw.state ?? "").toUpperCase();
            const currentUpdatedAt = String(raw.updatedAt ?? "");
            const labelsArray = Array.isArray(raw.labels)
              ? raw.labels.map((l) =>
                  typeof l === "object" && l !== null
                    ? String((l as Record<string, unknown>).name ?? "")
                    : String(l),
                )
              : [];

            const prev = projectIssueMap.get(num);
            let eventType: AutomationGitHubIssueEvent | null = null;

            if (!prev) {
              eventType = "opened";
            } else if (prev.updatedAt !== currentUpdatedAt) {
              const prevState = prev.state.toUpperCase();
              if (prevState === "OPEN" && currentState === "CLOSED") {
                eventType = "closed";
              } else if (prevState === "CLOSED" && currentState === "OPEN") {
                eventType = "reopened";
              } else if (labelsArray.some((l) => !prev.labels.includes(l))) {
                eventType = "labeled";
              } else {
                eventType = "opened";
              }
            }

            projectIssueMap.set(num, {
              state: currentState,
              updatedAt: currentUpdatedAt,
              labels: labelsArray,
            });

            if (eventType) {
              for (const automation of issueAutomations) {
                const trigger = automation.trigger as AutomationGitHubIssueTrigger;
                const allowedEvents = trigger.events ?? ["opened"];
                if (!allowedEvents.includes(eventType)) continue;

                if (trigger.labels && trigger.labels.length > 0) {
                  const hasLabel = trigger.labels.some((l) => labelsArray.includes(l));
                  if (!hasLabel) continue;
                }

                const context = {
                  event: { type: eventType },
                  issue: {
                    number: num,
                    title: String(raw.title ?? ""),
                    state: currentState,
                    url: String(raw.url ?? ""),
                    labels: labelsArray,
                  },
                  project: {
                    id: project.id,
                    title: project.title,
                    workspaceRoot: project.workspaceRoot,
                  },
                };

                yield* executeAction(automation, project, projectFile, context).pipe(
                  Effect.catch((err) =>
                    Effect.logWarning("Automation issue action failed", {
                      automationId: automation.id,
                      cause: String(err),
                    }),
                  ),
                );
              }
            }
          }
        }
      }
    }
  });

  const pollAllProjects = Effect.fn("AutomationReactor.pollAllProjects")(function* (
    customNow?: Date,
  ) {
    const now = customNow ?? new Date();
    const snapshot = yield* snapshotQuery.getShellSnapshot();
    for (const project of snapshot.projects) {
      yield* pollProject(project, now).pipe(
        Effect.catch((err) =>
          Effect.logWarning("Automation pollProject failed", {
            projectId: project.id,
            cause: String(err),
          }),
        ),
      );
    }
  });

  const worker = yield* makeDrainableWorker(() =>
    pollAllProjects().pipe(
      Effect.catchCause((cause) =>
        Cause.hasInterruptsOnly(cause)
          ? Effect.failCause(cause)
          : Effect.logWarning("Automation worker cycle failed", {
              cause: Cause.pretty(cause),
            }),
      ),
    ),
  );

  const start = Effect.fn("AutomationReactor.start")(function* () {
    yield* forkParked(
      Effect.gen(function* () {
        // Initial poll immediately
        yield* worker.enqueue(undefined);
        yield* worker.drain;

        // Periodic poll every 1 minute
        yield* Effect.gen(function* () {
          yield* worker.enqueue(undefined);
          yield* worker.drain;
        }).pipe(Effect.repeat(Schedule.spaced("1 minute")), Effect.delay("1 minute"));
      }).pipe(Effect.asVoid),
    );
  });

  return {
    start,
    drain: worker.drain,
    pollOnce: (options?: { readonly now?: Date } | undefined) =>
      pollAllProjects(options?.now).pipe(
        Effect.scoped,
        Effect.catchAll(() => Effect.void),
      ),
  } satisfies AutomationReactor["Service"];
});

export const layer = Layer.effect(AutomationReactor, make);
