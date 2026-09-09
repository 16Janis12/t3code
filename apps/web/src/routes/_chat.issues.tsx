import type {
  EnvironmentId,
  IssueDetail,
  IssueListItem,
  IssueListState,
  IssueState,
  ProjectId,
} from "@t3tools/contracts";
import { createFileRoute } from "@tanstack/react-router";
import { CircleDotIcon, PlusIcon, RefreshCwIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { useComposerDraftStore } from "~/composerDraftStore";
import { CreateIssueDialog } from "~/components/issue/CreateIssueDialog";
import { IssueDetailPanel } from "~/components/issue/IssueDetailPanel";
import { IssueList } from "~/components/issue/IssueList";
import { Button } from "~/components/ui/button";
import { SidebarInset } from "~/components/ui/sidebar";
import {
  WorkspaceBreadcrumb,
  WorkspaceBreadcrumbItem,
  WorkspaceBreadcrumbSeparator,
} from "~/components/WorkspaceBreadcrumb";
import { WorkspacePageContainer } from "~/components/WorkspacePageContainer";
import { WorkspacePageHeader } from "~/components/WorkspacePageHeader";
import { useNewThreadHandler } from "~/hooks/useHandleNewThread";
import { cn } from "~/lib/utils";
import { useProjects } from "~/state/entities";
import { useEnvironments, usePrimaryEnvironmentId } from "~/state/environments";
import { issueEnvironment } from "~/state/issues";
import { useEnvironmentQuery } from "~/state/query";
import { useAtomCommand } from "~/state/use-atom-command";

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
    }
    return (
      projects.find((p) => !currentEnvironmentId || p.environmentId === currentEnvironmentId) ??
      projects[0]
    );
  }, [projects, searchParams.projectId, currentEnvironmentId]);

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

  // Selected issue number
  const selectedNumber = useMemo(() => {
    if (searchParams.number) return searchParams.number;
    return issues[0]?.number ?? null;
  }, [searchParams.number, issues]);

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
        search: (prev: IssuesSearch) => ({
          ...prev,
          ...patch,
        }),
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
                <span className="text-muted-foreground text-xs">{activeProject.title}</span>
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
