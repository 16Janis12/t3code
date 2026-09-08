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
    Dialog: Container,
    DialogDescription: Container,
    DialogFooter: Container,
    DialogHeader: Container,
    DialogPanel: Container,
    DialogPopup: Container,
    DialogTitle: Container,
    DialogClose: Container,
  };
});

vi.mock("~/components/ui/input", () => ({
  Input: (props: Record<string, unknown>) => <input {...props} />,
}));

vi.mock("~/components/ui/textarea", () => ({
  Textarea: (props: Record<string, unknown>) => <textarea {...props} />,
}));

vi.mock("~/components/ui/switch", () => ({
  Switch: (props: Record<string, unknown>) => <input type="checkbox" {...props} />,
}));

vi.mock("~/components/ui/checkbox", () => ({
  Checkbox: (props: Record<string, unknown>) => <input type="checkbox" {...props} />,
}));

import { ProjectAutomationEditorDialog } from "./ProjectAutomationEditorDialog";

describe("ProjectAutomationEditorDialog", () => {
  it("renders create automation dialog with trigger and action selectors", () => {
    const markup = renderToStaticMarkup(
      <ProjectAutomationEditorDialog
        open={true}
        onOpenChange={() => {}}
        automation={null}
        existingIds={[]}
        onSave={() => {}}
      />,
    );

    expect(markup).toContain("Add Automation");
    expect(markup).toContain("Trigger");
    expect(markup).toContain("Cron Schedule");
    expect(markup).toContain("GitHub PR");
    expect(markup).toContain("GitHub Issue");
    expect(markup).toContain("Action");
    expect(markup).toContain("Agent Thread");
    expect(markup).toContain("Run Script / Command");
    expect(markup).toContain("Create Automation");
  });
});
