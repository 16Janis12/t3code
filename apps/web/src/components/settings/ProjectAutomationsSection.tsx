import {
  formatJobTurnPrompt,
  resolveJob,
  T3_PROJECT_FILE_NAME,
  type EnvironmentId,
  type ModelSelection,
  type ProjectId,
  type ProviderInstanceId,
  type T3ProjectFile,
  type T3ProjectFileAutomation,
} from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import {
  BotIcon,
  ClockIcon,
  GitPullRequestIcon,
  CircleDotIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  TerminalIcon,
  Trash2Icon,
} from "lucide-react";
import React, { useState } from "react";

import {
  confirmProjectFileQueryData,
  setProjectFileQueryData,
} from "~/components/files/projectFilesQueryState";
import { type T3ProjectFileState } from "~/hooks/useT3ProjectFileScripts";
import { newMessageId, newThreadId } from "~/lib/utils";
import { projectEnvironment } from "~/state/projects";
import { threadEnvironment } from "~/state/threads";
import { useAtomCommand } from "~/state/use-atom-command";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { toastManager } from "~/components/ui/toast";
import type { ModelEsque } from "~/components/chat/providerIconUtils";
import type { ProviderInstanceEntry } from "~/providerInstances";
import { ProjectAutomationEditorDialog } from "./ProjectAutomationEditorDialog";
import { SettingsRow } from "./settingsLayout";

export interface ProjectAutomationsSectionProps {
  readonly environmentId: EnvironmentId;
  readonly projectId?: ProjectId | undefined;
  readonly workspaceRoot: string;
  readonly t3File: T3ProjectFileState;
  readonly disabled?: boolean | undefined;
  readonly instanceEntries?: ReadonlyArray<ProviderInstanceEntry> | undefined;
  readonly modelOptionsByInstance?:
    | ReadonlyMap<ProviderInstanceId, ReadonlyArray<ModelEsque>>
    | undefined;
  readonly defaultModelSelection?: ModelSelection | null | undefined;
  readonly onOpenProviderSetup?: ((instanceId: ProviderInstanceId) => void) | undefined;
}

