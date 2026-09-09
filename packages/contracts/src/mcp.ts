import * as Schema from "effect/Schema";
import { TrimmedNonEmptyString } from "./baseSchemas.ts";

export const McpTransportKind = Schema.Literals(["stdio", "http", "sse"]);
export type McpTransportKind = typeof McpTransportKind.Type;

export const McpStdioServerConfig = Schema.Struct({
  type: Schema.optional(Schema.Literal("stdio")),
  command: TrimmedNonEmptyString,
  args: Schema.optional(Schema.Array(Schema.String)),
  env: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  disabled: Schema.optional(Schema.Boolean),
  autoApprove: Schema.optional(Schema.Array(Schema.String)),
});
export type McpStdioServerConfig = typeof McpStdioServerConfig.Type;

export const McpRemoteServerConfig = Schema.Struct({
  type: Schema.Literals(["http", "sse"]),
  url: TrimmedNonEmptyString,
  headers: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  disabled: Schema.optional(Schema.Boolean),
  autoApprove: Schema.optional(Schema.Array(Schema.String)),
});
export type McpRemoteServerConfig = typeof McpRemoteServerConfig.Type;

export const McpServerConfig = Schema.Union([
  McpRemoteServerConfig,
  McpStdioServerConfig,
]);
export type McpServerConfig = typeof McpServerConfig.Type;

export const McpConfigFile = Schema.Struct({
  mcpServers: Schema.Record(Schema.String, McpServerConfig),
});
export type McpConfigFile = typeof McpConfigFile.Type;

export const McpServerSource = Schema.Literals(["global", "project", "internal"]);
export type McpServerSource = typeof McpServerSource.Type;

export const DiscoveredMcpServer = Schema.Struct({
  name: TrimmedNonEmptyString,
  source: McpServerSource,
  config: McpServerConfig,
  enabled: Schema.Boolean,
  filePath: Schema.optional(Schema.String),
});
export type DiscoveredMcpServer = typeof DiscoveredMcpServer.Type;
