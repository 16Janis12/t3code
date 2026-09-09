import * as fs from "node:fs";
import * as path from "node:path";
import * as Schema from "effect/Schema";
import * as Option from "effect/Option";
import {
  type DiscoveredMcpServer,
  McpConfigFile,
  type McpServerConfig,
  type ProjectId,
  type ServerSettings,
} from "@t3tools/contracts";
import { fromLenientJson } from "@t3tools/shared/schemaJson";
import type { McpServer } from "@t3tools/effect-acp";

const McpConfigFileJson = fromLenientJson(McpConfigFile);
const decodeMcpConfigFileJson = Schema.decodeUnknownOption(McpConfigFileJson);

export function readWorkspaceMcpFile(workspaceDir: string): McpConfigFile | null {
  const candidateFiles = [
    path.join(workspaceDir, ".mcp.json"),
    path.join(workspaceDir, "mcp.json"),
  ];

  for (const filePath of candidateFiles) {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf8");
        const decoded = decodeMcpConfigFileJson(content);
        if (Option.isSome(decoded)) {
          return decoded.value;
        }
      }
    } catch {
      // Ignore read errors gracefully
    }
  }
  return null;
}

export function resolveProjectDiscoveredServers(input: {
  readonly projectId?: ProjectId | undefined;
  readonly workspaceRoot?: string | undefined;
  readonly settings: Pick<
    ServerSettings,
    "mcpServers" | "enableProjectMcpServers" | "projectMcpServerOverrides"
  >;
}): ReadonlyArray<DiscoveredMcpServer> {
  const result = new Map<string, DiscoveredMcpServer>();
  const projectOverrides = input.projectId
    ? input.settings.projectMcpServerOverrides[input.projectId] ?? {}
    : {};

  // 1. Add global servers from settings
  for (const [name, config] of Object.entries(input.settings.mcpServers ?? {})) {
    const enabled = projectOverrides[name] ?? true;
    result.set(name, {
      name,
      source: "global",
      config,
      enabled,
    });
  }

  // 2. Discover project servers if enabled
  if (input.settings.enableProjectMcpServers !== false && input.workspaceRoot) {
    const projectMcp = readWorkspaceMcpFile(input.workspaceRoot);
    if (projectMcp?.mcpServers) {
      for (const [name, config] of Object.entries(projectMcp.mcpServers)) {
        const enabled = projectOverrides[name] ?? true;
        // Project server takes precedence over global if name collisions occur
        result.set(name, {
          name,
          source: "project",
          config,
          enabled,
        });
      }
    }
  }

  return Array.from(result.values());
}

export function resolveActiveMcpServers(input: {
  readonly projectId?: ProjectId | undefined;
  readonly workspaceRoot?: string | undefined;
  readonly settings: Pick<
    ServerSettings,
    "mcpServers" | "enableProjectMcpServers" | "projectMcpServerOverrides"
  >;
}): Record<string, McpServerConfig> {
  const discovered = resolveProjectDiscoveredServers(input);
  const active: Record<string, McpServerConfig> = {};
  for (const server of discovered) {
    if (server.enabled) {
      active[server.name] = server.config;
    }
  }
  return active;
}

export function toAcpMcpServers(servers: Record<string, McpServerConfig>): Array<McpServer> {
  return Object.entries(servers).map(([name, config]): McpServer => {
    if (config.type === "http") {
      return {
        type: "http" as const,
        name,
        url: config.url,
        headers: Object.entries(config.headers ?? {}).map(([hName, value]) => ({
          name: hName,
          value,
        })),
      };
    }
    if (config.type === "sse") {
      return {
        type: "sse" as const,
        name,
        url: config.url,
        headers: Object.entries(config.headers ?? {}).map(([hName, value]) => ({
          name: hName,
          value,
        })),
      };
    }
    // Stdio
    return {
      name,
      command: config.command,
      args: config.args ?? [],
      env: Object.entries(config.env ?? {}).map(([eName, value]) => ({
        name: eName,
        value,
      })),
    };
  });
}

export function toClaudeMcpServers(servers: Record<string, McpServerConfig>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [name, config] of Object.entries(servers)) {
    if (config.type === "http" || config.type === "sse") {
      result[name] = {
        type: config.type,
        url: config.url,
        ...(config.headers && Object.keys(config.headers).length > 0
          ? { headers: config.headers }
          : {}),
      };
    } else {
      result[name] = {
        command: config.command,
        ...(config.args && config.args.length > 0 ? { args: config.args } : {}),
        ...(config.env && Object.keys(config.env).length > 0 ? { env: config.env } : {}),
      };
    }
  }
  return result;
}

export function toCodexCliArgs(servers: Record<string, McpServerConfig>): {
  args: string[];
  env: Record<string, string>;
} {
  const args: string[] = [];
  const env: Record<string, string> = {};

  for (const [name, config] of Object.entries(servers)) {
    if (config.type === "http" || config.type === "sse") {
      args.push("-c", `mcp_servers.${name}.url=${JSON.stringify(config.url)}`);
      if (config.headers && Object.keys(config.headers).length > 0) {
        args.push(
          "-c",
          `mcp_servers.${name}.http_headers=${JSON.stringify(config.headers)}`,
        );
      }
    } else {
      args.push("-c", `mcp_servers.${name}.command=${JSON.stringify(config.command)}`);
      if (config.args && config.args.length > 0) {
        args.push("-c", `mcp_servers.${name}.args=${JSON.stringify(config.args)}`);
      }
      if (config.env && Object.keys(config.env).length > 0) {
        args.push("-c", `mcp_servers.${name}.env=${JSON.stringify(config.env)}`);
      }
    }
  }

  return { args, env };
}

export function toOpenCodeMcpServers(servers: Record<string, McpServerConfig>): Array<{
  name: string;
  config:
    | {
        type: "local";
        command: Array<string>;
        environment?: Record<string, string>;
        enabled: boolean;
      }
    | {
        type: "remote";
        url: string;
        headers?: Record<string, string>;
        oauth: false;
        enabled: boolean;
      };
}> {
  return Object.entries(servers).map(([name, config]) => {
    if (config.type === "http" || config.type === "sse") {
      return {
        name,
        config: {
          type: "remote" as const,
          url: config.url,
          ...(config.headers && Object.keys(config.headers).length > 0
            ? { headers: config.headers }
            : {}),
          oauth: false as const,
          enabled: true,
        },
      };
    }
    return {
      name,
      config: {
        type: "local" as const,
        command: [config.command, ...(config.args ?? [])],
        ...(config.env && Object.keys(config.env).length > 0
          ? { environment: config.env }
          : {}),
        enabled: true,
      },
    };
  });
}
