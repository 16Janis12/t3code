import {
  CommandId,
  DEFAULT_MODEL,
  DEFAULT_PROVIDER_INTERACTION_MODE,
  ProjectId,
  ProviderInstanceId,
  type OrchestrationCommand,
  type OrchestrationProjectShell,
  type OrchestrationShellSnapshot,
  type T3ProjectFile,
} from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";

import { ProcessRunner, type ProcessRunInput, type ProcessRunOutput } from "../processRunner.ts";
import { T3ProjectFileLoader } from "../project/T3ProjectFileLoader.ts";
import { GitHubCli } from "../sourceControl/GitHubCli.ts";
import * as AutomationReactor from "./AutomationReactor.ts";
import * as OrchestrationEngine from "./Services/OrchestrationEngine.ts";
import * as ProjectionSnapshotQuery from "./Services/ProjectionSnapshotQuery.ts";

const PROJECT_ID = ProjectId.make("proj-1");
const WORKSPACE_ROOT = "/workspaces/my-project";

const project: OrchestrationProjectShell = {
  id: PROJECT_ID,
  title: "My Project",
  workspaceRoot: WORKSPACE_ROOT,
  defaultModelSelection: null,
  defaultThreadEnvMode: null,
  createdAt: "2026-09-08T00:00:00.000Z",
  updatedAt: "2026-09-08T00:00:00.000Z",
  deletedAt: null,
};

interface HarnessOptions {
  readonly project?: OrchestrationProjectShell;
  readonly projectFile?: T3ProjectFile;
  readonly ghPrOutput?: string;
  readonly ghIssueOutput?: string;
}

const makeHarness = Effect.fn("makeHarness")(function* (options: HarnessOptions = {}) {
  const dispatchedCommands = yield* Ref.make<ReadonlyArray<OrchestrationCommand>>([]);
  const executedScripts = yield* Ref.make<ReadonlyArray<ProcessRunInput>>([]);
  const ghCommands = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);

  let uuidCounter = 0;
  const cryptoLayer = Layer.succeed(
    Crypto.Crypto,
    Crypto.make({
      randomUUIDv4: Effect.sync(() => `uuid-${++uuidCounter}`),
      randomBytes: (size) => new Uint8Array(size),
      digest: (_algorithm, data) => Effect.succeed(data),
    }),
  );

  const engineLayer = Layer.succeed(OrchestrationEngine.OrchestrationEngineService, {
    dispatch: (command) =>
      Ref.update(dispatchedCommands, (cmds) => [...cmds, command]).pipe(Effect.as({ sequence: 1 })),
    streamDomainEvents: Stream.empty,
    subscribeDomainEvents: Effect.succeed(Stream.empty),
    latestSequence: Effect.succeed(1),
    replayAggregates: () => Effect.succeed({ eventCount: 0, payloadBytes: 0 }),
  } as unknown as OrchestrationEngine.OrchestrationEngineShape);

  const snapshotQueryLayer = Layer.succeed(ProjectionSnapshotQuery.ProjectionSnapshotQuery, {
    getShellSnapshot: () =>
      Effect.succeed({
        projects: [options.project ?? project],
        threads: [],
        projectSequence: 1,
        threadSequence: 1,
        snapshotSequence: 1,
      } as OrchestrationShellSnapshot),
  } as unknown as ProjectionSnapshotQuery.ProjectionSnapshotQueryShape);

  const projectFileLoaderLayer = Layer.succeed(T3ProjectFileLoader, {
    load: () =>
      Effect.succeed(options.projectFile ? Option.some(options.projectFile) : Option.none()),
  } as unknown as T3ProjectFileLoader["Service"]);

  const githubCliLayer = Layer.succeed(GitHubCli, {
    execute: (input) =>
      Ref.update(ghCommands, (cmds) => [...cmds, input.args]).pipe(
        Effect.flatMap(() => {
          const isPr = input.args.includes("pr");
          const stdout = isPr ? (options.ghPrOutput ?? "[]") : (options.ghIssueOutput ?? "[]");
          return Effect.succeed({
            stdout,
            stderr: "",
            exitCode: 0,
          });
        }),
      ),
  } as unknown as GitHubCli["Service"]);

  const processRunnerLayer = Layer.succeed(ProcessRunner, {
    run: (input) =>
      Ref.update(executedScripts, (scripts) => [...scripts, input]).pipe(
        Effect.as({
          stdout: "",
          stderr: "",
          code: 0,
          timedOut: false,
          stdoutTruncated: false,
          stderrTruncated: false,
          stdoutInvalidUtf8: false,
          stderrInvalidUtf8: false,
        } as ProcessRunOutput),
      ),
  } as unknown as ProcessRunner["Service"]);

  const dependencies = Layer.mergeAll(
    cryptoLayer,
    engineLayer,
    snapshotQueryLayer,
    projectFileLoaderLayer,
    githubCliLayer,
    processRunnerLayer,
  );

  const reactorLayer = AutomationReactor.layer.pipe(Layer.provide(dependencies));

  return {
    reactorLayer,
    dispatchedCommands,
    executedScripts,
    ghCommands,
  };
});

