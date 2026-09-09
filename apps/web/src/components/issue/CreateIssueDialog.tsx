import { PlusIcon } from "lucide-react";
import { memo, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";

export interface CreateIssueDialogProps {
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (input: {
    readonly title: string;
    readonly body: string;
    readonly labels?: ReadonlyArray<string>;
  }) => Promise<void>;
  readonly isCreating: boolean;
}

export const CreateIssueDialog = memo(function CreateIssueDialog({
  isOpen,
  onOpenChange,
  onSubmit,
  isCreating,
}: CreateIssueDialogProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [labelsText, setLabelsText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isCreating) return;

    setError(null);
    try {
      const labels = labelsText
        .split(",")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      await onSubmit({
        title: title.trim(),
        body: body.trim(),
        ...(labels.length > 0 ? { labels } : {}),
      });

      setTitle("");
      setBody("");
      setLabelsText("");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create issue");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlusIcon className="h-4 w-4" />
              <span>Create New Issue</span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 p-6 pt-2">
            {error && (
              <div className="rounded-md bg-destructive/15 p-2.5 text-xs text-destructive">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="issue-title" className="text-xs font-medium">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="issue-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Issue title"
                required
                className="text-xs"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="issue-body" className="text-xs font-medium">
                Description (Markdown)
              </Label>
              <Textarea
                id="issue-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Describe the problem, task, or proposed feature..."
                rows={5}
                className="text-xs resize-y"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="issue-labels" className="text-xs font-medium">
                Labels (comma-separated, optional)
              </Label>
              <Input
                id="issue-labels"
                value={labelsText}
                onChange={(e) => setLabelsText(e.target.value)}
                placeholder="bug, enhancement, documentation"
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="p-4 pt-0">
            <DialogClose render={<Button type="button" variant="outline" size="sm" />}>
              Cancel
            </DialogClose>
            <Button
              type="submit"
              size="sm"
              disabled={!title.trim() || isCreating}
              className="gap-1.5"
            >
              {isCreating ? <Spinner className="h-3.5 w-3.5" /> : null}
              <span>Create Issue</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
});
