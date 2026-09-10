import { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import type { Project } from "./types";
import { resolveProjectFromScopeKey } from "./sidebarProjectGrouping";
import type { ProjectGroupingSettings } from "./logicalProject";
import { buildProjectGroups } from "./logicalProject";

const localEnv = EnvironmentId.make("local");
const remoteEnv = EnvironmentId.make("remote");

function makeProject(
  id: string,
  environmentId: EnvironmentId = localEnv,
  overrides: Partial<Project> = {},
): Project {
  return {
    environmentId,
    id: ProjectId.make(id),
    title: id,
    workspaceRoot: `/work/${id}`,
    defaultModelSelection: null,
    scripts: [],
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

const defaultSettings: ProjectGroupingSettings = {
  sidebarProjectGroupingMode: "separate",
  sidebarProjectGroupingOverrides: {},
};

describe("resolveProjectFromScopeKey", () => {
  it("returns null when scopeKey is null or undefined", () => {
    const projects = [makeProject("p1")];
    expect(
      resolveProjectFromScopeKey({
        projects,
        scopeKey: null,
        settings: defaultSettings,
      }),
    ).toBeNull();

    expect(
      resolveProjectFromScopeKey({
        projects,
        scopeKey: undefined,
        settings: defaultSettings,
      }),
    ).toBeNull();
  });

  it("returns null when scopeKey does not match any group", () => {
    const projects = [makeProject("p1")];
    expect(
      resolveProjectFromScopeKey({
        projects,
        scopeKey: "unknown-scope-key",
        settings: defaultSettings,
      }),
    ).toBeNull();
  });

  it("resolves the project when scopeKey matches a project group", () => {
    const p1 = makeProject("p1");
    const p2 = makeProject("p2");
    const projects = [p1, p2];

    const groups = buildProjectGroups({
      projects,
      settings: defaultSettings,
    });
    const p2GroupKey = groups.find((g) => g.members.some((m) => m.project.id === p2.id))?.key;
    expect(p2GroupKey).toBeDefined();

    const resolved = resolveProjectFromScopeKey({
      projects,
      scopeKey: p2GroupKey,
      settings: defaultSettings,
    });

    expect(resolved).not.toBeNull();
    expect(resolved?.id).toBe(p2.id);
  });

  it("resolves preferred member matching primaryEnvironmentId", () => {
    const repoIdentity = {
      canonicalKey: "github.com/t3tools/t3code",
      locator: {
        source: "git-remote" as const,
        remoteName: "origin",
        remoteUrl: "https://github.com/t3tools/t3code.git",
      },
      provider: "github",
      owner: "t3tools",
      name: "t3code",
      displayName: "T3 Code",
    };

    const localProject = makeProject("t3-local", localEnv, {
      repositoryIdentity: repoIdentity,
    });
    const remoteProject = makeProject("t3-remote", remoteEnv, {
      repositoryIdentity: repoIdentity,
    });
    const projects = [remoteProject, localProject];

    const repoSettings: ProjectGroupingSettings = {
      sidebarProjectGroupingMode: "repository",
      sidebarProjectGroupingOverrides: {},
    };

    const groups = buildProjectGroups({
      projects,
      settings: repoSettings,
    });
    const repoGroupKey = groups[0]?.key;
    expect(repoGroupKey).toBe("github.com/t3tools/t3code");

    const resolved = resolveProjectFromScopeKey({
      projects,
      scopeKey: repoGroupKey,
      settings: repoSettings,
      primaryEnvironmentId: localEnv,
    });

    expect(resolved).not.toBeNull();
    expect(resolved?.id).toBe(localProject.id);
    expect(resolved?.environmentId).toBe(localEnv);
  });
});