describe("AutomationReactor", () => {
  it.effect("executes thread actions for matching cron schedules", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fixture = yield* makeHarness({
          projectFile: {
            automations: [
              {
                id: "daily-sync",
                name: "Daily Sync",
                trigger: {
                  type: "cron",
                  schedule: "30 9 * * *",
                },
                action: {
                  type: "thread",
                  prompt: "Run daily sync for ${project.title}",
                  title: "Daily Sync - ${project.title}",
                },
              },
            ],
          },
        });

        const reactor = yield* AutomationReactor.AutomationReactor.pipe(
          Effect.provide(fixture.reactorLayer),
        );

        // Date matching 09:30 UTC
        const matchingDate = new Date("2026-09-08T09:30:00.000Z");
        yield* reactor.pollOnce({ now: matchingDate });

        const commands = yield* Ref.get(fixture.dispatchedCommands);
        expect(commands).toHaveLength(2);

        const createCmd = commands[0]!;
        expect(createCmd.type).toBe("thread.create");
        if (createCmd.type === "thread.create") {
          expect(createCmd.title).toBe("Daily Sync - My Project");
          expect(createCmd.projectId).toBe(PROJECT_ID);
          expect(createCmd.modelSelection).toEqual({
            instanceId: ProviderInstanceId.make("codex"),
            model: DEFAULT_MODEL,
          });
          expect(createCmd.interactionMode).toBe(DEFAULT_PROVIDER_INTERACTION_MODE);
          expect(createCmd.runtimeMode).toBe("full-access");
        }

        const turnCmd = commands[1]!;
        expect(turnCmd.type).toBe("thread.turn.start");
        if (turnCmd.type === "thread.turn.start") {
          expect(turnCmd.message.text).toBe("Run daily sync for My Project");
        }

        // Second poll in same minute should not duplicate
        yield* reactor.pollOnce({ now: matchingDate });
        const commandsAfterSecondPoll = yield* Ref.get(fixture.dispatchedCommands);
        expect(commandsAfterSecondPoll).toHaveLength(2);
      }),
    ),
  );

  it.effect("uses project.defaultModelSelection when action has no modelSelection", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const customModelSelection = {
          instanceId: ProviderInstanceId.make("claude"),
          model: "claude-3-7-sonnet",
        };
        const fixture = yield* makeHarness({
          project: {
            ...project,
            defaultModelSelection: customModelSelection,
          },
          projectFile: {
            automations: [
              {
                id: "daily-sync",
                name: "Daily Sync",
                trigger: {
                  type: "cron",
                  schedule: "30 9 * * *",
                },
                action: {
                  type: "thread",
                  prompt: "Run daily sync",
                },
              },
            ],
          },
        });

        const reactor = yield* AutomationReactor.AutomationReactor.pipe(
          Effect.provide(fixture.reactorLayer),
        );

        yield* reactor.pollOnce({ now: new Date("2026-09-08T09:30:00.000Z") });

        const commands = yield* Ref.get(fixture.dispatchedCommands);
        expect(commands).toHaveLength(2);

        const createCmd = commands[0]!;
        expect(createCmd.type).toBe("thread.create");
        if (createCmd.type === "thread.create") {
          expect(createCmd.modelSelection).toEqual(customModelSelection);
          expect(createCmd.interactionMode).toBe(DEFAULT_PROVIDER_INTERACTION_MODE);
        }
      }),
    ),
  );

  it.effect("uses action.modelSelection and runtimeMode when explicitly specified", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const actionModelSelection = {
          instanceId: ProviderInstanceId.make("custom-instance"),
          model: "gpt-4o",
        };
        const fixture = yield* makeHarness({
          project: {
            ...project,
            defaultModelSelection: {
              instanceId: ProviderInstanceId.make("claude"),
              model: "claude-3-7-sonnet",
            },
          },
          projectFile: {
            automations: [
              {
                id: "custom-automation",
                name: "Custom",
                trigger: {
                  type: "cron",
                  schedule: "* * * * *",
                },
                action: {
                  type: "thread",
                  prompt: "Run custom",
                  modelSelection: actionModelSelection,
                  runtimeMode: "read-only",
                },
              },
            ],
          },
        });

        const reactor = yield* AutomationReactor.AutomationReactor.pipe(
          Effect.provide(fixture.reactorLayer),
        );

        yield* reactor.pollOnce({ now: new Date("2026-09-08T09:30:00.000Z") });

        const commands = yield* Ref.get(fixture.dispatchedCommands);
        expect(commands).toHaveLength(2);

        const createCmd = commands[0]!;
        expect(createCmd.type).toBe("thread.create");
        if (createCmd.type === "thread.create") {
          expect(createCmd.modelSelection).toEqual(actionModelSelection);
          expect(createCmd.runtimeMode).toBe("read-only");
          expect(createCmd.interactionMode).toBe(DEFAULT_PROVIDER_INTERACTION_MODE);
        }
      }),
    ),
  );

  it.effect("executes script actions for matching cron schedules", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fixture = yield* makeHarness({
          projectFile: {
            automations: [
              {
                id: "run-tests",
                name: "Nightly Run",
                trigger: {
                  type: "cron",
                  schedule: "@hourly",
                },
                action: {
                  type: "script",
                  command: "npm test -- --project ${project.id}",
                },
              },
            ],
          },
        });

        const reactor = yield* AutomationReactor.AutomationReactor.pipe(
          Effect.provide(fixture.reactorLayer),
        );

        const matchingDate = new Date("2026-09-08T10:00:00.000Z");
        yield* reactor.pollOnce({ now: matchingDate });

        const scripts = yield* Ref.get(fixture.executedScripts);
        expect(scripts).toHaveLength(1);
        expect(scripts[0]?.command).toBe("sh");
        expect(scripts[0]?.args).toEqual(["-c", "npm test -- --project proj-1"]);
        expect(scripts[0]?.cwd).toBe(WORKSPACE_ROOT);
      }),
    ),
  );

  it.effect("detects newly opened GitHub pull requests after baseline", () =>
    Effect.scoped(
      Effect.gen(function* () {
        let prList = JSON.stringify([
          {
            number: 10,
            title: "Initial PR",
            state: "OPEN",
            updatedAt: "2026-09-08T08:00:00Z",
            headRefName: "init",
            baseRefName: "main",
          },
        ]);

        const fixture = yield* makeHarness({
          projectFile: {
            automations: [
              {
                id: "pr-reviewer",
                name: "PR Reviewer",
                trigger: {
                  type: "github_pr",
                  events: ["opened"],
                  targetBranches: ["main"],
                },
                action: {
                  type: "thread",
                  prompt: "Review PR #${pr.number}: ${pr.title}",
                  title: "Review PR #${pr.number}",
                },
              },
            ],
          },
          get ghPrOutput() {
            return prList;
          },
        });

        const reactor = yield* AutomationReactor.AutomationReactor.pipe(
          Effect.provide(fixture.reactorLayer),
        );

        // 1. First poll initializes baseline (does not trigger existing PR #10)
        yield* reactor.pollOnce();
        expect(yield* Ref.get(fixture.dispatchedCommands)).toHaveLength(0);

        // 2. A new PR #11 is opened
        prList = JSON.stringify([
          {
            number: 10,
            title: "Initial PR",
            state: "OPEN",
            updatedAt: "2026-09-08T08:00:00Z",
            headRefName: "init",
            baseRefName: "main",
          },
          {
            number: 11,
            title: "Add awesome feature",
            state: "OPEN",
            updatedAt: "2026-09-08T09:00:00Z",
            headRefName: "feature",
            baseRefName: "main",
          },
        ]);

        yield* reactor.pollOnce();
        const commands = yield* Ref.get(fixture.dispatchedCommands);
        expect(commands).toHaveLength(2);

        const createCmd = commands[0]!;
        if (createCmd.type === "thread.create") {
          expect(createCmd.title).toBe("Review PR #11");
        }

        const turnCmd = commands[1]!;
        if (turnCmd.type === "thread.turn.start") {
          expect(turnCmd.message.text).toBe("Review PR #11: Add awesome feature");
        }
      }),
    ),
  );

  it.effect("detects GitHub issues and respects label filters", () =>
    Effect.scoped(
      Effect.gen(function* () {
        let issueList = JSON.stringify([]);

        const fixture = yield* makeHarness({
          projectFile: {
            automations: [
              {
                id: "bug-triage",
                name: "Bug Triage",
                trigger: {
                  type: "github_issue",
                  events: ["opened"],
                  labels: ["bug"],
                },
                action: {
                  type: "thread",
                  prompt: "Triage issue #${issue.number}: ${issue.title}",
                },
              },
            ],
          },
          get ghIssueOutput() {
            return issueList;
          },
        });

        const reactor = yield* AutomationReactor.AutomationReactor.pipe(
          Effect.provide(fixture.reactorLayer),
        );

        // First poll initializes baseline
        yield* reactor.pollOnce();
        expect(yield* Ref.get(fixture.dispatchedCommands)).toHaveLength(0);

        // New issue without "bug" label -> should NOT trigger
        issueList = JSON.stringify([
          {
            number: 101,
            title: "Docs update",
            state: "OPEN",
            updatedAt: "2026-09-08T09:00:00Z",
            labels: [{ name: "documentation" }],
          },
        ]);
        yield* reactor.pollOnce();
        expect(yield* Ref.get(fixture.dispatchedCommands)).toHaveLength(0);

        // New issue WITH "bug" label -> should trigger!
        issueList = JSON.stringify([
          {
            number: 101,
            title: "Docs update",
            state: "OPEN",
            updatedAt: "2026-09-08T09:00:00Z",
            labels: [{ name: "documentation" }],
          },
          {
            number: 102,
            title: "Server crash on boot",
            state: "OPEN",
            updatedAt: "2026-09-08T09:05:00Z",
            labels: [{ name: "bug" }],
          },
        ]);
        yield* reactor.pollOnce();
        const commands = yield* Ref.get(fixture.dispatchedCommands);
        expect(commands).toHaveLength(2);
        const turnCmd = commands[1]!;
        if (turnCmd.type === "thread.turn.start") {
          expect(turnCmd.message.text).toBe("Triage issue #102: Server crash on boot");
        }
      }),
    ),
  );
});
