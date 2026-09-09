import {
  DEFAULT_CLIENT_SETTINGS,
  DEFAULT_SERVER_SETTINGS,
  DEFAULT_UNIFIED_SETTINGS,
} from "@t3tools/contracts";
import { act, StrictMode } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mockUpdateSettings = vi.fn();
let currentSettings = {
  ...DEFAULT_UNIFIED_SETTINGS,
  mcpServers: {
    existingServer: {
      transport: "stdio" as const,
      command: "node",
      args: ["server.js"],
    },
  },
};

vi.mock("~/hooks/useSettings", () => ({
  PRIMARY_SETTINGS_UNAVAILABLE_MESSAGE: "Connect to an environment",
  useClientSettings: (selector: (settings: typeof DEFAULT_CLIENT_SETTINGS) => unknown) =>
    selector(DEFAULT_CLIENT_SETTINGS),
  usePrimarySettingsAvailable: () => true,
  usePrimarySettings: () => currentSettings,
  useUpdatePrimarySettings: () => mockUpdateSettings,
}));

vi.mock("~/components/ui/dialog", () => ({
  Dialog: ({ children, open }: any) => (open ? <div>{children}</div> : null),
  DialogPopup: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogClose: ({ render, children }: any) => render || <button>{children}</button>,
}));

import { McpSettingsSection } from "./McpSettings";

let renderer: ReactTestRenderer | undefined;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mockUpdateSettings.mockClear();
  currentSettings = {
    ...DEFAULT_UNIFIED_SETTINGS,
    mcpServers: {
      existingServer: {
        transport: "stdio" as const,
        command: "node",
        args: ["server.js"],
      },
    },
  };
});

afterEach(async () => {
  await act(() => renderer?.unmount());
  vi.unstubAllGlobals();
});

describe("McpSettingsSection", () => {
  it("renders existing MCP servers and project toggle", () => {
    act(() => {
      renderer = create(
        <StrictMode>
          <McpSettingsSection />
        </StrictMode>,
      );
    });

    const root = renderer!.root;
    expect(root.findByProps({ "aria-label": "Project MCP servers" })).toBeDefined();

    // Check that existingServer is displayed
    const serverName = root.findAll((el) => el.children?.includes("existingServer"));
    expect(serverName.length).toBeGreaterThan(0);
  });

  it("opens add server dialog and saves a stdio server", async () => {
    act(() => {
      renderer = create(
        <StrictMode>
          <McpSettingsSection />
        </StrictMode>,
      );
    });

    const root = renderer!.root;
    const addButtons = root.findAll((el) => el.children?.includes("Add Server"));
    expect(addButtons.length).toBeGreaterThan(0);

    await act(() => {
      addButtons[0]!.props.onClick();
    });

    const nameInput = root.findByProps({ placeholder: "e.g. filesystem" });
    await act(() => {
      nameInput.props.onChange({ target: { value: "testServer" } });
    });

    const cmdInput = root.findByProps({ placeholder: "e.g. npx" });
    await act(() => {
      cmdInput.props.onChange({ target: { value: "npx" } });
    });

    const argsInput = root.findByProps({
      placeholder: "e.g. -y @modelcontextprotocol/server-filesystem /path",
    });
    await act(() => {
      argsInput.props.onChange({ target: { value: "-y @mcp/server" } });
    });

    const saveButtons = root.findAll((el) => el.children?.includes("Save Server"));
    expect(saveButtons.length).toBeGreaterThan(0);
    await act(() => {
      saveButtons[0]!.props.onClick();
    });

    expect(mockUpdateSettings).toHaveBeenCalledWith({
      mcpServers: {
        testServer: {
          type: "stdio",
          command: "npx",
          args: ["-y", "@mcp/server"],
        },
      },
    });
  });

  it("handles deleting an MCP server", async () => {
    act(() => {
      renderer = create(
        <StrictMode>
          <McpSettingsSection />
        </StrictMode>,
      );
    });

    const root = renderer!.root;
    const deleteButton = root.findByProps({ "aria-label": "Remove MCP server existingServer" });
    await act(() => {
      deleteButton.props.onClick();
    });

    // Confirmation dialog should be open, find and click the Remove button in the dialog
    const removeButtons = root.findAll(
      (el) => el.type === "button" && el.children?.includes("Remove"),
    );
    expect(removeButtons.length).toBeGreaterThan(0);
    await act(() => {
      removeButtons[0]!.props.onClick();
    });

    expect(mockUpdateSettings).toHaveBeenCalledWith({
      mcpServers: {
        existingServer: null,
      },
    });
  });
});
