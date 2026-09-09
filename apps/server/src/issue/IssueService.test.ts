import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { type OrchestrationProjectShell, type ProjectId } from "@t3tools/contracts";

import * as ProjectionSnapshotQuery from "../orchestration/Services/ProjectionSnapshotQuery.ts";
import * as GitHubCli from "../sourceControl/GitHubCli.ts";
import * as IssueService from "./IssueService.ts";

const sampleGhIssue = {
  id: "issue_1",
  number: 42,
  title: "Test Issue",
  state: "OPEN",
  url: "https://github.com/16Janis12/t3code/issues/42",
  author: {
    login: "octocat",
    name: "The Octocat",
    avatarUrl: "https://github.com/images/error/octocat_happy.gif",
  },
  labels: [{ id: "label_1", name: "bug", color: "d73a4a", description: "Something isn't working" }],
  assignees: [{ login: "octocat", name: "The Octocat" }],
  comments: [
    {
      id: "comment_1",
      author: { login: "octocat" },
      body: "First comment",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: null,
      url: "https://github.com/16Janis12/t3code/issues/42#issuecomment-1",
    },
  ],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T01:00:00Z",
  closedAt: null,
  body: "Issue description here",
};

const makeTestEnv = (executeFn: (opts: any) => Effect.Effect<any, any>) =>
  IssueService.layer.pipe(
    Layer.provide(
      Layer.succeed(ProjectionSnapshotQuery.ProjectionSnapshotQuery, {
        getShellSnapshot: () =>
          Effect.succeed({
            snapshotSequence: 0,
            projects: [
              {
                id: "proj_1" as ProjectId,
                title: "T3 Code",
                workspaceRoot: "/path/to/project",
                repositoryIdentity: {
                  canonicalKey: "github.com/16Janis12/t3code",
                  locator: "github.com/16Janis12/t3code",
                  owner: "16Janis12",
                  name: "t3code",
                },
              } as unknown as OrchestrationProjectShell,
            ],
            threads: [],
            updatedAt: "2026-01-01T00:00:00Z",
          } as any),
        getSnapshot: () =>
          Effect.succeed({
            projects: [
              {
                id: "proj_1" as ProjectId,
                title: "T3 Code",
                workspaceRoot: "/path/to/project",
              } as unknown as OrchestrationProjectShell,
            ],
          } as any),
      } as unknown as ProjectionSnapshotQuery.ProjectionSnapshotQueryShape),
    ),
    Layer.provide(
      Layer.succeed(GitHubCli.GitHubCli, {
        execute: executeFn,
      } as unknown as GitHubCli.GitHubCli["Service"]),
    ),
  );

it.effect("lists issues and resolves repository", () =>
  Effect.gen(function* () {
    const issueService = yield* IssueService.IssueService;
    const result = yield* issueService.list({});
    assert.equal(result.repository, "16Janis12/t3code");
    assert.equal(result.issues.length, 1);
    assert.equal(result.issues[0]?.number, 42);
    assert.equal(result.issues[0]?.title, "Test Issue");
    assert.equal(result.issues[0]?.state, "open");
    assert.equal(result.issues[0]?.author?.login, "octocat");
    assert.equal(result.issues[0]?.labels[0]?.name, "bug");
  }).pipe(
    Effect.provide(
      makeTestEnv(() =>
        Effect.succeed({
          stdout: JSON.stringify([sampleGhIssue]),
          stderr: "",
        }),
      ),
    ),
  ),
);

it.effect("gets issue detail with comments", () =>
  Effect.gen(function* () {
    const issueService = yield* IssueService.IssueService;
    const detail = yield* issueService.detail({ number: 42 as any });
    assert.equal(detail.number, 42);
    assert.equal(detail.title, "Test Issue");
    assert.equal(detail.body, "Issue description here");
    assert.equal(detail.comments.length, 1);
    assert.equal(detail.comments[0]?.body, "First comment");
  }).pipe(
    Effect.provide(
      makeTestEnv(() =>
        Effect.succeed({
          stdout: JSON.stringify(sampleGhIssue),
          stderr: "",
        }),
      ),
    ),
  ),
);

it.effect("creates issue and fetches its detail", () =>
  Effect.gen(function* () {
    const issueService = yield* IssueService.IssueService;
    const detail = yield* issueService.create({
      title: "New issue" as any,
      body: "Body",
    });
    assert.equal(detail.number, 42);
  }).pipe(
    Effect.provide(
      makeTestEnv((opts) => {
        if (opts.args[1] === "create") {
          return Effect.succeed({
            stdout: "https://github.com/16Janis12/t3code/issues/42\n",
            stderr: "",
          });
        }
        return Effect.succeed({
          stdout: JSON.stringify(sampleGhIssue),
          stderr: "",
        });
      }),
    ),
  ),
);

it.effect("updates issue state and fetches updated detail", () =>
  Effect.gen(function* () {
    const issueService = yield* IssueService.IssueService;
    const detail = yield* issueService.update({
      number: 42 as any,
      state: "closed",
    });
    assert.equal(detail.number, 42);
  }).pipe(
    Effect.provide(
      makeTestEnv((opts) => {
        if (opts.args[1] === "close") {
          return Effect.succeed({ stdout: "", stderr: "" });
        }
        return Effect.succeed({
          stdout: JSON.stringify({ ...sampleGhIssue, state: "CLOSED" }),
          stderr: "",
        });
      }),
    ),
  ),
);

it.effect("fails gracefully when no project matches", () =>
  Effect.gen(function* () {
    const issueService = yield* IssueService.IssueService;
    const error = yield* issueService.list({}).pipe(Effect.flip);
    assert.equal(error._tag, "IssueRpcError");
    assert.include(error.message, "No matching project found");
  }).pipe(
    Effect.provide(
      IssueService.layer.pipe(
        Layer.provide(
          Layer.succeed(ProjectionSnapshotQuery.ProjectionSnapshotQuery, {
            getShellSnapshot: () =>
              Effect.succeed({
                snapshotSequence: 0,
                projects: [],
                threads: [],
                updatedAt: "2026-01-01T00:00:00Z",
              } as any),
          } as unknown as ProjectionSnapshotQuery.ProjectionSnapshotQueryShape),
        ),
        Layer.provide(
          Layer.succeed(GitHubCli.GitHubCli, {
            execute: () => Effect.die("should not be called"),
          } as unknown as GitHubCli.GitHubCli["Service"]),
        ),
      ),
    ),
  ),
);
