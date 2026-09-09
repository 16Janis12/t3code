import type { IssueDetail, IssueState } from "@t3tools/contracts";
import {
  CheckCircle2Icon,
  CircleDotIcon,
  CornerDownLeftIcon,
  ExternalLinkIcon,
  MessageSquareIcon,
  RotateCcwIcon,
  SparklesIcon,
  XCircleIcon,
} from "lucide-react";
import { memo, useState } from "react";

import ChatMarkdown from "~/components/ChatMarkdown";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";

export interface IssueDetailPanelProps {
  readonly issue: IssueDetail | null;
  readonly isLoading: boolean;
  readonly onWorkOnIssue: (issue: IssueDetail) => void;
  readonly onToggleState: (issue: IssueDetail, newState: IssueState) => Promise<void>;
  readonly onAddComment: (issue: IssueDetail, comment: string) => Promise<void>;
  readonly isUpdatingState: boolean;
  readonly isAddingComment: boolean;
}

function formatRelativeTime(dateString: string): string {
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
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

export const IssueDetailPanel = memo(function IssueDetailPanel({
  issue,
  isLoading,
  onWorkOnIssue,
  onToggleState,
  onAddComment,
  isUpdatingState,
  isAddingComment,
}: IssueDetailPanelProps) {
  const [commentText, setCommentText] = useState("");

  if (isLoading && !issue) {
    return (
      <div className="flex h-full items-center justify-center bg-background/50">
        <Spinner className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center bg-background/50 text-muted-foreground">
        <CircleDotIcon className="mb-3 h-10 w-10 stroke-[1.5] opacity-30" />
        <h3 className="font-semibold text-foreground text-sm">No issue selected</h3>
        <p className="mt-1 text-xs max-w-sm text-muted-foreground">
          Select an issue from the list on the left to view details, join the discussion, or start a
          coding thread.
        </p>
      </div>
    );
  }

  const isOpen = issue.state === "open";

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || isAddingComment) return;
    await onAddComment(issue, commentText);
    setCommentText("");
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Top Header Toolbar */}
      <div className="flex flex-col gap-3 border-b border-border p-4 bg-sidebar/10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                  isOpen
                    ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                    : "bg-purple-500/15 text-purple-400 border border-purple-500/30",
                )}
              >
                {isOpen ? (
                  <CircleDotIcon className="h-3.5 w-3.5" />
                ) : (
                  <CheckCircle2Icon className="h-3.5 w-3.5" />
                )}
                <span className="capitalize">{issue.state}</span>
              </span>
              <span className="font-mono text-sm font-semibold text-muted-foreground">
                #{issue.number}
              </span>
            </div>
            <h1 className="text-lg font-semibold text-foreground leading-snug break-words">
              {issue.title}
            </h1>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="default"
              className="gap-1.5 font-medium"
              onClick={() => onWorkOnIssue(issue)}
            >
              <SparklesIcon className="h-3.5 w-3.5" />
              <span>Work on Issue</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              disabled={isUpdatingState}
              onClick={() => onToggleState(issue, isOpen ? "closed" : "open")}
            >
              {isUpdatingState ? (
                <Spinner className="h-3.5 w-3.5" />
              ) : isOpen ? (
                <>
                  <XCircleIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Close</span>
                </>
              ) : (
                <>
                  <RotateCcwIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Reopen</span>
                </>
              )}
            </Button>

            <a
              href={issue.url}
              target="_blank"
              rel="noreferrer"
              title="View on GitHub"
              aria-label="View on GitHub"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ExternalLinkIcon className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Metadata sub-row */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <span className="font-medium text-foreground">{issue.author?.login ?? "ghost"}</span>
          <span>opened this issue {formatRelativeTime(issue.createdAt)}</span>
          {issue.comments.length > 0 ? (
            <>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MessageSquareIcon className="h-3 w-3 opacity-70" />
                {issue.comments.length} comment{issue.comments.length === 1 ? "" : "s"}
              </span>
            </>
          ) : null}
        </div>

        {/* Labels & Assignees */}
        {(issue.labels.length > 0 || issue.assignees.length > 0) && (
          <div className="flex items-center gap-3 pt-1 flex-wrap text-xs">
            {issue.labels.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {issue.labels.map((label) => (
                  <span
                    key={label.name}
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border border-border/80 bg-muted/60 text-muted-foreground"
                    style={
                      label.color
                        ? {
                            borderColor: `#${label.color}44`,
                            backgroundColor: `#${label.color}15`,
                            color: `#${label.color}`,
                          }
                        : undefined
                    }
                  >
                    {label.name}
                  </span>
                ))}
              </div>
            )}
            {issue.assignees.length > 0 && (
              <div className="flex items-center gap-1 text-muted-foreground text-xs">
                <span>Assignees:</span>
                <span className="font-medium text-foreground">
                  {issue.assignees.map((a) => a.login).join(", ")}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content scroll area */}
      <ScrollArea className="flex-1 p-4">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Issue description box */}
          <div className="rounded-lg border border-border bg-card p-4 shadow-2xs">
            <div className="mb-2 flex items-center justify-between border-b border-border/60 pb-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{issue.author?.login ?? "ghost"}</span>
              <span>{formatRelativeTime(issue.createdAt)}</span>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none break-words text-foreground">
              {issue.body ? (
                <ChatMarkdown cwd="" text={issue.body} />
              ) : (
                <p className="italic text-muted-foreground text-xs">No description provided.</p>
              )}
            </div>
          </div>

          {/* Comments list */}
          {issue.comments.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Discussion ({issue.comments.length})
              </h3>
              {issue.comments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-lg border border-border/80 bg-card p-4 shadow-2xs"
                >
                  <div className="mb-2 flex items-center justify-between border-b border-border/60 pb-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {comment.author?.login ?? "ghost"}
                    </span>
                    <span>{formatRelativeTime(comment.createdAt)}</span>
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none break-words text-foreground">
                    <ChatMarkdown cwd="" text={comment.body} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add comment box */}
          <div className="rounded-lg border border-border bg-card p-4 shadow-2xs">
            <h4 className="mb-2 text-xs font-semibold text-foreground">Leave a comment</h4>
            <form onSubmit={handleCommentSubmit} className="space-y-3">
              <Textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Type your comment here (Markdown supported)..."
                rows={3}
                className="text-xs resize-y bg-background"
              />
              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={!commentText.trim() || isAddingComment}
                  className="gap-1.5 text-xs font-medium"
                >
                  {isAddingComment ? (
                    <Spinner className="h-3.5 w-3.5" />
                  ) : (
                    <>
                      <CornerDownLeftIcon className="h-3.5 w-3.5" />
                      <span>Comment</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
});
