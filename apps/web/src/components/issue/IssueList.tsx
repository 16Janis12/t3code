import type { IssueListItem } from "@t3tools/contracts";
import { CheckCircle2Icon, CircleDotIcon, MessageSquareIcon } from "lucide-react";
import { type ComponentProps, memo } from "react";

import { ProjectFavicon } from "~/components/ProjectFavicon";
import { cn } from "~/lib/utils";

export function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSeconds < 60) return "just now";
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return dateString;
  }
}

export function IssueRowLabels({ labels }: { readonly labels: IssueListItem["labels"] }) {
  if (labels.length === 0) return null;
  const maxVisible = 3;
  const visibleLabels = labels.slice(0, maxVisible);
  const remaining = labels.length - maxVisible;

  return (
    <span className="flex min-w-0 items-center gap-1">
      {visibleLabels.map((label) => (
        <span
          key={label.name}
          className="inline-flex max-w-40 min-w-0 items-center gap-1 rounded-full border border-border/70 bg-muted/40 py-0 pl-1 pr-1.5 text-[10px] leading-3.5 text-muted-foreground"
        >
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full bg-muted-foreground"
            style={label.color ? { backgroundColor: `#${label.color}` } : undefined}
          />
          <span className="truncate">{label.name}</span>
        </span>
      ))}
      {remaining > 0 ? (
        <span className="text-[10px] text-muted-foreground font-mono">+{remaining}</span>
      ) : null}
    </span>
  );
}

export interface IssueRowProps {
  readonly issue: IssueListItem;
  readonly selected: boolean;
  readonly project?: ComponentProps<typeof ProjectFavicon>["project"] | undefined;
  readonly onSelect: (issue: IssueListItem) => void;
}

export const IssueRow = memo(function IssueRow({
  issue,
  selected,
  project,
  onSelect,
}: IssueRowProps) {
  const isOpen = issue.state === "open";

  return (
    <button
      type="button"
      aria-current={selected ? "true" : undefined}
      onClick={() => onSelect(issue)}
      className={cn(
        "@container/issue-row grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "[contain-intrinsic-block-size:66px] [content-visibility:auto]",
        selected ? "bg-accent" : "hover:bg-accent/60",
      )}
    >
      <span className="shrink-0">
        {isOpen ? (
          <CircleDotIcon className="size-4 text-emerald-500" />
        ) : (
          <CheckCircle2Icon className="size-4 text-purple-500" />
        )}
      </span>

      <span className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
        <span className="col-start-1 row-start-1 block truncate text-sm font-medium text-foreground">
          {issue.title}
        </span>

        {issue.commentsCount > 0 ? (
          <span className="col-start-2 row-start-1 flex items-center justify-self-end gap-1 font-mono text-[11px] text-muted-foreground/70">
            <MessageSquareIcon className="size-3.5 opacity-70" />
            <span>{issue.commentsCount}</span>
          </span>
        ) : null}

        <div className="col-start-1 col-span-2 row-start-2 flex items-center gap-2 overflow-hidden text-xs text-muted-foreground/70 flex-wrap">
          <span className="font-mono font-medium text-foreground/80 shrink-0">#{issue.number}</span>
          {project ? (
            <span className="flex items-center gap-1 shrink-0">
              <ProjectFavicon project={project} className="size-3 shrink-0" />
              <span className="max-w-36 truncate">{project.title}</span>
            </span>
          ) : null}
          <span className="shrink-0">opened by {issue.author?.login ?? "ghost"}</span>
          <span className="shrink-0">•</span>
          <span className="shrink-0">{formatRelativeTime(issue.updatedAt)}</span>
          {issue.labels.length > 0 ? <IssueRowLabels labels={issue.labels} /> : null}
        </div>
      </span>
    </button>
  );
});

const TITLE_WIDTHS = ["w-3/5", "w-2/5", "w-1/2", "w-2/3", "w-2/5", "w-3/5", "w-1/2"];
const META_WIDTHS = ["w-2/5", "w-1/3", "w-2/5", "w-1/4", "w-1/3", "w-2/5", "w-1/3"];

export function IssueListGhost({
  rows = 7,
  caption,
}: {
  readonly rows?: number;
  readonly caption?: string;
}) {
  return (
    <div
      role="status"
      aria-label={caption ?? "Loading issues"}
      className="motion-safe:animate-skeleton space-y-0.5"
    >
      {caption ? (
        <p className="px-3 pb-1 text-xs font-medium text-muted-foreground/70">{caption}</p>
      ) : null}
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-lg px-3 py-3"
        >
          <div aria-hidden className="size-4 rounded-full bg-muted-foreground/15" />
          <div className="min-w-0 space-y-1.5">
            <div
              aria-hidden
              className={cn(
                "h-3.5 rounded bg-muted-foreground/15",
                TITLE_WIDTHS[index % TITLE_WIDTHS.length],
              )}
            />
            <div
              aria-hidden
              className={cn(
                "h-3 rounded bg-muted-foreground/15",
                META_WIDTHS[index % META_WIDTHS.length],
              )}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function IssueEmptyState({
  hasFilters,
  onResetFilters,
}: {
  readonly hasFilters: boolean;
  readonly onResetFilters?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center text-xs text-muted-foreground">
      <CircleDotIcon className="mb-3 size-10 stroke-[1.5] opacity-40 text-muted-foreground" />
      <p className="text-sm font-semibold text-foreground">No issues found</p>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">
        {hasFilters
          ? "No issues matched your search or filters. Try adjusting your query or resetting the filters."
          : "There are no issues in this repository."}
      </p>
      {hasFilters && onResetFilters ? (
        <button
          type="button"
          onClick={onResetFilters}
          className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
