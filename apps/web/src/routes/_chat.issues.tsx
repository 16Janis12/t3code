import type {
  EnvironmentId,
  IssueDetail,
  IssueListItem,
  IssueListState,
  IssueState,
  ProjectId,
} from "@t3tools/contracts";
import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  CircleDotIcon,
  LayersIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useComposerDraftStore } from "~/composerDraftStore";
import { CreateIssueDialog } from "~/components/issue/CreateIssueDialog";
import { IssueDetailPanel } from "~/components/issue/IssueDetailPanel";
import { IssueEmptyState, IssueListGhost, IssueRow } from "~/components/issue/IssueList";
import { PreviewPanelShell } from "~/components/preview/PreviewPanelShell";
import { ProjectFavicon } from "~/components/ProjectFavicon";
import { Button } from "~/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "~/components/ui/input-group";
import {
  Menu,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRadioItemIndicator,
  MenuTrigger,
} from "~/components/ui/menu";
import { SidebarInset } from "~/components/ui/sidebar";
import { Spinner } from "~/components/ui/spinner";
import {
  WorkspaceBreadcrumb,
  WorkspaceBreadcrumbItem,
  WorkspaceBreadcrumbSeparator,
} from "~/components/WorkspaceBreadcrumb";
import { WorkspacePageContainer } from "~/components/WorkspacePageContainer";
import { WorkspacePageHeader } from "~/components/WorkspacePageHeader";
import { isElectron } from "~/env";
import { useActiveProjectTarget } from "~/hooks/useActiveProjectTarget";
import { useHandleNewThread, useNewThreadHandler } from "~/hooks/useHandleNewThread";
import { useClientSettings } from "~/hooks/useSettings";
import { cn } from "~/lib/utils";
import { selectProjectGroupingSettings } from "~/logicalProject";
import { resolveProjectFromScopeKey } from "~/sidebarProjectGrouping";
import { useProjects } from "~/state/entities";
import { useEnvironments, usePrimaryEnvironmentId } from "~/state/environments";
import { issueEnvironment } from "~/state/issues";
import { useEnvironmentQuery } from "~/state/query";
import { useAtomCommand } from "~/state/use-atom-command";
import { useUiStateStore } from "~/uiStateStore";

export interface IssuesSearch {
  readonly state?: IssueListState | undefined;
  readonly number?: number | undefined;
  readonly search?: string | undefined;
  readonly projectId?: ProjectId | undefined;
  readonly environmentId?: EnvironmentId | undefined;
}

export const Route = createFileRoute("/_chat/issues")({
  validateSearch: (raw: Record<string, unknown>): IssuesSearch => ({
    state:
      raw.state === "closed" || raw.state === "all" || raw.state === "open" ? raw.state : "open",
    ...(typeof raw.number === "number" && Number.isInteger(raw.number) && raw.number > 0
      ? { number: raw.number }
      : {}),
    ...(typeof raw.search === "string" && raw.search ? { search: raw.search } : {}),
    ...(typeof raw.projectId === "string" && raw.projectId
      ? { projectId: raw.projectId as ProjectId }
      : {}),
    ...(typeof raw.environmentId === "string" && raw.environmentId
      ? { environmentId: raw.environmentId as EnvironmentId }
      : {}),
  }),
  component: IssuesPage,
});

type IssueSortOption = "newest" | "oldest" | "most-commented";

interface FilterOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly icon?: ReactNode;
}

const STATE_OPTIONS: ReadonlyArray<FilterOption<IssueListState>> = [
  {
    value: "open",
    label: "Open",
    icon: <CircleDotIcon className="size-3.5 text-emerald-500" />,
  },
  {
    value: "closed",
    label: "Closed",
    icon: <CheckCircle2Icon className="size-3.5 text-purple-500" />,
  },
  {
    value: "all",
    label: "All",
    icon: <LayersIcon className="size-3.5 text-muted-foreground" />,
  },
];

const SORT_OPTIONS: ReadonlyArray<FilterOption<IssueSortOption>> = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "most-commented", label: "Most commented" },
];

