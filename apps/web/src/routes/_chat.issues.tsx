import type {
  EnvironmentId,
  IssueDetail,
  IssueListItem,
  IssueListState,
  IssueState,
  ProjectId,
} from "@t3tools/contracts";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDownIcon, CircleDotIcon, PlusIcon, RefreshCwIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { useComposerDraftStore } from "~/composerDraftStore";
import { CreateIssueDialog } from "~/components/issue/CreateIssueDialog";
import { IssueDetailPanel } from "~/components/issue/IssueDetailPanel";
import { IssueList } from "~/components/issue/IssueList";
import { ProjectFavicon } from "~/components/ProjectFavicon";
import { Button } from "~/components/ui/button";
import { Menu, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "~/components/ui/menu";
import { SidebarInset } from "~/components/ui/sidebar";
import {
  WorkspaceBreadcrumb,
  WorkspaceBreadcrumbItem,
  WorkspaceBreadcrumbSeparator,
} from "~/components/WorkspaceBreadcrumb";
import { WorkspacePageContainer } from "~/components/WorkspacePageContainer";
import { WorkspacePageHeader } from "~/components/WorkspacePageHeader";
import { useActiveProjectTarget } from "~/hooks/useActiveProjectTarget";
import { useHandleNewThread, useNewThreadHandler } from "~/hooks/useHandleNewThread";
import { useClientSettings } from "~/hooks/useSettings";
import { selectProjectGroupingSettings } from "~/logicalProject";
import { cn } from "~/lib/utils";
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
        search: searchQuery || undefined,
        limit: 100,
      },
    });
  }, [currentEnvironmentId, activeProject?.id, stateFilter, searchQuery]);

  const {
    data: listData,
    isPending: isListPending,
    refresh: refreshList,
  } = useEnvironmentQuery(listAtom);

  const issues = listData?.issues ?? [];

  // Selected issue number - defaults to null so the empty state is shown until user selects one
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

  return (
    <WorkspacePageContainer>
      <WorkspacePageHeader>
        <WorkspaceBreadcrumb ariaLabel="Issues">
          <WorkspaceBreadcrumbItem>
            <CircleDotIcon className="h-4 w-4 text-emerald-500" />
            <span className="font-semibold text-sm">Issues</span>
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
                            className="gap-2 text-xs"
                          >
                            <ProjectFavicon project={project} className="size-3.5 shrink-0" />
                            <span className="truncate">{project.title}</span>
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
            variant="outline"
            className="gap-1.5 text-xs h-7"
            onClick={() => {
              refreshList();
              refreshDetail();
            }}
          >
            <RefreshCwIcon className={cn("h-3.5 w-3.5", isListPending && "animate-spin")} />
            <span>Refresh</span>
          </Button>

          <Button
            size="sm"
            variant="default"
            className="gap-1.5 text-xs h-7 font-medium"
            onClick={() => setIsCreateOpen(true)}
          >
            <PlusIcon className="h-3.5 w-3.5" />
            <span>New Issue</span>
          </Button>
        </div>
      </WorkspacePageHeader>

      <SidebarInset className="flex-1 flex overflow-hidden">
        <div className="grid grid-cols-[380px_1fr] h-full w-full overflow-hidden">
          <IssueList
            issues={issues}
            selectedNumber={selectedNumber}
            onSelectIssue={handleSelectIssue}
            stateFilter={stateFilter}
            onStateFilterChange={handleStateFilterChange}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            isLoading={isListPending}
          />
          <IssueDetailPanel
            issue={detailData}
            isLoading={isDetailPending}
            onWorkOnIssue={handleWorkOnIssue}
            onToggleState={handleToggleState}
            onAddComment={handleAddComment}
            isUpdatingState={isUpdatingState}
            isAddingComment={isAddingComment}
          />
        </div>
      </SidebarInset>

      <CreateIssueDialog
        isOpen={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSubmit={handleCreateIssue}
        isCreating={isCreating}
      />
    </WorkspacePageContainer>
  );
}
