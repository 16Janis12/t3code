import {
  formatJobTurnPrompt,
  type EnvironmentId,
  type ModelSelection,
  type ProjectId,
  type ProviderInstanceId,
  type T3ProjectFileJob,
} from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import { PlayIcon } from "lucide-react";
import React, { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { toastManager } from "~/components/ui/toast";
import { newMessageId, newThreadId } from "~/lib/utils";
import { threadEnvironment } from "~/state/threads";
import { useAtomCommand } from "~/state/use-atom-command";

export interface ProjectJobLaunchDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly job: T3ProjectFileJob | null;
  readonly environmentId: EnvironmentId;
  readonly projectId?: ProjectId | undefined;
  readonly defaultModelSelection?: ModelSelection | null | undefined;
}

export function ProjectJobLaunchDialog({
  open,
  onOpenChange,
  job,
  environmentId,
  projectId,
  defaultModelSelection,
}: ProjectJobLaunchDialogProps) {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState(() => job?.promptTemplate ?? "");
  const [isLaunching, setIsLaunching] = useState(false);

  const createThread = useAtomCommand(threadEnvironment.create, { reportFailure: false });
  const startThreadTurn = useAtomCommand(threadEnvironment.startTurn, { reportFailure: false });

  useEffect(() => {
    if (job) {
      setPrompt(job.promptTemplate ?? "");
    } else {
      setPrompt("");
    }
  }, [job]);

  if (!job) return null;

  const handleLaunch = async () => {
    if (!projectId) {
      toastManager.add({
        type: "error",
        title: "Cannot launch job",
        description: "Project information is not available.",
      });
      return;
    }

    setIsLaunching(true);
    try {
      const threadId = newThreadId();
      const messageId = newMessageId();
      const nowIso = new Date().toISOString();

      const userPrompt = prompt.trim() || `Run ${job.name} analysis`;
      const threadTitle = `[${job.name}] ${userPrompt.split("\n")[0]?.slice(0, 50) || job.name}`;
      const finalTurnPrompt = formatJobTurnPrompt(job, userPrompt);
      const fallbackModelSelection: ModelSelection = defaultModelSelection ?? {
        instanceId: "default" as ProviderInstanceId,
        model: "default",
      };
      const createThreadModelSelection: ModelSelection =
        job.modelSelection ?? fallbackModelSelection;
      const turnModelSelection = job.modelSelection ?? defaultModelSelection ?? undefined;
      const runtimeMode = job.runtimeMode ?? "approval-required";

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
          description: "Could not create thread for job.",
        });
        setIsLaunching(false);
        return;
      }

      const turnResult = await startThreadTurn({
        environmentId,
        input: {
          threadId,
          message: {
            messageId,
            role: "user",
            text: finalTurnPrompt,
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
        setIsLaunching(false);
        return;
      }

      toastManager.add({
        type: "success",
        title: `Job ${job.name} launched`,
        description: "New agent thread created.",
      });

      onOpenChange(false);

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
        title: "Failed to launch job",
        description: String(err),
      });
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlayIcon className="size-4 text-emerald-500" />
            Launch Agent Job: {job.name}
          </DialogTitle>
          <DialogDescription>
            {job.description ??
              "Start a new agent thread equipped with this job's persona and instructions."}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <div className="space-y-4">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
              <span className="font-semibold text-foreground">Role Persona:</span>
              <p className="mt-1 line-clamp-3 font-mono text-muted-foreground">{job.rolePrompt}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="job-launch-prompt" className="text-xs">
                Task / Instructions for Agent
              </Label>
              <Textarea
                id="job-launch-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={5}
                placeholder="Enter specific instructions, PR details, target files, or goals for the job..."
                className="font-mono text-xs"
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    void handleLaunch();
                  }
                }}
              />
              <p className="text-[11px] text-muted-foreground">
                Press Cmd+Enter or click Launch Thread to start.
              </p>
            </div>
          </div>
        </DialogPanel>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button onClick={handleLaunch} disabled={isLaunching}>
            <PlayIcon className="size-3.5 mr-1" />
            {isLaunching ? "Launching..." : "Launch Thread"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
