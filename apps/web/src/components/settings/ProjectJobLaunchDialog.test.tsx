import { EnvironmentId, ProjectId, type T3ProjectFileJob } from "@t3tools/contracts";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("~/components/ui/button", () => ({
  Button: ({ children, ...props }: { readonly children?: ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("~/components/ui/dialog", () => {
  const Container = ({ children }: { readonly children?: ReactNode }) => <div>{children}</div>;
  return {
    Dialog: ({ open, children }: { readonly open: boolean; readonly children?: ReactNode }) =>
      open ? <div>{children}</div> : null,
    DialogDescription: Container,
    DialogFooter: Container,
    DialogHeader: Container,
    DialogPanel: Container,
    DialogPopup: Container,
    DialogTitle: Container,
    DialogClose: Container,
  };
});

vi.mock("~/components/ui/textarea", () => ({
  Textarea: (props: Record<string, unknown>) => (
    <div data-slot="textarea" {...props}>
      {String(props.value ?? "")}
    </div>
  ),
}));

vi.mock("~/components/ui/toast", () => ({
  toastManager: { add: vi.fn() },
}));

vi.mock("~/state/use-atom-command", () => ({
  useAtomCommand: () => vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

import { ProjectJobLaunchDialog } from "./ProjectJobLaunchDialog";

describe("ProjectJobLaunchDialog", () => {
  const sampleJob: T3ProjectFileJob = {
    id: "pentester",
    name: "Pentester",
    description: "Actively probes the application codebase for security weaknesses.",
    rolePrompt: "You are a professional security penetration tester.",
    promptTemplate: "Run a security probe targeting authentication and authorization flows.",
  };

  it("renders launch dialog with job details and prompt", () => {
    const markup = renderToStaticMarkup(
      <ProjectJobLaunchDialog
        open={true}
        onOpenChange={() => {}}
        job={sampleJob}
        environmentId={EnvironmentId.make("env-1")}
        projectId={ProjectId.make("proj-1")}
      />,
    );

    expect(markup).toContain("Launch Agent Job: Pentester");
    expect(markup).toContain("Actively probes the application codebase for security weaknesses.");
    expect(markup).toContain("You are a professional security penetration tester.");
    expect(markup).toContain("Task / Instructions for Agent");
    expect(markup).toContain("Launch Thread");
    expect(markup).toContain(
      "Run a security probe targeting authentication and authorization flows.",
    );
  });

  it("returns null when job is null", () => {
    const markup = renderToStaticMarkup(
      <ProjectJobLaunchDialog
        open={true}
        onOpenChange={() => {}}
        job={null}
        environmentId={EnvironmentId.make("env-1")}
        projectId={ProjectId.make("proj-1")}
      />,
    );

    expect(markup).toBe("");
  });
});
