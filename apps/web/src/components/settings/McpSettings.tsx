import {
  DEFAULT_SERVER_SETTINGS,
  type McpRemoteServerConfig,
  type McpServerConfig,
  type McpStdioServerConfig,
  type McpTransportKind,
} from "@t3tools/contracts";
import { PlusIcon, Trash2Icon, ServerIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Switch } from "../ui/switch";
import { toastManager } from "../ui/toast";
import {
  usePrimarySettings,
  usePrimarySettingsAvailable,
  useUpdatePrimarySettings,
} from "~/hooks/useSettings";

import {
  SettingResetButton,
  SettingsRow,
  SettingsSection,
} from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";

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

      <div className="flex flex-col gap-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-foreground">Global MCP Servers</h4>
            <p className="text-xs text-muted-foreground">
              External MCP servers available across all provider sessions.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!primaryAvailable}
            onClick={() => setIsAddOpen(true)}
          >
            <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
            Add Server
          </Button>
        </div>

        {serverEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 py-6 text-center">
            <ServerIcon className="h-6 w-6 text-muted-foreground/60 mb-2" />
            <p className="text-sm text-muted-foreground">No global MCP servers configured.</p>
            <p className="text-xs text-muted-foreground/80 mt-0.5">
              Add stdio, SSE, or HTTP servers to provide extra capabilities to your agents.
            </p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border/40 rounded-lg border border-border/60">
            {serverEntries.map(([name, config]) => (
              <div
                key={name}
                className="flex items-center justify-between p-3 transition-colors hover:bg-muted/30"
              >
                <div className="flex flex-col gap-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground truncate">{name}</span>
                    <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0">
                      {config.type ?? ("url" in config ? "http" : "stdio")}
                    </Badge>
                  </div>
                  <div className="text-xs font-mono text-muted-foreground truncate max-w-lg">
                    {"url" in config
                      ? config.url
                      : `${config.command}${config.args?.length ? ` ${config.args.join(" ")}` : ""}`}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => setServerPendingDelete(name)}
                  aria-label={`Remove MCP server ${name}`}
                >
                  <Trash2Icon className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

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
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>Remove MCP Server</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove the MCP server &ldquo;{serverPendingDelete}&rdquo;? Agents will no
              longer have access to its tools.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
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
    </SettingsSection>
  );
}

interface AddMcpServerDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onAddServer: (name: string, config: McpServerConfig) => void;
  readonly existingNames: ReadonlyArray<string>;
}

function AddMcpServerDialog({
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
          env = JSON.parse(envJson.trim());
          if (typeof env !== "object" || env === null || Array.isArray(env)) {
            setError("Environment variables must be a JSON object.");
            return;
          }
        } catch {
          setError("Invalid JSON for environment variables.");
          return;
        }
      }

      const parsedArgs = args.trim()
        ? args.trim().split(/\s+/).filter(Boolean)
        : undefined;

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
        setError("URL is required for remote transport.");
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
          headers = JSON.parse(headersJson.trim());
          if (typeof headers !== "object" || headers === null || Array.isArray(headers)) {
            setError("Headers must be a JSON object.");
            return;
          }
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

        <div className="flex flex-col gap-3 py-2 text-sm">
          {error && (
            <div className="rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">Server Name</label>
            <Input
              size="sm"
              placeholder="e.g. filesystem"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">Transport</label>
            <Select
              value={transport}
              onValueChange={(val) => {
                setTransport(val as McpTransportKind);
                setError(null);
              }}
            >
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectPopup align="start">
                <SelectItem value="stdio">stdio (local process)</SelectItem>
                <SelectItem value="http">http (remote server)</SelectItem>
                <SelectItem value="sse">sse (server-sent events)</SelectItem>
              </SelectPopup>
            </Select>
          </div>

          {transport === "stdio" ? (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Command</label>
                <Input
                  size="sm"
                  placeholder="e.g. npx"
                  value={command}
                  onChange={(e) => {
                    setCommand(e.target.value);
                    setError(null);
                  }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Arguments</label>
                <Input
                  size="sm"
                  placeholder="e.g. -y @modelcontextprotocol/server-filesystem /path"
                  value={args}
                  onChange={(e) => {
                    setArgs(e.target.value);
                    setError(null);
                  }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">
                  Environment Variables (JSON object, optional)
                </label>
                <Input
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
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Server URL</label>
                <Input
                  size="sm"
                  placeholder="http://localhost:3000/mcp"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setError(null);
                  }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">
                  Headers (JSON object, optional)
                </label>
                <Input
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
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={handleSave}>Save Server</Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
