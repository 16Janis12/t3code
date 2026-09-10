import { type T3ProjectFileJob } from "@t3tools/contracts";
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
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface ProjectJobEditorDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly job: T3ProjectFileJob | null;
  readonly existingIds: ReadonlyArray<string>;
  readonly onSave: (job: T3ProjectFileJob) => void;
}

export function ProjectJobEditorDialog({
  open,
  onOpenChange,
  job,
  existingIds,
  onSave,
}: ProjectJobEditorDialogProps) {
  const isEditing = job !== null;

  const [name, setName] = useState(() => (job ? job.name : ""));
  const [id, setId] = useState(() => (job ? job.id : ""));
  const [idManuallyEdited, setIdManuallyEdited] = useState(() => Boolean(job));
  const [description, setDescription] = useState(() => (job ? (job.description ?? "") : ""));
  const [rolePrompt, setRolePrompt] = useState(() => (job ? job.rolePrompt : ""));
  const [promptTemplate, setPromptTemplate] = useState(() =>
    job ? (job.promptTemplate ?? "") : "",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    if (job) {
      setName(job.name);
      setId(job.id);
      setIdManuallyEdited(true);
      setDescription(job.description ?? "");
      setRolePrompt(job.rolePrompt);
      setPromptTemplate(job.promptTemplate ?? "");
    } else {
      setName("");
      setId("");
      setIdManuallyEdited(false);
      setDescription("");
      setRolePrompt("");
      setPromptTemplate("");
    }
    setErrorMessage(null);
  }, [open, job]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!idManuallyEdited && !isEditing) {
      setId(slugify(val));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedId = id.trim() || slugify(trimmedName);
    const trimmedRolePrompt = rolePrompt.trim();

    if (!trimmedName) {
      setErrorMessage("Please enter a job name.");
      return;
    }
    if (!trimmedId) {
      setErrorMessage("Please enter a valid unique ID.");
      return;
    }
    if ((!isEditing || trimmedId !== job.id) && existingIds.includes(trimmedId)) {
      setErrorMessage(`A job with ID "${trimmedId}" already exists.`);
      return;
    }
    if (!trimmedRolePrompt) {
      setErrorMessage("Please specify the role instructions (rolePrompt) for the agent.");
      return;
    }

    const payload: T3ProjectFileJob = {
      id: trimmedId,
      name: trimmedName,
      rolePrompt: trimmedRolePrompt,
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(promptTemplate.trim() ? { promptTemplate: promptTemplate.trim() } : {}),
    };

    onSave(payload);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Agent Job" : "Add Agent Job"}</DialogTitle>
          <DialogDescription>
            Agent jobs define specialized agent personas and instructions stored in{" "}
            <code className="font-mono text-xs">t3.json</code>.
          </DialogDescription>
        </DialogHeader>

        <DialogPanel>
          <form id="job-editor-form" onSubmit={handleSubmit} className="space-y-4">
            {errorMessage && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2.5 text-xs text-destructive">
                {errorMessage}
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="job-name" className="text-xs">
                  Job Name
                </Label>
                <Input
                  id="job-name"
                  placeholder="e.g. Security Auditor, Performance Specialist"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="job-id" className="text-xs">
                  ID (slug)
                </Label>
                <Input
                  id="job-id"
                  placeholder="e.g. security-auditor, perf-specialist"
                  value={id}
                  onChange={(e) => {
                    setId(e.target.value);
                    setIdManuallyEdited(true);
                  }}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="job-description" className="text-xs">
                  Description (optional)
                </Label>
                <Input
                  id="job-description"
                  placeholder="Brief description of when and why to use this job"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="job-role-prompt" className="text-xs">
                  Role Instructions / Persona (rolePrompt)
                </Label>
                <Textarea
                  id="job-role-prompt"
                  rows={4}
                  placeholder="You are an expert security auditor. When inspecting code, identify vulnerabilities..."
                  value={rolePrompt}
                  onChange={(e) => setRolePrompt(e.target.value)}
                  className="font-mono text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  Injected into the agent thread to shape its persona and operating standards.
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="job-prompt-template" className="text-xs">
                  Default Task / Prompt Template (optional)
                </Label>
                <Textarea
                  id="job-prompt-template"
                  rows={2}
                  placeholder="Audit ${project.title} for security vulnerabilities."
                  value={promptTemplate}
                  onChange={(e) => setPromptTemplate(e.target.value)}
                  className="font-mono text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  Default prompt prefilled when creating an automation using this job.
                </p>
              </div>
            </div>
          </form>
        </DialogPanel>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
          <Button form="job-editor-form" type="submit">
            {isEditing ? "Save Changes" : "Create Job"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