export function ProjectAutomationsSection({
  environmentId,
  projectId,
  workspaceRoot,
  t3File,
  disabled = false,
  instanceEntries,
  modelOptionsByInstance,
  defaultModelSelection,
  onOpenProviderSetup,
}: ProjectAutomationsSectionProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<T3ProjectFileAutomation | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const writeProjectFile = useAtomCommand(projectEnvironment.writeFile, {
    reportFailure: false,
  });

  const navigate = useNavigate();
  const createThread = useAtomCommand(threadEnvironment.create, { reportFailure: false });
  const startThreadTurn = useAtomCommand(threadEnvironment.startTurn, { reportFailure: false });
  const [runningAutomationId, setRunningAutomationId] = useState<string | null>(null);

  const handleRunAutomation = async (automation: T3ProjectFileAutomation) => {
    if (automation.action.type === "thread") {
      if (!projectId) {
        toastManager.add({
          type: "error",
          title: "Cannot run automation",
          description: "Project information is not available.",
        });
        return;
      }

      setRunningAutomationId(automation.id);
      try {
        const job = resolveJob(automation.action.jobId, t3File.jobs);
        const threadId = newThreadId();
        const messageId = newMessageId();
        const nowIso = new Date().toISOString();

        const defaultTitle = job
          ? `[${job.name}] ${automation.name}`
          : `[Automation] ${automation.name}`;
        const threadTitle = automation.action.title ?? defaultTitle;

        const basePrompt =
          automation.action.prompt ??
          job?.promptTemplate ??
          `Execute automation: ${automation.name}`;
        const finalPrompt = job ? formatJobTurnPrompt(job, basePrompt) : basePrompt;
        const fallbackModelSelection: ModelSelection = defaultModelSelection ?? {
          instanceId: "default" as ProviderInstanceId,
          model: "default",
        };
        const createThreadModelSelection: ModelSelection =
          automation.action.modelSelection ?? job?.modelSelection ?? fallbackModelSelection;
        const turnModelSelection =
          automation.action.modelSelection ??
          job?.modelSelection ??
          defaultModelSelection ??
          undefined;
        const runtimeMode =
          automation.action.runtimeMode ?? job?.runtimeMode ?? "approval-required";

        const createResult = await createThread({
          environmentId,
          input: {
            threadId,
            projectId,
            title: threadTitle,
            modelSelection: createThreadModelSelection,
            runtimeMode,
            interactionMode: "default",
            branch: null,
            worktreePath: null,
            createdAt: nowIso,
          },
        });

        if (createResult._tag === "Failure") {
          toastManager.add({
            type: "error",
            title: "Failed to create thread",
            description: "Could not create thread for automation.",
          });
          return;
        }

        const turnResult = await startThreadTurn({
          environmentId,
          input: {
            threadId,
            message: {
              messageId,
              role: "user",
              text: finalPrompt,
              attachments: [],
            },
            modelSelection: turnModelSelection,
            titleSeed: threadTitle,
            runtimeMode,
            interactionMode: "default",
            createdAt: nowIso,
          },
        });

        if (turnResult._tag === "Failure") {
          toastManager.add({
            type: "error",
            title: "Failed to start thread turn",
            description: "Could not start thread turn.",
          });
          return;
        }

        toastManager.add({
          type: "success",
          title: `Automation "${automation.name}" triggered`,
          description: "New agent thread created.",
        });

        void navigate({
          to: "/$environmentId/$threadId",
          params: {
            environmentId,
            threadId,
          },
        });
      } catch (err) {
        toastManager.add({
          type: "error",
          title: "Failed to run automation",
          description: String(err),
        });
      } finally {
        setRunningAutomationId(null);
      }
    } else {
      toastManager.add({
        type: "info",
        title: `Script automation "${automation.name}"`,
        description: `Command: ${automation.action.command ?? automation.action.scriptName}`,
      });
    }
  };

  const automations = t3File.automations;

  const persistAutomations = async (nextAutomations: ReadonlyArray<T3ProjectFileAutomation>) => {
    setIsSaving(true);
    try {
      let base: Record<string, unknown> = {};
      if (t3File.rawContents) {
        try {
          base = JSON.parse(t3File.rawContents) as Record<string, unknown>;
        } catch {
          base = (t3File.file as unknown as Record<string, unknown>) ?? {};
        }
      } else if (t3File.file) {
        base = { ...(t3File.file as unknown as Record<string, unknown>) };
      } else {
        base = {
          $schema: "https://t3.codes/schema/t3.json",
        };
      }

      if (!base.$schema) {
        base.$schema = "https://t3.codes/schema/t3.json";
      }
      base.automations = nextAutomations;

      const newContents = JSON.stringify(base, null, 2) + "\n";
      setProjectFileQueryData(environmentId, workspaceRoot, T3_PROJECT_FILE_NAME, newContents);

      const result = await writeProjectFile({
        environmentId,
        input: {
          cwd: workspaceRoot,
          relativePath: T3_PROJECT_FILE_NAME,
          contents: newContents,
        },
      });

      if (result._tag === "Success") {
        confirmProjectFileQueryData(
          environmentId,
          workspaceRoot,
          T3_PROJECT_FILE_NAME,
          newContents,
        );
        toastManager.add({
          type: "success",
          title: "t3.json updated",
          description: "Automations saved to project configuration.",
        });
      } else {
        toastManager.add({
          type: "error",
          title: "Could not save automations",
          description: "Failed to write to t3.json in project workspace.",
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEnabled = (automationId: string, currentEnabled: boolean) => {
    const updated = automations.map((a) =>
      a.id === automationId ? { ...a, enabled: !currentEnabled } : a,
    );
    void persistAutomations(updated);
  };

  const handleDelete = (automationId: string) => {
    const updated = automations.filter((a) => a.id !== automationId);
    void persistAutomations(updated);
  };

  const handleSaveAutomation = (saved: T3ProjectFileAutomation) => {
    const index = automations.findIndex((a) => a.id === saved.id);
    let updated: T3ProjectFileAutomation[];
    if (index >= 0) {
      updated = [...automations];
      updated[index] = saved;
    } else {
      updated = [...automations, saved];
    }
    void persistAutomations(updated);
  };

  const handleOpenAdd = () => {
    setEditingAutomation(null);
    setEditorOpen(true);
  };

  const handleOpenEdit = (automation: T3ProjectFileAutomation) => {
    setEditingAutomation(automation);
    setEditorOpen(true);
  };

  return (
    <>
      <div className="flex min-h-8 flex-col items-start gap-3 border-t border-border/60 px-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground">Automations</h3>
          <p className="text-pretty text-sm text-muted-foreground">
            Automations defined in <code className="font-mono text-xs">t3.json</code> reacting to
            cron schedules or GitHub events.
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-1.5 sm:w-auto sm:shrink-0 sm:justify-end">
          <Button
            size="xs"
            variant="outline"
            disabled={disabled || isSaving}
            onClick={handleOpenAdd}
          >
            <PlusIcon className="size-3.5" />
            Add automation
          </Button>
        </div>
      </div>

      {t3File.status === "invalid" && (
        <SettingsRow
          title="t3.json is invalid"
          description="A t3.json exists in this checkout but fails to parse. Fix the JSON syntax to enable automations."
          className="text-warning"
        />
      )}

      {automations.length === 0 ? (
        <p className="px-3 py-2 text-base text-muted-foreground sm:px-4 sm:text-sm">
          No automations configured. Click &quot;Add automation&quot; to define triggers for cron
          schedules or GitHub pull requests and issues.
        </p>
      ) : (
        automations.map((automation) => {
          const isEnabled = automation.enabled ?? true;

          let triggerIcon = <ClockIcon className="size-4 shrink-0 text-muted-foreground" />;
          let triggerSummary = "";
          if (automation.trigger.type === "cron") {
            triggerIcon = <ClockIcon className="size-4 shrink-0 text-amber-500/80" />;
            triggerSummary = `cron: ${automation.trigger.schedule}`;
          } else if (automation.trigger.type === "github_pr") {
            triggerIcon = <GitPullRequestIcon className="size-4 shrink-0 text-emerald-500/80" />;
            const events = automation.trigger.events?.join(", ") ?? "opened, sync";
            triggerSummary = `pr: ${events}`;
          } else if (automation.trigger.type === "github_issue") {
            triggerIcon = <CircleDotIcon className="size-4 shrink-0 text-sky-500/80" />;
            const events = automation.trigger.events?.join(", ") ?? "opened";
            triggerSummary = `issue: ${events}`;
          } else if (automation.trigger.type === "manual") {
            triggerIcon = <PlayIcon className="size-4 shrink-0 text-violet-500/80" />;
            triggerSummary = "manual";
          }

          let actionSummary = "";
          let actionIcon = <BotIcon className="size-3.5 shrink-0" />;
          if (automation.action.type === "thread") {
            actionIcon = <BotIcon className="size-3.5 shrink-0 text-indigo-400" />;
            actionSummary = automation.action.title
              ? `Thread: ${automation.action.title}`
              : `Thread prompt: ${automation.action.prompt}`;
          } else {
            actionIcon = <TerminalIcon className="size-3.5 shrink-0 text-emerald-400" />;
            actionSummary = `Run: ${automation.action.command ?? automation.action.scriptName}`;
          }

          return (
            <SettingsRow
              key={automation.id}
              className={`group py-2 ${!isEnabled ? "opacity-60" : ""}`}
              title={
                <span className="flex min-w-0 items-center gap-2">
                  {triggerIcon}
                  <span className="min-w-0 truncate font-medium">{automation.name}</span>
                  <span className="shrink-0 rounded-sm border border-border/60 bg-muted/40 px-1.5 py-px font-mono text-[11px] font-normal text-muted-foreground">
                    {triggerSummary}
                  </span>
                  {automation.action.type === "thread" && automation.action.jobId ? (
                    <span className="shrink-0 rounded-sm border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-px text-[11px] font-medium text-indigo-400">
                      {resolveJob(automation.action.jobId, t3File.jobs)?.name ??
                        automation.action.jobId}
                    </span>
                  ) : null}
                  {automation.action.type === "thread" && automation.action.modelSelection ? (
                    <span className="shrink-0 rounded-sm border border-border/60 bg-muted/40 px-1.5 py-px font-mono text-[11px] font-normal text-muted-foreground">
                      {automation.action.modelSelection.instanceId}:{" "}
                      {automation.action.modelSelection.model}
                    </span>
                  ) : null}
                </span>
              }
              description={
                <div className="flex items-center gap-1.5 pt-0.5 text-xs text-muted-foreground">
                  {actionIcon}
                  <span className="truncate font-mono">{actionSummary}</span>
                </div>
              }
              control={
                <div className="flex items-center gap-2">
                  <Button
                    size="xs"
                    variant="outline"
                    className="shrink-0 gap-1 text-xs"
                    disabled={disabled || isSaving || runningAutomationId === automation.id}
                    onClick={() => void handleRunAutomation(automation)}
                    aria-label={`Run ${automation.name}`}
                  >
                    <PlayIcon className="size-3 text-emerald-500" />
                    {runningAutomationId === automation.id ? "Running..." : "Run"}
                  </Button>
                  <Switch
                    checked={isEnabled}
                    disabled={disabled || isSaving}
                    onCheckedChange={() => handleToggleEnabled(automation.id, isEnabled)}
                    aria-label={`Toggle ${automation.name}`}
                  />
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="shrink-0 text-muted-foreground opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
                    disabled={disabled || isSaving}
                    onClick={() => handleOpenEdit(automation)}
                    aria-label={`Edit ${automation.name}`}
                  >
                    <PencilIcon className="size-3.5" />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
                    disabled={disabled || isSaving}
                    onClick={() => handleDelete(automation.id)}
                    aria-label={`Delete ${automation.name}`}
                  >
                    <Trash2Icon className="size-3.5" />
                  </Button>
                </div>
              }
            />
          );
        })
      )}

      <ProjectAutomationEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        automation={editingAutomation}
        existingIds={automations.map((a) => a.id)}
        onSave={handleSaveAutomation}
        instanceEntries={instanceEntries}
        modelOptionsByInstance={modelOptionsByInstance}
        defaultModelSelection={defaultModelSelection}
        onOpenProviderSetup={onOpenProviderSetup}
        projectJobs={t3File.jobs}
      />
    </>
  );
}
