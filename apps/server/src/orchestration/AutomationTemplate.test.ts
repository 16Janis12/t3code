import { describe, expect, it } from "vite-plus/test";

import { renderTemplate } from "./AutomationTemplate.ts";

describe("AutomationTemplate", () => {
  it("interpolates simple variables", () => {
    const template = "Hello ${name}!";
    const context = { name: "Antigravity" };
    expect(renderTemplate(template, context)).toBe("Hello Antigravity!");
  });

  it("interpolates nested object properties", () => {
    const template = "Review PR #${pr.number}: ${pr.title} (Branch: ${pr.headRef})";
    const context = {
      pr: {
        number: 101,
        title: "Add automations",
        headRef: "feature/automations",
      },
    };
    expect(renderTemplate(template, context)).toBe(
      "Review PR #101: Add automations (Branch: feature/automations)",
    );
  });

  it("handles flat dotted keys", () => {
    const template = "Issue #${issue.number} created";
    const context = {
      "issue.number": 42,
    };
    expect(renderTemplate(template, context)).toBe("Issue #42 created");
  });

  it("replaces missing variables with empty strings", () => {
    const template = "PR #${pr.number} - ${pr.missingField}";
    const context = {
      pr: { number: 7 },
    };
    expect(renderTemplate(template, context)).toBe("PR #7 - ");
  });

  it("serializes objects as JSON", () => {
    const template = "Payload: ${payload}";
    const context = {
      payload: { status: "ok", count: 3 },
    };
    expect(renderTemplate(template, context)).toBe('Payload: {"status":"ok","count":3}');
  });
});
