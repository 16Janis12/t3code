// @effect-diagnostics nodeBuiltinImport:off
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { ProjectId } from "@t3tools/contracts";
import {
  readWorkspaceMcpFile,
  resolveActiveMcpServers,
  resolveProjectDiscoveredServers,
  toAcpMcpServers,
  toClaudeMcpServers,
  toCodexCliArgs,
  toOpenCodeMcpServers,
} from "./McpServerResolver.ts";

describe("McpServerResolver", () => {
  it("reads .mcp.json and mcp.json files with lenient comments", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-test-"));
    try {
      // 1. Missing file returns null
      expect(readWorkspaceMcpFile(tmpDir)).toBeNull();

      // 2. .mcp.json with trailing comma and comments
      fs.writeFileSync(
        path.join(tmpDir, ".mcp.json"),
        `{\n  // comment\n  "mcpServers": {\n    "test": { "command": "echo", "args": ["hi"], },\n  },\n}`,
      );
      const parsed = readWorkspaceMcpFile(tmpDir);
      expect(parsed).toEqual({
        mcpServers: {
          test: {
            command: "echo",
            args: ["hi"],
          },
        },
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("resolves discovered servers with global, project, and overrides", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-test-"));
    try {
      fs.writeFileSync(
        path.join(tmpDir, ".mcp.json"),
        JSON.stringify({
          mcpServers: {
            localServer: { command: "node", args: ["script.js"] },
            overrideMe: { command: "node", args: ["local.js"] },
          },
        }),
      );

      const projectId = ProjectId.make("proj_1");
      const settings = {
        mcpServers: {
          globalServer: { type: "http" as const, url: "https://global.test" },
          overrideMe: { type: "http" as const, url: "https://global-override.test" },
        },
        enableProjectMcpServers: true,
        projectMcpServerOverrides: {
          [projectId]: {
            localServer: false,
          },
        },
      };

      const discovered = resolveProjectDiscoveredServers({
        projectId,
        workspaceRoot: tmpDir,
        settings,
      });

      expect(discovered).toEqual([
        {
          name: "globalServer",
          source: "global",
          config: { type: "http", url: "https://global.test" },
          enabled: true,
        },
        {
          name: "overrideMe",
          source: "project",
          config: { command: "node", args: ["local.js"] },
          enabled: true,
        },
        {
          name: "localServer",
          source: "project",
          config: { command: "node", args: ["script.js"] },
          enabled: false,
        },
      ]);

      const active = resolveActiveMcpServers({
        projectId,
        workspaceRoot: tmpDir,
        settings,
      });

      expect(Object.keys(active).sort()).toEqual(["globalServer", "overrideMe"]);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("ignores project servers when enableProjectMcpServers is false", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-test-"));
    try {
      fs.writeFileSync(
        path.join(tmpDir, ".mcp.json"),
        JSON.stringify({
          mcpServers: {
            localServer: { command: "node", args: ["script.js"] },
          },
        }),
      );

      const settings = {
        mcpServers: {
          globalServer: { type: "http" as const, url: "https://global.test" },
        },
        enableProjectMcpServers: false,
        projectMcpServerOverrides: {},
      };

      const discovered = resolveProjectDiscoveredServers({
        workspaceRoot: tmpDir,
        settings,
      });

      expect(discovered).toEqual([
        {
          name: "globalServer",
          source: "global",
          config: { type: "http", url: "https://global.test" },
          enabled: true,
        },
      ]);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("translates configs for ACP, Claude, Codex, and OpenCode", () => {
    const servers = {
      cliServer: {
        command: "node",
        args: ["./cli.js"],
        env: { FOO: "BAR" },
      },
      remoteServer: {
        type: "http" as const,
        url: "https://api.test/mcp",
        headers: { Authorization: "Bearer token" },
      },
    };

    // 1. ACP
    const acp = toAcpMcpServers(servers);
    expect(acp).toEqual([
      {
        name: "cliServer",
        command: "node",
        args: ["./cli.js"],
        env: [{ name: "FOO", value: "BAR" }],
      },
      {
        type: "http",
        name: "remoteServer",
        url: "https://api.test/mcp",
        headers: [{ name: "Authorization", value: "Bearer token" }],
      },
    ]);

    // 2. Claude
    const claude = toClaudeMcpServers(servers);
    expect(claude).toEqual({
      cliServer: {
        command: "node",
        args: ["./cli.js"],
        env: { FOO: "BAR" },
      },
      remoteServer: {
        type: "http",
        url: "https://api.test/mcp",
        headers: { Authorization: "Bearer token" },
      },
    });

    // 3. Codex CLI
    const codex = toCodexCliArgs(servers);
    expect(codex.args).toEqual([
      "-c",
      'mcp_servers.cliServer.command="node"',
      "-c",
      'mcp_servers.cliServer.args=["./cli.js"]',
      "-c",
      'mcp_servers.cliServer.env={"FOO":"BAR"}',
      "-c",
      'mcp_servers.remoteServer.url="https://api.test/mcp"',
      "-c",
      'mcp_servers.remoteServer.http_headers={"Authorization":"Bearer token"}',
    ]);

    // 4. OpenCode
    const opencode = toOpenCodeMcpServers(servers);
    expect(opencode).toEqual([
      {
        name: "cliServer",
        config: {
          type: "local",
          command: ["node", "./cli.js"],
          environment: { FOO: "BAR" },
          enabled: true,
        },
      },
      {
        name: "remoteServer",
        config: {
          type: "remote",
          url: "https://api.test/mcp",
          headers: { Authorization: "Bearer token" },
          oauth: false,
          enabled: true,
        },
      },
    ]);
  });
});
