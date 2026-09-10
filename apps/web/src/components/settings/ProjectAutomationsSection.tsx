import {
  resolveJob,
  T3_PROJECT_FILE_NAME,
  type EnvironmentId,
  type ModelSelection,
  type ProviderInstanceId,
  type T3ProjectFile,
  type T3ProjectFileAutomation,
} from "@t3tools/contracts";
import {
  BotIcon,
  ClockIcon,
  GitPullRequestIcon,
  CircleDotIcon,
  PencilIcon,
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
import { projectEnvironment } from "~/state/projects";
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
  readonly workspaceRoot: string;
  readonly t3File: T3ProjectFileState;
  readonly disabled?: boolean;
  readonly instanceEntries?: ReadonlyArray<ProviderInstanceEntry>;
  readonly modelOptionsByInstance?: ReadonlyMap<ProviderInstanceId, ReadonlyArray<ModelEsque>>;
  readonly defaultModelSelection?: ModelSelection | null;
  readonly onOpenProviderSetup?: (instanceId: ProviderInstanceId) => void;
}

export function ProjectAutomationsSection({
  environmentId,
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
