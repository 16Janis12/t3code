import { CheckIcon, DownloadIcon, Loader2Icon, SparklesIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import { ScrollArea } from "~/components/ui/scroll-area";
import { fetchSkillContent, formatSkillTitle, type SkillItem } from "./skillsRegistry";

interface SkillPreviewDialogProps {
  readonly skill: SkillItem | null;
  readonly isOpen: boolean;
  readonly isInstalled: boolean;
  readonly isInstalling: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onInstall: (skill: SkillItem) => void;
}

export function SkillPreviewDialog({
  skill,
  isOpen,
  isInstalled,
  isInstalling,
  onOpenChange,
  onInstall,
}: SkillPreviewDialogProps) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!skill || !isOpen) {
      setContent("");
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    fetchSkillContent(skill)
      .then((text) => {
        if (active) {
          setContent(text);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load skill content");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [skill, isOpen]);

  if (!skill) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-2xl sm:max-w-3xl">
        <DialogHeader className="border-b border-border/40 pb-4">
          <div className="flex flex-wrap items-center gap-2 pr-6">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <SparklesIcon className="size-4 text-primary" />
              {skill.displayName || formatSkillTitle(skill.name)}
            </DialogTitle>
            <Badge variant="outline" className="text-xs uppercase tracking-wider">
              {skill.source === "antigravity"
                ? "Antigravity Vault"
                : skill.source === "skillsllm"
                  ? "SkillsLLM"
                  : "Custom"}
            </Badge>
            <Badge variant="secondary" className="text-xs capitalize">
              {skill.category}
            </Badge>
            {isInstalled ? (
              <Badge variant="success" className="gap-1 text-xs">
                <CheckIcon className="size-3" />
                Installed
              </Badge>
            ) : null}
          </div>
          <DialogDescription className="mt-1 text-xs text-muted-foreground">
            Target location:{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
              .agents/skills/{skill.id}/SKILL.md
            </code>
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 pt-4">
          {/* Metadata quick row */}
          {skill.triggers && skill.triggers.length > 0 ? (
            <div className="mb-4 rounded-md border border-border/40 bg-muted/30 p-3 text-xs">
              <span className="font-medium text-foreground">Triggers / Activations:</span>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {skill.triggers.slice(0, 10).map((t, idx) => (
                  <span
                    key={idx}
                    className="rounded bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground border border-border/40"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Content Viewer */}
          <div className="rounded-lg border border-border/60 bg-muted/20">
            <div className="border-b border-border/40 px-3 py-2 text-xs font-mono text-muted-foreground flex justify-between items-center">
              <span>SKILL.md</span>
              <span className="text-[11px]">
                {content.length > 0 ? `${content.length} bytes` : ""}
              </span>
            </div>
            <ScrollArea className="h-[380px] p-4 text-sm font-mono leading-relaxed">
              {loading ? (
                <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Loader2Icon className="size-5 animate-spin" />
                  <span className="text-xs">Loading skill documentation...</span>
                </div>
              ) : error ? (
                <div className="rounded bg-destructive/10 p-4 text-xs text-destructive">
                  {error}
                </div>
              ) : (
                <pre className="whitespace-pre-wrap break-words font-mono text-xs text-foreground/90 selection:bg-primary/20">
                  {content}
                </pre>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-3 sm:justify-between">
          <div className="text-xs text-muted-foreground hidden sm:block">
            {skill.repoUrl ? (
              <a
                href={skill.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4 hover:text-foreground"
              >
                View Repository
              </a>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              size="sm"
              disabled={isInstalling || loading}
              onClick={() => onInstall(skill)}
              className="gap-1.5"
            >
              {isInstalling ? (
                <>
                  <Loader2Icon className="size-3.5 animate-spin" />
                  Installing...
                </>
              ) : isInstalled ? (
                <>
                  <CheckIcon className="size-3.5" />
                  Reinstall / Update
                </>
              ) : (
                <>
                  <DownloadIcon className="size-3.5" />
                  Install Skill
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
