import {
  BUILTIN_JOBS,
  T3_PROJECT_FILE_NAME,
  type EnvironmentId,
  type ModelSelection,
  type ProjectId,
  type T3ProjectFileJob,
} from "@t3tools/contracts";
import {
  BriefcaseIcon,
  BugIcon,
  Code2Icon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  SparklesIcon,
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
import { toastManager } from "~/components/ui/toast";
import { ProjectJobEditorDialog } from "./ProjectJobEditorDialog";
import { ProjectJobLaunchDialog } from "./ProjectJobLaunchDialog";
import { SettingsRow } from "./settingsLayout";

export interface ProjectJobsSectionProps {
  readonly environmentId: EnvironmentId;
  readonly projectId?: ProjectId | undefined;
  readonly workspaceRoot: string;
  readonly t3File: T3ProjectFileState;
  readonly disabled?: boolean | undefined;
  readonly defaultModelSelection?: ModelSelection | null | undefined;
}

function getJobIcon(id: string) {
  switch (id) {
    case "pr-reviewer":
      return <Code2Icon className="size-4 shrink-0 text-emerald-500/80" />;
    case "security-reviewer":
      return <ShieldCheckIcon className="size-4 shrink-0 text-amber-500/80" />;
    case "pentester":
      return <ShieldAlertIcon className="size-4 shrink-0 text-rose-500/80" />;
    case "feature-refiner":
      return <SparklesIcon className="size-4 shrink-0 text-purple-500/80" />;
    case "bug-triager":
      return <BugIcon className="size-4 shrink-0 text-sky-500/80" />;
    default:
      return <BriefcaseIcon className="size-4 shrink-0 text-indigo-500/80" />;
  }
}

export function ProjectJobsSection({
  environmentId,
  projectId,
  workspaceRoot,
  t3File,
  disabled = false,
  defaultModelSelection,
}: ProjectJobsSectionProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<T3ProjectFileJob | null>(null);
  const [launchingJob, setLaunchingJob] = useState<T3ProjectFileJob | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const writeProjectFile = useAtomCommand(projectEnvironment.writeFile, {
    reportFailure: false,
  });

  const customJobs = t3File.jobs;

  const persistJobs = async (nextJobs: ReadonlyArray<T3ProjectFileJob>) => {
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
      base.jobs = nextJobs;

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
          description: "Agent jobs saved to project configuration.",
        });
      } else {
        toastManager.add({
          type: "error",
          title: "Could not save jobs",
          description: "Failed to write to t3.json in project workspace.",
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveJob = async (savedJob: T3ProjectFileJob) => {
    let nextJobs: T3ProjectFileJob[];
    const exists = customJobs.some((j) => j.id === savedJob.id);
    if (exists) {
      nextJobs = customJobs.map((j) => (j.id === savedJob.id ? savedJob : j));
    } else {
      nextJobs = [...customJobs, savedJob];
    }
    await persistJobs(nextJobs);
  };

  const handleDelete = async (jobId: string) => {
    const nextJobs = customJobs.filter((j) => j.id !== jobId);
    await persistJobs(nextJobs);
  };

  const handleOpenAdd = () => {
    setEditingJob(null);
    setEditorOpen(true);
  };

  const handleOpenEdit = (job: T3ProjectFileJob) => {
    setEditingJob(job);
    setEditorOpen(true);
  };

  const existingIds = [...BUILTIN_JOBS.map((j) => j.id), ...customJobs.map((j) => j.id)];

  return (
    <>
      <div className="flex min-h-8 flex-col items-start gap-3 border-t border-border/60 px-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground">Agent Jobs</h3>
          <p className="text-pretty text-sm text-muted-foreground">
            Specialized agent roles (e.g. PR Reviewer, Pentester, Bug Triager) available for
            on-demand launch or automated background runs.
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
            Add custom job
          </Button>
        </div>
      </div>

      {/* Built-in Jobs Section */}
      <div className="px-3 py-1 sm:px-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Built-in Presets
        </p>
      </div>

      {BUILTIN_JOBS.map((job) => (
        <SettingsRow
          key={job.id}
          className="group py-2"
          title={
            <span className="flex min-w-0 items-center gap-2">
              {getJobIcon(job.id)}
              <span className="min-w-0 truncate font-medium">{job.name}</span>
              <span className="shrink-0 rounded-sm border border-border/60 bg-muted/40 px-1.5 py-px font-mono text-[11px] font-normal text-muted-foreground">
                {job.id}
              </span>
              <span className="shrink-0 rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-px text-[10px] font-medium text-emerald-400">
                Built-in
              </span>
            </span>
          }
          description={<p className="pt-0.5 text-xs text-muted-foreground">{job.description}</p>}
          control={
            <div className="flex items-center gap-2">
              <Button
                size="xs"
                variant="outline"
                className="shrink-0 gap-1 text-xs"
                onClick={() => setLaunchingJob(job)}
                aria-label={`Launch ${job.name}`}
              >
                <PlayIcon className="size-3 text-emerald-500" />
                Launch
              </Button>
            </div>
          }
        />
      ))}

      {/* Custom Project Jobs */}
      {customJobs.length > 0 && (
        <>
          <div className="mt-2 px-3 py-1 sm:px-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Project Jobs (t3.json)
            </p>
          </div>

          {customJobs.map((job) => (
            <SettingsRow
              key={job.id}
              className="group py-2"
              title={
                <span className="flex min-w-0 items-center gap-2">
                  {getJobIcon(job.id)}
                  <span className="min-w-0 truncate font-medium">{job.name}</span>
                  <span className="shrink-0 rounded-sm border border-border/60 bg-muted/40 px-1.5 py-px font-mono text-[11px] font-normal text-muted-foreground">
                    {job.id}
                  </span>
                  <span className="shrink-0 rounded-sm border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-px text-[10px] font-medium text-indigo-400">
                    Custom
                  </span>
                </span>
              }
              description={
                <div className="space-y-0.5 pt-0.5 text-xs text-muted-foreground">
                  {job.description && <p>{job.description}</p>}
                  <p className="line-clamp-1 font-mono text-[11px] text-muted-foreground/80">
                    Role: {job.rolePrompt}
                  </p>
                </div>
              }
              control={
                <div className="flex items-center gap-2">
                  <Button
                    size="xs"
                    variant="outline"
                    className="shrink-0 gap-1 text-xs"
                    onClick={() => setLaunchingJob(job)}
                    aria-label={`Launch ${job.name}`}
                  >
                    <PlayIcon className="size-3 text-emerald-500" />
                    Launch
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="shrink-0 text-muted-foreground opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
                    disabled={disabled || isSaving}
                    onClick={() => handleOpenEdit(job)}
                    aria-label={`Edit ${job.name}`}
                  >
                    <PencilIcon className="size-3.5" />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
                    disabled={disabled || isSaving}
                    onClick={() => handleDelete(job.id)}
                    aria-label={`Delete ${job.name}`}
                  >
                    <Trash2Icon className="size-3.5" />
                  </Button>
                </div>
              }
            />
          ))}
        </>
      )}

      <ProjectJobEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        job={editingJob}
        existingIds={existingIds}
        onSave={handleSaveJob}
      />

      <ProjectJobLaunchDialog
        open={launchingJob !== null}
        onOpenChange={(open) => {
          if (!open) setLaunchingJob(null);
        }}
        job={launchingJob}
        environmentId={environmentId}
        projectId={projectId}
        defaultModelSelection={defaultModelSelection}
      />
    </>
  );
}
