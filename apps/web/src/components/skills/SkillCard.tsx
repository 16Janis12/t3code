import {
  CheckIcon,
  DownloadIcon,
  ExternalLinkIcon,
  EyeIcon,
  FileCodeIcon,
  Loader2Icon,
  SparklesIcon,
} from "lucide-react";
import { memo } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { formatSkillTitle, type SkillItem } from "./skillsRegistry";

interface SkillCardProps {
  readonly skill: SkillItem;
  readonly isInstalled: boolean;
  readonly isInstalling: boolean;
  readonly onInstall: (skill: SkillItem) => void;
  readonly onPreview: (skill: SkillItem) => void;
  readonly onOpenInEditor?: (skill: SkillItem) => void;
  readonly onSelectTag?: (tag: string) => void;
}

export const SkillCard = memo(function SkillCard({
  skill,
  isInstalled,
  isInstalling,
  onInstall,
  onPreview,
  onOpenInEditor,
  onSelectTag,
}: SkillCardProps) {
  const sourceLabel =
    skill.source === "antigravity"
      ? "Vault"
      : skill.source === "skillsllm"
        ? "SkillsLLM"
        : "Custom";

  const sourceVariant =
    skill.source === "skillsllm"
      ? "info"
      : skill.source === "antigravity"
        ? "secondary"
        : "outline";

  return (
    <div className="group relative flex flex-col justify-between rounded-xl border border-border/60 bg-card/60 p-5 shadow-xs backdrop-blur-xs transition-all duration-200 hover:border-border hover:bg-card/90 hover:shadow-md">
      {/* Top badges & status */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={sourceVariant} className="text-[11px] font-medium">
              {sourceLabel}
            </Badge>
            <Badge variant="outline" className="text-[11px] capitalize text-muted-foreground">
              {skill.category}
            </Badge>
          </div>
          {isInstalled ? (
            <Badge variant="success" className="gap-1 text-[11px] font-medium">
              <CheckIcon className="size-3" />
              Installed
            </Badge>
          ) : null}
        </div>

        {/* Skill Title & Technical ID */}
        <div className="mt-3">
          <h3 className="text-base font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
            <SparklesIcon className="size-4 shrink-0 text-primary/70" />
            <span>{skill.displayName || formatSkillTitle(skill.name)}</span>
          </h3>
          <div className="mt-0.5 flex items-center gap-2">
            <code className="font-mono text-[11px] text-muted-foreground">{skill.id}</code>
            {skill.author ? (
              <span className="text-[11px] text-muted-foreground/80">by {skill.author}</span>
            ) : null}
          </div>
        </div>

        {/* Description */}
        <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground line-clamp-3">
          {skill.description}
        </p>

        {/* Tags */}
        {skill.tags && skill.tags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1">
            {skill.tags.slice(0, 4).map((tag) => (
              <button
                type="button"
                key={tag}
                onClick={() => onSelectTag?.(tag)}
                className="rounded bg-muted/70 px-1.5 py-0.5 text-[10px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                #{tag}
              </button>
            ))}
            {skill.tags.length > 4 ? (
              <span className="text-[10px] text-muted-foreground/70 self-center">
                +{skill.tags.length - 4}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Action Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3.5 gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => onPreview(skill)}
            className="gap-1 text-xs text-muted-foreground hover:text-foreground"
            title="Inspect skill markdown definition"
          >
            <EyeIcon className="size-3.5" />
            Preview
          </Button>

          {isInstalled && onOpenInEditor ? (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onOpenInEditor(skill)}
              className="gap-1 text-xs text-muted-foreground hover:text-foreground"
              title="Open SKILL.md in editor"
            >
              <FileCodeIcon className="size-3.5" />
              Editor
            </Button>
          ) : null}
        </div>

        <Button
          size="xs"
          variant={isInstalled ? "outline" : "default"}
          disabled={isInstalling}
          onClick={() => onInstall(skill)}
          className={cn(
            "gap-1.5 text-xs font-medium",
            isInstalled && "border-success/40 text-success hover:bg-success/10",
          )}
        >
          {isInstalling ? (
            <>
              <Loader2Icon className="size-3 animate-spin" />
              Installing
            </>
          ) : isInstalled ? (
            <>
              <CheckIcon className="size-3" />
              Update
            </>
          ) : (
            <>
              <DownloadIcon className="size-3" />
              Install
            </>
          )}
        </Button>
      </div>
    </div>
  );
});
