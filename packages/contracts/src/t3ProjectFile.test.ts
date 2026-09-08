import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";

import {
  AutomationAction,
  AutomationCronTrigger,
  AutomationGitHubIssueTrigger,
  AutomationGitHubPrTrigger,
  AutomationTrigger,
  T3ProjectFile,
  T3ProjectFileAutomation,
} from "./t3ProjectFile.ts";

const decode = Schema.decodeUnknownSync(T3ProjectFile);
const decodeAutomation = Schema.decodeUnknownSync(T3ProjectFileAutomation);
const decodeTrigger = Schema.decodeUnknownSync(AutomationTrigger);
const decodeAction = Schema.decodeUnknownSync(AutomationAction);

describe("T3ProjectFile", () => {
  it("decodes a full project file with scripts and automations", () => {
    const decoded = decode({
      $schema: "https://t3.codes/schema/t3.json",
      iconPath: "assets/logo.svg",
      scripts: [
        {
          name: "Dev",
          command: "pnpm dev",
          icon: "play",
          runOnWorktreeCreate: false,
          previewUrl: "http://localhost:3000",
          autoOpenPreview: true,
        },
        { name: "Test", command: "pnpm test" },
      ],
      automations: [
        {
          id: "nightly-tests",
          name: "Nightly Tests",
          enabled: true,
          trigger: {
            type: "cron",
            schedule: "0 0 * * *",
          },
          action: {
            type: "script",
            command: "pnpm test",
          },
        },
        {
          id: "pr-reviewer",
          name: "PR Reviewer",
          trigger: {
            type: "github_pr",
            events: ["opened", "synchronize"],
            targetBranches: ["main"],
          },
          action: {
            type: "thread",
            prompt: "Review PR #${pr.number}: ${pr.title}",
          },
        },
        {
          id: "issue-triage",
          name: "Issue Triage",
          trigger: {
            type: "github_issue",
            events: ["opened", "labeled"],
            labels: ["triage"],
          },
          action: {
            type: "thread",
            prompt: "Triage issue #${issue.number}: ${issue.title}",
            title: "Triage Issue #${issue.number}",
          },
        },
      ],
    });

    expect(decoded.iconPath).toBe("assets/logo.svg");
    expect(decoded.scripts).toHaveLength(2);
    expect(decoded.scripts?.[1]).toEqual({ name: "Test", command: "pnpm test" });
    expect(decoded.automations).toHaveLength(3);
    expect(decoded.automations?.[0]?.id).toBe("nightly-tests");
    expect(decoded.automations?.[0]?.trigger).toEqual({
      type: "cron",
      schedule: "0 0 * * *",
    });
    expect(decoded.automations?.[0]?.action).toEqual({
      type: "script",
      command: "pnpm test",
    });
    expect(decoded.automations?.[1]?.trigger).toEqual({
      type: "github_pr",
      events: ["opened", "synchronize"],
      targetBranches: ["main"],
    });
    expect(decoded.automations?.[2]?.trigger).toEqual({
      type: "github_issue",
      events: ["opened", "labeled"],
      labels: ["triage"],
    });
  });

  it("decodes an empty object and ignores unknown fields", () => {
    expect(decode({})).toEqual({});
    expect(decode({ futureField: true })).toEqual({});
  });

  it("trims icon paths and script fields", () => {
    const decoded = decode({
      iconPath: " assets/logo.svg ",
      scripts: [{ name: " Dev ", command: " pnpm dev " }],
    });

    expect(decoded.iconPath).toBe("assets/logo.svg");
    expect(decoded.scripts?.[0]).toEqual({ name: "Dev", command: "pnpm dev" });
  });

  it("rejects scripts without a command", () => {
    expect(() => decode({ scripts: [{ name: "Dev" }] })).toThrow();
  });

  it("rejects unknown script icons", () => {
    expect(() =>
      decode({ scripts: [{ name: "Dev", command: "pnpm dev", icon: "rocket" }] }),
    ).toThrow();
  });

  it("decodes defaultThreadEnvMode and rejects unknown modes", () => {
    expect(decode({ defaultThreadEnvMode: "worktree" }).defaultThreadEnvMode).toBe("worktree");
    expect(decode({ defaultThreadEnvMode: "local" }).defaultThreadEnvMode).toBe("local");
    expect(() => decode({ defaultThreadEnvMode: "remote" })).toThrow();
  });

  describe("automations", () => {
    it("decodes cron trigger and aliases", () => {
      const trigger = decodeTrigger({
        type: "cron",
        schedule: "*/15 * * * *",
      });
      expect(trigger).toEqual({
        type: "cron",
        schedule: "*/15 * * * *",
      });
    });

    it("decodes github_pr trigger", () => {
      const trigger = decodeTrigger({
        type: "github_pr",
        events: ["opened", "reopened"],
      });
      expect(trigger).toEqual({
        type: "github_pr",
        events: ["opened", "reopened"],
      });
    });

    it("rejects invalid github_pr events", () => {
      expect(() =>
        decodeTrigger({
          type: "github_pr",
          events: ["invalid_event"],
        }),
      ).toThrow();
    });

    it("decodes github_issue trigger", () => {
      const trigger = decodeTrigger({
        type: "github_issue",
        events: ["opened", "labeled"],
        labels: ["bug"],
      });
      expect(trigger).toEqual({
        type: "github_issue",
        events: ["opened", "labeled"],
        labels: ["bug"],
      });
    });

    it("rejects invalid github_issue events", () => {
      expect(() =>
        decodeTrigger({
          type: "github_issue",
          events: ["deleted"],
        }),
      ).toThrow();
    });

    it("decodes thread action with prompt and title", () => {
      const action = decodeAction({
        type: "thread",
        prompt: "Review PR #${pr.number}",
        title: "PR Review #${pr.number}",
      });
      expect(action).toEqual({
        type: "thread",
        prompt: "Review PR #${pr.number}",
        title: "PR Review #${pr.number}",
      });
    });

    it("decodes script action with command or scriptName", () => {
      const actionCmd = decodeAction({
        type: "script",
        command: "npm test",
      });
      expect(actionCmd).toEqual({
        type: "script",
        command: "npm test",
      });

      const actionScript = decodeAction({
        type: "script",
        scriptName: "Setup",
      });
      expect(actionScript).toEqual({
        type: "script",
        scriptName: "Setup",
      });
    });

    it("rejects automation without id or name", () => {
      expect(() =>
        decodeAutomation({
          name: "Test",
          trigger: { type: "cron", schedule: "* * * * *" },
          action: { type: "script", command: "ls" },
        }),
      ).toThrow();

      expect(() =>
        decodeAutomation({
          id: "test",
          trigger: { type: "cron", schedule: "* * * * *" },
          action: { type: "script", command: "ls" },
        }),
      ).toThrow();
    });
  });
});
