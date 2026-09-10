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
  T3ProjectFileJob,
} from "./t3ProjectFile.ts";

const decode = Schema.decodeUnknownSync(T3ProjectFile);
const decodeAutomation = Schema.decodeUnknownSync(T3ProjectFileAutomation);
const decodeTrigger = Schema.decodeUnknownSync(AutomationTrigger);
const decodeAction = Schema.decodeUnknownSync(AutomationAction);
const decodeJob = Schema.decodeUnknownSync(T3ProjectFileJob);

describe("T3ProjectFile", () => {
  it("decodes a full project file with scripts, jobs, and automations", () => {
    const decoded = decode({
      $schema: "https://t3.codes/schema/t3.json",
      iconPath: "assets/logo.svg",
      jobs: [
        {
          id: "pentester",
          name: "Pentester",
          description: "Performs penetration testing",
          rolePrompt: "Think like an attacker",
          promptTemplate: "Analyze attack surface for PR #${pr.number}",
        },
      ],
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
          id: "pr-review",
          name: "PR Review",
          trigger: {
            type: "github_pr",
            events: ["opened"],
          },
          action: {
            type: "thread",
            jobId: "pr-reviewer",
            prompt: "Please review PR #${pr.number}",
            modelSelection: {
              instanceId: "anthropic",
              model: "claude-3-5-sonnet",
            },
          },
        },
      ],
    });

    expect(decoded.iconPath).toBe("assets/logo.svg");
    expect(decoded.jobs).toHaveLength(1);
    expect(decoded.jobs?.[0]?.name).toBe("Pentester");
    expect(decoded.scripts).toHaveLength(2);
    expect(decoded.automations).toHaveLength(2);
    const prAction = decoded.automations?.[1]?.action;
    expect(prAction).toEqual({
      type: "thread",
      jobId: "pr-reviewer",
      prompt: "Please review PR #${pr.number}",
      modelSelection: {
        instanceId: "anthropic",
        model: "claude-3-5-sonnet",
      },
    });
  });

  it("decodes an empty object and ignores unknown fields", () => {
    expect(decode({})).toEqual({});
    expect(decode({ futureField: true })).toEqual({});
  });

  it("decodes defaultThreadEnvMode and rejects unknown modes", () => {
    expect(decode({ defaultThreadEnvMode: "worktree" }).defaultThreadEnvMode).toBe("worktree");
    expect(decode({ defaultThreadEnvMode: "local" }).defaultThreadEnvMode).toBe("local");
    expect(() => decode({ defaultThreadEnvMode: "remote" })).toThrow();
  });

  it("trims whitespace from string fields", () => {
    const decoded = decode({
      iconPath: "  assets/logo.svg  ",
      scripts: [{ name: "  Dev  ", command: "  pnpm dev  " }],
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

  it("enforces max scripts limit", () => {
    const scripts = Array.from({ length: 51 }, (_, i) => ({
      name: `script-${i}`,
      command: `echo ${i}`,
    }));
    expect(() => decode({ scripts })).toThrow();
  });

  it("enforces max automations limit", () => {
    const automations = Array.from({ length: 51 }, (_, i) => ({
      id: `auto-${i}`,
      name: `Auto ${i}`,
      trigger: { type: "cron" as const, schedule: "* * * * *" },
      action: { type: "script" as const, command: `echo ${i}` },
    }));
    expect(() => decode({ automations })).toThrow();
  });

  describe("T3ProjectFileJob", () => {
    it("decodes valid job with required and optional fields", () => {
      const job = decodeJob({
        id: "security-reviewer",
        name: "Security Reviewer",
        description: "Scans for OWASP issues",
        rolePrompt: "You are a security auditor",
        promptTemplate: "Audit PR #${pr.number}",
        runtimeMode: "approval-required",
      });

      expect(job).toEqual({
        id: "security-reviewer",
        name: "Security Reviewer",
        description: "Scans for OWASP issues",
        rolePrompt: "You are a security auditor",
        promptTemplate: "Audit PR #${pr.number}",
        runtimeMode: "approval-required",
      });
    });

    it("rejects job with empty rolePrompt or name", () => {
      expect(() =>
        decodeJob({
          id: "tester",
          name: "",
          rolePrompt: "Valid",
        }),
      ).toThrow();

      expect(() =>
        decodeJob({
          id: "tester",
          name: "Tester",
          rolePrompt: "   ",
        }),
      ).toThrow();
    });
  });

  describe("Automations Schema", () => {
    it("decodes cron trigger with schedule", () => {
      const trigger = decodeTrigger({
        type: "cron",
        schedule: "0 9 * * 1-5",
      });
      expect(trigger).toEqual({
        type: "cron",
        schedule: "0 9 * * 1-5",
      });
    });

    it("decodes github_pr trigger with events and branches", () => {
      const trigger = decodeTrigger({
        type: "github_pr",
        events: ["opened", "reopened"],
        targetBranches: ["main"],
      });
      expect(trigger).toEqual({
        type: "github_pr",
        events: ["opened", "reopened"],
        targetBranches: ["main"],
      });
    });

    it("decodes github_pr trigger with default events when omitted", () => {
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

    it("decodes manual trigger", () => {
      const trigger = decodeTrigger({
        type: "manual",
      });
      expect(trigger).toEqual({
        type: "manual",
      });
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

    it("decodes thread action with prompt, jobId and title", () => {
      const action = decodeAction({
        type: "thread",
        jobId: "pr-reviewer",
        prompt: "Review PR #${pr.number}",
        title: "PR Review #${pr.number}",
      });
      expect(action).toEqual({
        type: "thread",
        jobId: "pr-reviewer",
        prompt: "Review PR #${pr.number}",
        title: "PR Review #${pr.number}",
      });
    });

    it("decodes thread action with jobId without prompt", () => {
      const action = decodeAction({
        type: "thread",
        jobId: "pr-reviewer",
      });
      expect(action).toEqual({
        type: "thread",
        jobId: "pr-reviewer",
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
