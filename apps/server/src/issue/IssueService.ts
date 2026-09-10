// @effect-diagnostics globalDate:off preferSchemaOverJson:off
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import {
  type IssueComment,
  type IssueCommentInput,
  type IssueCreateInput,
  type IssueDetail,
  type IssueDetailInput,
  type IssueListItem,
  type IssueListInput,
  type IssueListResult,
  IssueRpcError,
  type IssueState,
  type IssueUpdateInput,
  type ProjectId,
} from "@t3tools/contracts";

import * as ProjectionSnapshotQuery from "../orchestration/Services/ProjectionSnapshotQuery.ts";
import * as GitHubCli from "../sourceControl/GitHubCli.ts";

export interface IssueServiceShape {
  readonly list: (input: IssueListInput) => Effect.Effect<IssueListResult, IssueRpcError>;
  readonly detail: (input: IssueDetailInput) => Effect.Effect<IssueDetail, IssueRpcError>;
  readonly create: (input: IssueCreateInput) => Effect.Effect<IssueDetail, IssueRpcError>;
  readonly update: (input: IssueUpdateInput) => Effect.Effect<IssueDetail, IssueRpcError>;
  readonly comment: (input: IssueCommentInput) => Effect.Effect<IssueComment, IssueRpcError>;
}

export class IssueService extends Context.Service<IssueService, IssueServiceShape>()(
  "@16janis12/t3/issue/IssueService",
) {}

interface GhRawAuthor {
  readonly login?: string;
  readonly name?: string;
  readonly avatarUrl?: string;
}

interface GhRawLabel {
  readonly id?: string;
  readonly name?: string;
  readonly color?: string;
  readonly description?: string;
}

interface GhRawComment {
  readonly id?: string;
  readonly author?: GhRawAuthor | null;
  readonly body?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string | null;
  readonly url?: string;
}

interface GhRawIssue {
  readonly id?: string;
  readonly number?: number;
  readonly title?: string;
  readonly state?: string;
  readonly url?: string;
  readonly author?: GhRawAuthor | null;
  readonly labels?: ReadonlyArray<GhRawLabel>;
  readonly assignees?: ReadonlyArray<GhRawAuthor>;
  readonly comments?: ReadonlyArray<GhRawComment>;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly closedAt?: string | null;
  readonly body?: string;
}

function normalizeState(state?: string): IssueState {
  return state?.toLowerCase() === "closed" ? "closed" : "open";
}

function normalizeAuthor(raw?: GhRawAuthor | null) {
  if (!raw || !raw.login) return null;
  return {
    login: raw.login,
    name: raw.name ?? null,
    avatarUrl: raw.avatarUrl ?? null,
  };
}

function normalizeLabels(raw?: ReadonlyArray<GhRawLabel>) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((l) => Boolean(l && l.name))
    .map((l) => ({
      id: l.id,
      name: l.name!,
      color: l.color,
      description: l.description ?? null,
    }));
}

function normalizeAssignees(raw?: ReadonlyArray<GhRawAuthor>) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeAuthor)
    .filter((a): a is NonNullable<ReturnType<typeof normalizeAuthor>> => a !== null);
}

function normalizeComments(raw?: ReadonlyArray<GhRawComment>): ReadonlyArray<IssueComment> {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c) => Boolean(c && c.id && c.createdAt))
    .map((c) => ({
      id: c.id!,
      author: normalizeAuthor(c.author),
      body: c.body ?? "",
      createdAt: c.createdAt!,
      updatedAt: c.updatedAt ?? null,
      url: c.url,
    }));
}

function normalizeListItem(raw: GhRawIssue, projectId?: ProjectId, repo?: string): IssueListItem {
  return {
    id: raw.id ?? `issue-${raw.number}`,
    number: raw.number && raw.number > 0 ? raw.number : 1,
    title: raw.title ?? "",
    state: normalizeState(raw.state),
    url: raw.url ?? "",
    author: normalizeAuthor(raw.author),
    labels: normalizeLabels(raw.labels),
    assignees: normalizeAssignees(raw.assignees),
    commentsCount: Array.isArray(raw.comments) ? raw.comments.length : 0,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? raw.createdAt ?? new Date().toISOString(),
    closedAt: raw.closedAt ?? null,
    projectId,
    repository: repo,
  };
}

