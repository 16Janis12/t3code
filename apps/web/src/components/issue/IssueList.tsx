import type { IssueListItem, IssueListState } from "@t3tools/contracts";
import {
  CheckCircle2Icon,
  CircleDotIcon,
  MessageSquareIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { memo } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Spinner } from "~/components/ui/spinner";
import { cn } from "~/lib/utils";

export interface IssueListProps {
  readonly issues: ReadonlyArray<IssueListItem>;
  readonly selectedNumber: number | null;
  readonly onSelectIssue: (issue: IssueListItem) => void;
  readonly stateFilter: IssueListState;
  readonly onStateFilterChange: (state: IssueListState) => void;
  readonly searchQuery: string;
  readonly onSearchChange: (query: string) => void;
  readonly isLoading: boolean;
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
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return dateString;
  }
}

export const IssueList = memo(function IssueList({
  issues,
  selectedNumber,
  onSelectIssue,
  stateFilter,
  onStateFilterChange,
  searchQuery,
  onSearchChange,
  isLoading,
}: IssueListProps) {
  const filteredIssues = issues.filter((issue) => {
    if (stateFilter !== "all" && issue.state !== stateFilter) return false;
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      const matchNumber = String(issue.number).includes(q);
      const matchTitle = issue.title.toLowerCase().includes(q);
      const matchAuthor = issue.author?.login.toLowerCase().includes(q) ?? false;
      const matchLabel = issue.labels.some((l) => l.name.toLowerCase().includes(q));
      return matchNumber || matchTitle || matchAuthor || matchLabel;
    }
    return true;
  });

  return (
    <div className="flex h-full flex-col border-r border-border bg-sidebar/30">
      {/* Controls: Search and State Filters */}
      <div className="flex flex-col gap-2.5 border-b border-border p-3">
        <div className="relative flex items-center">
          <SearchIcon className="absolute left-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search issues..."
            className="h-8 pl-8 pr-7 text-xs bg-background/60"
          />
          {searchQuery ? (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-1 rounded-md bg-muted/60 p-0.5 text-xs">
          <button
            onClick={() => onStateFilterChange("open")}
            className={cn(
              "flex-1 rounded py-1 px-2 text-center font-medium transition-colors",
              stateFilter === "open"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Open
          </button>
          <button
            onClick={() => onStateFilterChange("closed")}
            className={cn(
              "flex-1 rounded py-1 px-2 text-center font-medium transition-colors",
              stateFilter === "closed"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Closed
          </button>
          <button
            onClick={() => onStateFilterChange("all")}
            className={cn(
              "flex-1 rounded py-1 px-2 text-center font-medium transition-colors",
              stateFilter === "all"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            All
          </button>
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        {isLoading && issues.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <Spinner className="h-5 w-5 text-muted-foreground" />
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground">
            <CircleDotIcon className="mb-2 h-8 w-8 stroke-[1.5] opacity-40" />
            <p className="font-medium text-foreground">No issues found</p>
            <p className="mt-1 text-muted-foreground">
              {searchQuery
                ? "Try adjusting your search query or state filter"
                : `No ${stateFilter === "all" ? "" : stateFilter} issues in this repository`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filteredIssues.map((issue) => {
              const isSelected = issue.number === selectedNumber;
              const isOpen = issue.state === "open";

              return (
                <button
                  key={issue.id}
                  onClick={() => onSelectIssue(issue)}
                  className={cn(
                    "w-full text-left p-3 transition-colors hover:bg-muted/50 flex flex-col gap-1.5 focus-visible:outline-none focus-visible:bg-muted/70",
                    isSelected && "bg-muted/80 hover:bg-muted",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0">
                      {isOpen ? (
                        <CircleDotIcon className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <CheckCircle2Icon className="h-4 w-4 text-purple-500" />
                      )}
                    </span>
                    <span className="font-medium text-sm leading-snug line-clamp-2 text-foreground">
                      {issue.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pl-6 text-xs text-muted-foreground flex-wrap">
                    <span className="font-mono text-muted-foreground/80 font-semibold">
                      #{issue.number}
                    </span>
                    <span>•</span>
                    <span>{issue.author?.login ?? "ghost"}</span>
                    <span>•</span>
                    <span>{formatRelativeTime(issue.updatedAt)}</span>
                    {issue.commentsCount > 0 ? (
                      <span className="ml-auto flex items-center gap-1 font-mono text-[11px]">
                        <MessageSquareIcon className="h-3 w-3 opacity-70" />
                        {issue.commentsCount}
                      </span>
                    ) : null}
                  </div>

                  {issue.labels.length > 0 ? (
                    <div className="flex flex-wrap gap-1 pl-6 pt-0.5">
                      {issue.labels.map((label) => (
                        <span
                          key={label.name}
                          className="inline-flex items-center rounded-full px-1.5 py-0.2 text-[10px] font-medium border border-border/80 bg-muted/60 text-muted-foreground"
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
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
});
