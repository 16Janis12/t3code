import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("~/components/ui/button", () => ({
  Button: ({ children, ...props }: { readonly children?: ReactNode }) => (
    <button {...props}>{children}</button>
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

import { ProjectJobsSection } from "./ProjectJobsSection";

describe("ProjectJobsSection", () => {
  it("renders built-in job presets", () => {
    const markup = renderToStaticMarkup(
      <ProjectJobsSection
        environmentId={"env-local" as any}
        workspaceRoot="/workspace"
        t3File={{
          status: "valid",
          file: { jobs: [] },
          scripts: [],
          automations: [],
          jobs: [],
          rawContents: "{}",
        }}
      />,
    );

    expect(markup).toContain("Agent Jobs");
    expect(markup).toContain("PR Reviewer");
    expect(markup).toContain("Security Reviewer");
    expect(markup).toContain("Pentester");
    expect(markup).toContain("Feature Refiner");
    expect(markup).toContain("Bug Triager");
    expect(markup).toContain("Add custom job");
    expect(markup).toContain("Launch");
  });

  it("renders custom project jobs defined in t3.json", () => {
    const markup = renderToStaticMarkup(
      <ProjectJobsSection
        environmentId={"env-local" as any}
        workspaceRoot="/workspace"
        t3File={{
          status: "valid",
          file: {
            jobs: [
              {
                id: "lead-pentester",
                name: "Lead Pentester",
                description: "Probes web APIs",
                rolePrompt: "You are a lead pentester.",
              },
            ],
          },
          scripts: [],
          automations: [],
          jobs: [
            {
              id: "lead-pentester",
              name: "Lead Pentester",
              description: "Probes web APIs",
              rolePrompt: "You are a lead pentester.",
            },
          ],
          rawContents: "{}",
        }}
      />,
    );

    expect(markup).toContain("Lead Pentester");
    expect(markup).toContain("Probes web APIs");
    expect(markup).toContain("lead-pentester");
    expect(markup).toContain("Custom");
  });
});