function normalizeDetail(raw: GhRawIssue, projectId?: ProjectId, repo?: string): IssueDetail {
  const comments = normalizeComments(raw.comments);
  return {
    id: raw.id ?? `issue-${raw.number}`,
    number: raw.number && raw.number > 0 ? raw.number : 1,
    title: raw.title ?? "",
    state: normalizeState(raw.state),
    url: raw.url ?? "",
    author: normalizeAuthor(raw.author),
    labels: normalizeLabels(raw.labels),
    assignees: normalizeAssignees(raw.assignees),
    commentsCount: comments.length,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? raw.createdAt ?? new Date().toISOString(),
    closedAt: raw.closedAt ?? null,
    body: raw.body ?? "",
    comments,
    projectId,
    repository: repo,
  };
}

export const layer = Layer.effect(
  IssueService,
  Effect.gen(function* () {
    const projectionSnapshotQuery = yield* ProjectionSnapshotQuery.ProjectionSnapshotQuery;
    const githubCli = yield* GitHubCli.GitHubCli;

    const resolveProject = (projectId?: ProjectId) =>
      Effect.gen(function* () {
        const snapshot = yield* projectionSnapshotQuery.getShellSnapshot().pipe(
          Effect.mapError(
            (err) =>
              new IssueRpcError({
                message: "Failed to read orchestration snapshot",
                detail: String(err),
              }),
          ),
        );
        const project = projectId
          ? snapshot.projects.find((p) => p.id === projectId)
          : (snapshot.projects.find((p) => p.repositoryIdentity != null) ?? snapshot.projects[0]);

        if (!project) {
          return yield* Effect.fail(
            new IssueRpcError({
              message: "No matching project found for issue operations",
            }),
          );
        }

        const repo = project.repositoryIdentity?.name
          ? project.repositoryIdentity.owner
            ? `${project.repositoryIdentity.owner}/${project.repositoryIdentity.name}`
            : project.repositoryIdentity.name
          : undefined;

        return {
          workspaceRoot: project.workspaceRoot,
          projectId: project.id,
          repository: repo,
        };
      });

    const list: IssueServiceShape["list"] = (input) =>
      Effect.gen(function* () {
        const project = yield* resolveProject(input.projectId);

        const args = [
          "issue",
          "list",
          "--limit",
          String(input.limit ?? 50),
          "--json",
          "assignees,author,closed,closedAt,comments,createdAt,id,labels,number,state,title,updatedAt,url",
        ];

        if (project.repository) {
          args.push("--repo", project.repository);
        }

        if (input.state && input.state !== "all") {
          args.push("--state", input.state);
        } else if (input.state === "all") {
          args.push("--state", "all");
        }

        if (input.search && input.search.trim().length > 0) {
          args.push("--search", input.search.trim());
        }

        const result = yield* githubCli
          .execute({
            cwd: project.workspaceRoot,
            args,
          })
          .pipe(
            Effect.mapError(
              (err) =>
                new IssueRpcError({
                  message: "Failed to list issues via GitHub CLI",
                  detail: String(err),
                }),
            ),
          );

        const stdout = result.stdout.trim();
        let parsed: ReadonlyArray<GhRawIssue> = [];
        if (stdout.length > 0) {
          try {
            const raw = JSON.parse(stdout);
            if (Array.isArray(raw)) {
              parsed = raw;
            }
          } catch (err) {
            return yield* Effect.fail(
              new IssueRpcError({
                message: "Failed to parse GitHub issues JSON output",
                detail: String(err),
              }),
            );
          }
        }

        const issues = parsed.map((item) =>
          normalizeListItem(item, project.projectId, project.repository),
        );

        return {
          issues,
          repository: project.repository,
        };
      });

    const detail: IssueServiceShape["detail"] = (input) =>
      Effect.gen(function* () {
        const project = yield* resolveProject(input.projectId);

        const args = [
          "issue",
          "view",
          String(input.number),
          "--json",
          "assignees,author,body,closed,closedAt,comments,createdAt,id,labels,number,state,title,updatedAt,url",
        ];

        if (project.repository) {
          args.push("--repo", project.repository);
        }

        const result = yield* githubCli
          .execute({
            cwd: project.workspaceRoot,
            args,
          })
          .pipe(
            Effect.mapError(
              (err) =>
                new IssueRpcError({
                  message: `Failed to view issue #${input.number}`,
                  detail: String(err),
                }),
            ),
          );

        const stdout = result.stdout.trim();
        let parsed: GhRawIssue;
        try {
          parsed = JSON.parse(stdout);
        } catch (err) {
          return yield* Effect.fail(
            new IssueRpcError({
              message: `Failed to parse issue #${input.number} output`,
              detail: String(err),
            }),
          );
        }

        return normalizeDetail(parsed, project.projectId, project.repository);
      });

    const create: IssueServiceShape["create"] = (input) =>
      Effect.gen(function* () {
        const project = yield* resolveProject(input.projectId);

        const args = ["issue", "create", "--title", input.title, "--body", input.body];

        if (project.repository) {
          args.push("--repo", project.repository);
        }

        if (input.labels) {
          for (const label of input.labels) {
            args.push("--label", label);
          }
        }
        if (input.assignees) {
          for (const assignee of input.assignees) {
            args.push("--assignee", assignee);
          }
        }

        const result = yield* githubCli
          .execute({
            cwd: project.workspaceRoot,
            args,
          })
          .pipe(
            Effect.mapError(
              (err) =>
                new IssueRpcError({
                  message: "Failed to create issue",
                  detail: String(err),
                }),
            ),
          );

        // Output contains url of created issue, e.g. https://github.com/owner/repo/issues/123
        const match = result.stdout.match(/\/issues\/(\d+)/);
        if (!match) {
          return yield* Effect.fail(
            new IssueRpcError({
              message: "Issue created but could not parse issue number from output",
              detail: result.stdout,
            }),
          );
        }

        const number = parseInt(match[1]!, 10);
        return yield* detail({ projectId: project.projectId, number });
      });

    const update: IssueServiceShape["update"] = (input) =>
      Effect.gen(function* () {
        const project = yield* resolveProject(input.projectId);

        if (input.state === "closed") {
          const closeArgs = ["issue", "close", String(input.number)];
          if (project.repository) {
            closeArgs.push("--repo", project.repository);
          }
          yield* githubCli
            .execute({
              cwd: project.workspaceRoot,
              args: closeArgs,
            })
            .pipe(
              Effect.mapError(
                (err) =>
                  new IssueRpcError({
                    message: `Failed to close issue #${input.number}`,
                    detail: String(err),
                  }),
              ),
            );
        } else if (input.state === "open") {
          const reopenArgs = ["issue", "reopen", String(input.number)];
          if (project.repository) {
            reopenArgs.push("--repo", project.repository);
          }
          yield* githubCli
            .execute({
              cwd: project.workspaceRoot,
              args: reopenArgs,
            })
            .pipe(
              Effect.mapError(
                (err) =>
                  new IssueRpcError({
                    message: `Failed to reopen issue #${input.number}`,
                    detail: String(err),
                  }),
              ),
            );
        }

        if (input.title !== undefined || input.body !== undefined) {
          const editArgs = ["issue", "edit", String(input.number)];
          if (project.repository) {
            editArgs.push("--repo", project.repository);
          }
          if (input.title !== undefined) {
            editArgs.push("--title", input.title);
          }
          if (input.body !== undefined) {
            editArgs.push("--body", input.body);
          }
          yield* githubCli
            .execute({
              cwd: project.workspaceRoot,
              args: editArgs,
            })
            .pipe(
              Effect.mapError(
                (err) =>
                  new IssueRpcError({
                    message: `Failed to edit issue #${input.number}`,
                    detail: String(err),
                  }),
              ),
            );
        }

        return yield* detail({ projectId: project.projectId, number: input.number });
      });

    const comment: IssueServiceShape["comment"] = (input) =>
      Effect.gen(function* () {
        const project = yield* resolveProject(input.projectId);

        const commentArgs = ["issue", "comment", String(input.number), "--body", input.body];
        if (project.repository) {
          commentArgs.push("--repo", project.repository);
        }

        yield* githubCli
          .execute({
            cwd: project.workspaceRoot,
            args: commentArgs,
          })
          .pipe(
            Effect.mapError(
              (err) =>
                new IssueRpcError({
                  message: `Failed to add comment to issue #${input.number}`,
                  detail: String(err),
                }),
            ),
          );

        const updatedDetail = yield* detail({
          projectId: project.projectId,
          number: input.number,
        });

        const latestComment = updatedDetail.comments[updatedDetail.comments.length - 1];
        if (!latestComment) {
          return yield* Effect.fail(
            new IssueRpcError({
              message: "Comment added but could not retrieve comment details",
            }),
          );
        }

        return latestComment;
      });

    return {
      list,
      detail,
      create,
      update,
      comment,
    };
  }),
);