function CompactFilterMenu<Value extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  readonly label: string;
  readonly value: Value;
  readonly options: ReadonlyArray<FilterOption<Value>>;
  readonly onChange: (value: Value) => void;
  readonly className?: string;
}) {
  const current = options.find((option) => option.value === value) ?? options[0];
  if (!current) return null;

  return (
    <Menu>
      <MenuTrigger
        aria-label={`${label}: ${current.label}`}
        render={<Button variant="outline" size="sm" />}
        className={cn("h-8 gap-1.5 px-2 text-xs font-medium", className)}
      >
        {current.icon}
        <span className="truncate">{current.label}</span>
        <ChevronDownIcon aria-hidden className="size-3 shrink-0 text-muted-foreground/70" />
      </MenuTrigger>
      <MenuPopup align="start" side="bottom" className="min-w-36">
        <MenuRadioGroup value={value} onValueChange={(next) => onChange(next as Value)}>
          {options.map((option) => (
            <MenuRadioItem key={option.value} value={option.value} className="text-xs">
              <span className="flex min-w-0 flex-1 items-center gap-2">
                {option.icon}
                <span className="truncate">{option.label}</span>
                <MenuRadioItemIndicator />
              </span>
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuPopup>
    </Menu>
  );
}

function IssuesPage() {
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const { environments } = useEnvironments();
  const projects = useProjects();
  const activeTarget = useActiveProjectTarget();
  const { defaultProjectRef } = useHandleNewThread();
  const sidebarProjectScopeKey = useUiStateStore((state) => state.sidebarProjectScopeKey);
  const projectGroupingSettings = useClientSettings(selectProjectGroupingSettings);

  const [sortOption, setSortOption] = useState<IssueSortOption>("newest");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inFlowSearchRef = useRef<HTMLDivElement | null>(null);

  // Find target environment and project
  const currentEnvironmentId =
    searchParams.environmentId ?? primaryEnvironmentId ?? environments[0]?.environmentId ?? null;

  const activeProject = useMemo(() => {
    if (searchParams.projectId) {
      const found = projects.find(
        (p) =>
          p.id === searchParams.projectId &&
          (!currentEnvironmentId || p.environmentId === currentEnvironmentId),
      );
      if (found) return found;
      const foundAnyEnv = projects.find((p) => p.id === searchParams.projectId);
      if (foundAnyEnv) return foundAnyEnv;
    }

    // Check sidebar project scope if no explicit projectId in search params
    const scopedProject = resolveProjectFromScopeKey({
      projects,
      scopeKey: sidebarProjectScopeKey,
      settings: projectGroupingSettings,
      primaryEnvironmentId,
    });
    if (scopedProject) return scopedProject;

    // Check active project target (e.g. from current thread)
    if (activeTarget) {
      const targetFound = projects.find(
        (p) =>
          p.id === activeTarget.projectId &&
          (!currentEnvironmentId || p.environmentId === currentEnvironmentId),
      );
      if (targetFound) return targetFound;
    }

    // Check default ordered project
    if (defaultProjectRef) {
      const defaultFound = projects.find(
        (p) =>
          p.id === defaultProjectRef.projectId &&
          (!currentEnvironmentId || p.environmentId === defaultProjectRef.environmentId),
      );
      if (defaultFound) return defaultFound;
    }

    // Prefer a project with a repository identity
    const repoProject = projects.find(
      (p) =>
        (!currentEnvironmentId || p.environmentId === currentEnvironmentId) &&
        p.repositoryIdentity != null,
    );
    if (repoProject) return repoProject;

    return (
      projects.find((p) => !currentEnvironmentId || p.environmentId === currentEnvironmentId) ??
      projects[0]
    );
  }, [
    projects,
    searchParams.projectId,
    currentEnvironmentId,
    sidebarProjectScopeKey,
    projectGroupingSettings,
    primaryEnvironmentId,
    activeTarget,
    defaultProjectRef,
  ]);

  const stateFilter: IssueListState = searchParams.state ?? "open";
  const searchQuery = searchParams.search ?? "";

  // List query atom
  const listAtom = useMemo(() => {
    if (!currentEnvironmentId) return null;
    return issueEnvironment.list({
      environmentId: currentEnvironmentId,
      input: {
        projectId: activeProject?.id,
        state: stateFilter,
        limit: 100,
      },
    });
  }, [currentEnvironmentId, activeProject?.id, stateFilter]);

  const {
    data: listData,
    isPending: isListPending,
    refresh: refreshList,
  } = useEnvironmentQuery(listAtom);

  const issues = listData?.issues ?? [];

  // Selected issue number - defaults to null so no panel opens until clicked
  const selectedNumber = searchParams.number ?? null;

  // Detail query atom
  const detailAtom = useMemo(() => {
    if (!currentEnvironmentId || !selectedNumber) return null;
    return issueEnvironment.detail({
      environmentId: currentEnvironmentId,
      input: {
        projectId: activeProject?.id,
        number: selectedNumber,
      },
    });
  }, [currentEnvironmentId, activeProject?.id, selectedNumber]);

  const {
    data: detailData,
    isPending: isDetailPending,
    refresh: refreshDetail,
  } = useEnvironmentQuery(detailAtom);

  // Commands
  const createIssueCmd = useAtomCommand(issueEnvironment.create);
  const updateIssueCmd = useAtomCommand(issueEnvironment.update);
  const commentIssueCmd = useAtomCommand(issueEnvironment.comment);

  const [isUpdatingState, setIsUpdatingState] = useState(false);
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // New Thread handler for "Work on Issue"
  const newThread = useNewThreadHandler();

  const updateSearch = useCallback(
    (patch: Partial<IssuesSearch>) => {
      void navigate({
        search: (prev: IssuesSearch) => {
          const next = { ...prev, ...patch };
          const cleaned: Partial<IssuesSearch> = {};
          for (const [k, v] of Object.entries(next)) {
            if (v !== undefined) {
              (cleaned as Record<string, unknown>)[k] = v;
            }
          }
          return cleaned as IssuesSearch;
        },
        replace: true,
      });
    },
    [navigate],
  );

  const handleSelectIssue = useCallback(
    (issue: IssueListItem) => {
      updateSearch({ number: issue.number });
    },
    [updateSearch],
  );

  const handleStateFilterChange = useCallback(
    (nextState: IssueListState) => {
      updateSearch({ state: nextState, number: undefined });
    },
    [updateSearch],
  );

  const handleSearchChange = useCallback(
    (nextSearch: string) => {
      updateSearch({ search: nextSearch || undefined });
    },
    [updateSearch],
  );

  const handleWorkOnIssue = useCallback(
    async (issue: IssueDetail) => {
      if (!currentEnvironmentId || !activeProject) return;
      const projectRef = {
        environmentId: currentEnvironmentId,
        projectId: activeProject.id,
      };

      const session = await newThread(projectRef);
      if (session) {
        const prompt = `Work on issue #${issue.number}: ${issue.title}\n\nURL: ${issue.url}\n\n${
          issue.body ? `Description:\n${issue.body}` : ""
        }`;
        useComposerDraftStore.getState().setPrompt(session.draftId, prompt);
      }
    },
    [currentEnvironmentId, activeProject, newThread],
  );

  const handleToggleState = useCallback(
    async (issue: IssueDetail, newState: IssueState) => {
      if (!currentEnvironmentId) return;
      setIsUpdatingState(true);
      try {
        await updateIssueCmd({
          environmentId: currentEnvironmentId,
          input: {
            projectId: activeProject?.id,
            number: issue.number,
            state: newState,
          },
        });
        refreshDetail();
        refreshList();
      } finally {
        setIsUpdatingState(false);
      }
    },
    [currentEnvironmentId, activeProject?.id, updateIssueCmd, refreshDetail, refreshList],
  );

  const handleAddComment = useCallback(
    async (issue: IssueDetail, body: string) => {
      if (!currentEnvironmentId) return;
      setIsAddingComment(true);
      try {
        await commentIssueCmd({
          environmentId: currentEnvironmentId,
          input: {
            projectId: activeProject?.id,
            number: issue.number,
            body,
          },
        });
        refreshDetail();
      } finally {
        setIsAddingComment(false);
      }
    },
    [currentEnvironmentId, activeProject?.id, commentIssueCmd, refreshDetail],
  );

  const handleCreateIssue = useCallback(
    async (input: {
      readonly title: string;
      readonly body: string;
      readonly labels?: ReadonlyArray<string>;
    }) => {
      if (!currentEnvironmentId) return;
      setIsCreating(true);
      try {
        const result = await createIssueCmd({
          environmentId: currentEnvironmentId,
          input: {
            projectId: activeProject?.id,
            title: input.title,
            body: input.body,
            labels: input.labels,
          },
        });
        if (result._tag === "Success") {
          refreshList();
          if (result.value.number) {
            updateSearch({ number: result.value.number });
          }
        }
      } finally {
        setIsCreating(false);
      }
    },
    [currentEnvironmentId, activeProject?.id, createIssueCmd, refreshList, updateSearch],
  );

  // Keyboard shortcut: Escape to close detail panel
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape" && selectedNumber !== null) {
        event.preventDefault();
        updateSearch({ number: undefined });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedNumber, updateSearch]);

  // Mod+F to focus search input
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key.toLowerCase() !== "f" || !(event.metaKey || event.ctrlKey)) return;
      if (event.altKey || event.shiftKey) return;
      event.preventDefault();
      const input = inFlowSearchRef.current?.querySelector("input");
      input?.focus();
      input?.select();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Filter and sort issues client-side
  const sortedAndFilteredIssues = useMemo(() => {
    let result = [...issues];

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      result = result.filter((issue) => {
        const matchNumber = String(issue.number).includes(q);
        const matchTitle = issue.title.toLowerCase().includes(q);
        const matchAuthor = issue.author?.login.toLowerCase().includes(q) ?? false;
        const matchLabel = issue.labels.some((l) => l.name.toLowerCase().includes(q));
        return matchNumber || matchTitle || matchAuthor || matchLabel;
      });
    }

    switch (sortOption) {
      case "newest":
        return result.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      case "oldest":
        return result.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      case "most-commented":
        return result.sort((a, b) => b.commentsCount - a.commentsCount);
      default:
        return result;
    }
  }, [issues, searchQuery, sortOption]);

  const hasActiveFilters = searchQuery.length > 0 || stateFilter !== "open";

  const listBody =
    isListPending && issues.length === 0 ? (
      <IssueListGhost />
    ) : sortedAndFilteredIssues.length === 0 ? (
      <IssueEmptyState
        hasFilters={hasActiveFilters}
        onResetFilters={() => {
          updateSearch({ search: undefined, state: "open" });
        }}
      />
    ) : (
      <div className="space-y-0.5">
        {sortedAndFilteredIssues.map((issue) => (
          <IssueRow
            key={issue.id}
            issue={issue}
            selected={issue.number === selectedNumber}
            project={activeProject}
            onSelect={handleSelectIssue}
          />
        ))}
      </div>
    );

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
      <div className="relative flex min-h-0 flex-1">
        {/* Main Issues Column */}
        <div className="@container/issue-list flex min-h-0 min-w-0 flex-1 flex-col bg-background">
          <WorkspacePageHeader
            electron={isElectron}
            reserveNativeControls={selectedNumber === null}
            className="relative bg-background"
          >
            <WorkspaceBreadcrumb ariaLabel="Issues">
              <WorkspaceBreadcrumbItem current>
                <div className="flex items-center gap-1.5">
                  <CircleDotIcon className="size-4 text-emerald-500" />
                  <h1 className="truncate font-semibold text-sm">Issues</h1>
                </div>
              </WorkspaceBreadcrumbItem>
              {activeProject ? (
                <>
                  <WorkspaceBreadcrumbSeparator />
                  <WorkspaceBreadcrumbItem>
                    {projects.length > 1 ? (
                      <Menu>
                        <MenuTrigger
                          render={
                            <button
                              type="button"
                              aria-label={`Current project: ${activeProject.title}. Click to switch project`}
                              className="inline-flex min-w-0 max-w-full cursor-pointer items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                            />
                          }
                        >
                          <ProjectFavicon project={activeProject} className="size-3.5 shrink-0" />
                          <span className="max-w-48 truncate font-medium text-foreground">
                            {activeProject.title}
                          </span>
                          <ChevronDownIcon className="size-3 shrink-0 text-muted-foreground/70" />
                        </MenuTrigger>
                        <MenuPopup
                          align="start"
                          side="bottom"
                          className="max-h-80 min-w-44 max-w-72 overflow-y-auto"
                        >
                          <MenuRadioGroup
                            value={`${activeProject.environmentId}:${activeProject.id}`}
                            onValueChange={(value) => {
                              const selected = projects.find(
                                (p) => `${p.environmentId}:${p.id}` === value,
                              );
                              if (selected) {
                                updateSearch({
                                  projectId: selected.id,
                                  environmentId: selected.environmentId,
                                  number: undefined,
                                });
                              }
                            }}
                          >
                            {projects.map((project) => (
                              <MenuRadioItem
                                key={`${project.environmentId}:${project.id}`}
                                value={`${project.environmentId}:${project.id}`}
                                className="text-xs"
                              >
                                <span className="flex min-w-0 flex-1 items-center gap-2">
                                  <ProjectFavicon project={project} className="size-3.5 shrink-0" />
                                  <span className="min-w-0 flex-1 truncate">{project.title}</span>
                                  <MenuRadioItemIndicator />
                                </span>
                              </MenuRadioItem>
                            ))}
                          </MenuRadioGroup>
                        </MenuPopup>
                      </Menu>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
                        <ProjectFavicon project={activeProject} className="size-3.5 shrink-0" />
                        <span className="max-w-48 truncate font-medium text-foreground">
                          {activeProject.title}
                        </span>
                      </div>
                    )}
                  </WorkspaceBreadcrumbItem>
                </>
              ) : null}
            </WorkspaceBreadcrumb>

            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                variant="default"
                className="gap-1.5 text-xs h-7 font-medium"
                onClick={() => setIsCreateOpen(true)}
              >
                <PlusIcon className="size-3.5" />
                <span>New Issue</span>
              </Button>
            </div>
          </WorkspacePageHeader>

          <div
            ref={scrollRef}
            className="topbar-scroll-fade scrollbar-gutter-both min-h-0 flex-1 overflow-y-auto"
          >
            <WorkspacePageContainer width="expanded" className="gap-4">
              {/* In-flow controls: Search, State filter, Sort, Refresh */}
              <div className="flex flex-col gap-3">
                <div ref={inFlowSearchRef} className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 basis-full @lg/issue-list:basis-0 @lg/issue-list:flex-1">
                    <InputGroup className="min-w-0 flex-1 **:[input]:h-9 sm:**:[input]:h-8">
                      <InputGroupAddon>
                        {isListPending ? (
                          <Spinner aria-hidden className="size-3.5" />
                        ) : (
                          <SearchIcon aria-hidden className="size-3.5" />
                        )}
                      </InputGroupAddon>
                      <InputGroupInput
                        type="search"
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        placeholder="Search issues, or author, label..."
                        aria-label="Search issues"
                      />
                    </InputGroup>
                  </div>
                  <CompactFilterMenu
                    label="State"
                    value={stateFilter}
                    options={STATE_OPTIONS}
                    onChange={handleStateFilterChange}
                  />
                  <CompactFilterMenu
                    label="Sort"
                    value={sortOption}
                    options={SORT_OPTIONS}
                    onChange={setSortOption}
                  />
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="size-8 shrink-0"
                    onClick={() => {
                      refreshList();
                      refreshDetail();
                    }}
                    aria-label="Refresh issues"
                  >
                    <RefreshCwIcon className={cn("size-3.5", isListPending && "animate-spin")} />
                  </Button>
                </div>
              </div>

              {/* List body */}
              {listBody}
            </WorkspacePageContainer>
          </div>
        </div>

        {/* Resizable Detail Panel */}
        {selectedNumber !== null && (
          <PreviewPanelShell
            mode="inline"
            open={selectedNumber !== null}
            widthStorageKey="t3code:issue-panel-width"
            defaultWidth={typeof window === "undefined" ? 640 : Math.floor(window.innerWidth / 2)}
          >
            <IssueDetailPanel
              issue={detailData}
              isLoading={isDetailPending}
              onWorkOnIssue={handleWorkOnIssue}
              onToggleState={handleToggleState}
              onAddComment={handleAddComment}
              onClose={() => updateSearch({ number: undefined })}
              isUpdatingState={isUpdatingState}
              isAddingComment={isAddingComment}
            />
          </PreviewPanelShell>
        )}
      </div>

      <CreateIssueDialog
        isOpen={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSubmit={handleCreateIssue}
        isCreating={isCreating}
      />
    </SidebarInset>
  );
}
