import {
  DEFAULT_SERVER_SETTINGS,
  type McpRemoteServerConfig,
  type McpServerConfig,
  type McpStdioServerConfig,
  type McpTransportKind,
} from "@t3tools/contracts";
import { PlusIcon, ServerIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { toastManager } from "../ui/toast";
import {
  usePrimarySettings,
  usePrimarySettingsAvailable,
  useUpdatePrimarySettings,
} from "~/hooks/useSettings";

import { SettingResetButton, SettingsRow, SettingsSection } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";

const TRANSPORT_LABELS: Record<McpTransportKind, string> = {
  stdio: "stdio (local process)",
  http: "http (remote server)",
  sse: "sse (server-sent events)",
};

function parseCommandLineArgs(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  const matches = trimmed.match(/[^\s"']+|"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'/g);
  if (!matches) return [];
  return matches.map((token) => {
    if (token.startsWith('"') && token.endsWith('"')) {
      return token.slice(1, -1).replace(/\\"/g, '"');
    }
    if (token.startsWith("'") && token.endsWith("'")) {
      return token.slice(1, -1).replace(/\\'/g, "'");
    }
    return token;
  });
}

export function McpSettingsSection() {
  const settings = usePrimarySettings();
  const updateSettings = useUpdatePrimarySettings();
  const primaryAvailable = usePrimarySettingsAvailable();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [serverPendingDelete, setServerPendingDelete] = useState<string | null>(null);

  const enableProjectMcp =
    settings.enableProjectMcpServers ?? DEFAULT_SERVER_SETTINGS.enableProjectMcpServers;
  const mcpServers = settings.mcpServers ?? {};
  const serverEntries = Object.entries(mcpServers);

  const handleToggleProjectMcp = (checked: boolean) => {
    updateSettings({
      enableProjectMcpServers: checked,
    });
  };

  const handleResetProjectMcp = () => {
    updateSettings({
      enableProjectMcpServers: DEFAULT_SERVER_SETTINGS.enableProjectMcpServers,
    });
  };

  const handleDeleteServer = (name: string) => {
    updateSettings({
      mcpServers: {
        [name]: null as unknown as McpServerConfig,
      },
    });
    setServerPendingDelete(null);
    toastManager.add({
      type: "success",
      title: `MCP server "${name}" removed`,
    });
  };

  return (
    <>
      <SettingsSection id="mcp" title="Model Context Protocol (MCP)">
        <SettingsRow
          {...searchableSetting("project-mcp-servers")}
          description="Automatically discover and load MCP servers defined in .mcp.json or mcp.json in workspace roots."
          resetAction={
            enableProjectMcp !== DEFAULT_SERVER_SETTINGS.enableProjectMcpServers ? (
              <SettingResetButton
                label="reset project MCP servers"
                onClick={handleResetProjectMcp}
              />
            ) : null
          }
          control={
            <Switch
              disabled={!primaryAvailable}
              checked={enableProjectMcp}
              onCheckedChange={handleToggleProjectMcp}
              aria-label="Project MCP servers"
            />
          }
        />

        <SettingsRow
          title="Global MCP servers"
          description="External MCP servers available across all provider sessions."
          serverScoped
          control={
            <Button
              size="sm"
              variant="outline"
              disabled={!primaryAvailable}
              onClick={() => setIsAddOpen(true)}
            >
              <PlusIcon className="mr-1.5 size-3.5" />
              Add Server
            </Button>
          }
        >
          {serverEntries.length === 0 ? (
            <div className="my-2 flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 py-6 text-center">
              <ServerIcon className="mb-2 size-6 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">No global MCP servers configured.</p>
              <p className="mt-0.5 text-xs text-muted-foreground/80">
                Add stdio, SSE, or HTTP servers to provide extra capabilities to your agents.
              </p>
            </div>
          ) : (
            <div className="my-2 flex flex-col divide-y divide-border/40 overflow-hidden rounded-lg border border-border/60">
              {serverEntries.map(([name, config]) => (
                <div
                  key={name}
                  className="flex items-center justify-between p-3 transition-colors hover:bg-muted/30"
                >
                  <div className="flex min-w-0 flex-col gap-1 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{name}</span>
                      <Badge
                        variant="outline"
                        className="px-1.5 py-0 font-mono text-[10px] uppercase"
                      >
                        {config.type ?? ("url" in config ? "http" : "stdio")}
                      </Badge>
                    </div>
                    <div className="max-w-lg truncate font-mono text-xs text-muted-foreground">
                      {"url" in config
                        ? config.url
                        : `${config.command}${config.args?.length ? ` ${config.args.join(" ")}` : ""}`}
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setServerPendingDelete(name)}
                    aria-label={`Remove MCP server ${name}`}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </SettingsRow>
      </SettingsSection>

      <AddMcpServerDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        onAddServer={(name, config) => {
          updateSettings({
            mcpServers: {
              [name]: config,
            },
          });
          setIsAddOpen(false);
          toastManager.add({
            type: "success",
            title: `Added MCP server "${name}"`,
          });
        }}
        existingNames={Object.keys(mcpServers)}
      />

      <Dialog
        open={serverPendingDelete !== null}
        onOpenChange={(open) => !open && setServerPendingDelete(null)}
      >
        <DialogPopup className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove MCP Server</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove the MCP server &ldquo;{serverPendingDelete}&rdquo;?
              Agents will no longer have access to its tools.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button
              variant="destructive"
              onClick={() => {
                if (serverPendingDelete) {
                  handleDeleteServer(serverPendingDelete);
                }
              }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </>
  );
}

interface AddMcpServerDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onAddServer: (name: string, config: McpServerConfig) => void;
  readonly existingNames: ReadonlyArray<string>;
}

export function AddMcpServerDialog({
  open,
  onOpenChange,
  onAddServer,
  existingNames,
}: AddMcpServerDialogProps) {
  const [name, setName] = useState("");
  const [transport, setTransport] = useState<McpTransportKind>("stdio");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [url, setUrl] = useState("");
  const [envJson, setEnvJson] = useState("");
  const [headersJson, setHeadersJson] = useState("");
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setTransport("stdio");
    setCommand("");
    setArgs("");
    setUrl("");
    setEnvJson("");
    setHeadersJson("");
    setError(null);
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Server name is required.");
      return;
    }
    if (existingNames.includes(trimmedName)) {
      setError(`Server "${trimmedName}" already exists.`);
      return;
    }

    if (transport === "stdio") {
      const trimmedCommand = command.trim();
      if (!trimmedCommand) {
        setError("Command is required for stdio transport.");
        return;
      }
      let env: Record<string, string> | undefined;
      if (envJson.trim()) {
        try {
          const parsed = JSON.parse(envJson.trim());
          if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
            setError("Environment variables must be a JSON object.");
            return;
          }
          const invalid = Object.values(parsed).some(
            (v) => typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean",
          );
          if (invalid) {
            setError("Environment variable values must be strings.");
            return;
          }
          env = Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, String(v)]));
        } catch {
          setError("Invalid JSON for environment variables.");
          return;
        }
      }

      const parsedArgs = args.trim() ? parseCommandLineArgs(args) : undefined;

      const config: McpStdioServerConfig = {
        type: "stdio",
        command: trimmedCommand,
        ...(parsedArgs && parsedArgs.length > 0 ? { args: parsedArgs } : {}),
        ...(env ? { env } : {}),
      };

      onAddServer(trimmedName, config);
      resetForm();
    } else {
      const trimmedUrl = url.trim();
      if (!trimmedUrl) {
        setError("Server URL is required.");
        return;
      }
      try {
        new URL(trimmedUrl);
      } catch {
        setError("Please enter a valid URL.");
        return;
      }

      let headers: Record<string, string> | undefined;
      if (headersJson.trim()) {
        try {
          const parsed = JSON.parse(headersJson.trim());
          if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
            setError("Headers must be a JSON object.");
            return;
          }
          const invalid = Object.values(parsed).some(
            (v) => typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean",
          );
          if (invalid) {
            setError("Header values must be strings.");
            return;
          }
          headers = Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, String(v)]));
        } catch {
          setError("Invalid JSON for headers.");
          return;
        }
      }

      const config: McpRemoteServerConfig = {
        type: transport as "http" | "sse",
        url: trimmedUrl,
        ...(headers ? { headers } : {}),
      };

      onAddServer(trimmedName, config);
      resetForm();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) resetForm();
        onOpenChange(nextOpen);
      }}
    >
      <DialogPopup className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add MCP Server</DialogTitle>
          <DialogDescription>
            Configure an external Model Context Protocol server for your agents.
          </DialogDescription>
        </DialogHeader>

        <DialogPanel>
          <form
            id="add-mcp-server-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            className="grid gap-4"
          >
            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                {error}
              </div>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="mcp-server-name">Server Name</Label>
              <Input
                id="mcp-server-name"
                size="sm"
                placeholder="e.g. filesystem"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                autoFocus
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="mcp-transport">Transport</Label>
              <Select
                value={transport}
                onValueChange={(val) => {
                  setTransport(val as McpTransportKind);
                  setError(null);
                }}
              >
                <SelectTrigger id="mcp-transport" size="sm">
                  <SelectValue>{TRANSPORT_LABELS[transport]}</SelectValue>
                </SelectTrigger>
                <SelectPopup align="start" alignItemWithTrigger={false}>
                  <SelectItem value="stdio">stdio (local process)</SelectItem>
                  <SelectItem value="http">http (remote server)</SelectItem>
                  <SelectItem value="sse">sse (server-sent events)</SelectItem>
                </SelectPopup>
              </Select>
            </div>

            {transport === "stdio" ? (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="mcp-command">Command</Label>
                  <Input
                    id="mcp-command"
                    size="sm"
                    placeholder="e.g. npx"
                    value={command}
                    onChange={(e) => {
                      setCommand(e.target.value);
                      setError(null);
                    }}
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="mcp-args">Arguments</Label>
                  <Input
                    id="mcp-args"
                    size="sm"
                    placeholder="e.g. -y @modelcontextprotocol/server-filesystem /path"
                    value={args}
                    onChange={(e) => {
                      setArgs(e.target.value);
                      setError(null);
                    }}
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="mcp-env">Environment Variables (JSON object, optional)</Label>
                  <Input
                    id="mcp-env"
                    size="sm"
                    placeholder='{"API_KEY": "..."}'
                    value={envJson}
                    onChange={(e) => {
                      setEnvJson(e.target.value);
                      setError(null);
                    }}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="mcp-url">Server URL</Label>
                  <Input
                    id="mcp-url"
                    size="sm"
                    placeholder="http://localhost:3000/mcp"
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      setError(null);
                    }}
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="mcp-headers">Headers (JSON object, optional)</Label>
                  <Input
                    id="mcp-headers"
                    size="sm"
                    placeholder='{"Authorization": "Bearer ..."}'
                    value={headersJson}
                    onChange={(e) => {
                      setHeadersJson(e.target.value);
                      setError(null);
                    }}
                  />
                </div>
              </>
            )}
          </form>
        </DialogPanel>

        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button onClick={handleSave}>Save Server</Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
