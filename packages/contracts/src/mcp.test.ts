import { describe, expect, it } from "@effect/vitest";
import * as Schema from "effect/Schema";
import {
  DiscoveredMcpServer,
  McpConfigFile,
  McpServerConfig,
  McpStdioServerConfig,
  McpRemoteServerConfig,
} from "./mcp.ts";

const decodeMcpServerConfig = Schema.decodeUnknownSync(McpServerConfig);
const decodeMcpConfigFile = Schema.decodeUnknownSync(McpConfigFile);
const decodeDiscoveredMcpServer = Schema.decodeUnknownSync(DiscoveredMcpServer);

describe("McpServerConfig", () => {
  it("decodes a stdio server without explicit type", () => {
    const parsed = decodeMcpServerConfig({
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-everything"],
      env: { FOO: "bar" },
    });
    expect(parsed).toEqual({
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-everything"],
      env: { FOO: "bar" },
    });
  });

  it("decodes a stdio server with explicit type", () => {
    const parsed = decodeMcpServerConfig({
      type: "stdio",
      command: "docker",
      args: ["run", "-i"],
    });
    expect(parsed).toEqual({
      type: "stdio",
      command: "docker",
      args: ["run", "-i"],
    });
  });

  it("decodes an http remote server", () => {
    const parsed = decodeMcpServerConfig({
      type: "http",
      url: "https://mcp.example.com/api",
      headers: { Authorization: "Bearer token123" },
    });
    expect(parsed).toEqual({
      type: "http",
      url: "https://mcp.example.com/api",
      headers: { Authorization: "Bearer token123" },
    });
  });

  it("decodes an sse remote server", () => {
    const parsed = decodeMcpServerConfig({
      type: "sse",
      url: "https://mcp.example.com/sse",
    });
    expect(parsed).toEqual({
      type: "sse",
      url: "https://mcp.example.com/sse",
    });
  });

  it("rejects an invalid config", () => {
    expect(() => decodeMcpServerConfig({})).toThrow();
  });
});

describe("McpConfigFile", () => {
  it("decodes standard .mcp.json format", () => {
    const parsed = decodeMcpConfigFile({
      mcpServers: {
        xcodebuildmcp: {
          command: "npx",
          args: ["--yes", "xcodebuildmcp@2.6.2", "mcp"],
          env: {
            XCODEBUILDMCP_ENABLED_WORKFLOWS: "simulator,ui-automation",
          },
        },
        remoteprovider: {
          type: "http",
          url: "http://localhost:8080/mcp",
        },
      },
    });
    expect(Object.keys(parsed.mcpServers)).toEqual(["xcodebuildmcp", "remoteprovider"]);
  });
});

describe("DiscoveredMcpServer", () => {
  it("decodes a discovered server record", () => {
    const parsed = decodeDiscoveredMcpServer({
      name: "xcodebuildmcp",
      source: "project",
      enabled: true,
      config: {
        command: "npx",
        args: ["xcodebuildmcp"],
      },
      filePath: "/path/to/.mcp.json",
    });
    expect(parsed.name).toBe("xcodebuildmcp");
    expect(parsed.source).toBe("project");
    expect(parsed.enabled).toBe(true);
  });
});
