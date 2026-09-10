import { describe, expect, it } from "vite-plus/test";

import { BUILTIN_JOBS, findBuiltinJob, formatJobTurnPrompt, resolveJob } from "./builtinJobs.ts";
import type { T3ProjectFileJob } from "./t3ProjectFile.ts";

describe("builtinJobs", () => {
  it("defines standard presets with required fields", () => {
    expect(BUILTIN_JOBS.length).toBeGreaterThanOrEqual(5);

    const ids = BUILTIN_JOBS.map((j) => j.id);
    expect(ids).toContain("pr-reviewer");
    expect(ids).toContain("security-reviewer");
    expect(ids).toContain("pentester");
    expect(ids).toContain("feature-refiner");
    expect(ids).toContain("bug-triager");

    for (const job of BUILTIN_JOBS) {
      expect(job.id).toBeTruthy();
      expect(job.name).toBeTruthy();
      expect(job.description).toBeTruthy();
      expect(job.rolePrompt).toBeTruthy();
      expect(job.promptTemplate).toBeTruthy();
    }
  });

  it("findBuiltinJob looks up jobs by id", () => {
    expect(findBuiltinJob("pentester")?.name).toBe("Pentester");
    expect(findBuiltinJob("non-existent")).toBeUndefined();
  });

  it("resolveJob checks custom jobs before builtin presets", () => {
    const customJob: T3ProjectFileJob = {
      id: "pr-reviewer",
      name: "Custom Reviewer",
      rolePrompt: "Custom instructions",
    };

    const resolved = resolveJob("pr-reviewer", [customJob]);
    expect(resolved?.name).toBe("Custom Reviewer");

    const fallback = resolveJob("pr-reviewer", []);
    expect(fallback?.name).toBe("PR Reviewer");

    expect(resolveJob(undefined)).toBeUndefined();
  });

  it("formatJobTurnPrompt prefixes instructions with agent_job tag", () => {
    const job: T3ProjectFileJob = {
      id: "security-reviewer",
      name: "Security Reviewer",
      rolePrompt: "Analyze vulnerabilities",
    };

    const formatted = formatJobTurnPrompt(job, "Review PR #42");
    expect(formatted).toBe(
      `<agent_job id="security-reviewer" name="Security Reviewer">\nAnalyze vulnerabilities\n</agent_job>\n\nReview PR #42`,
    );

    const withoutPrompt = formatJobTurnPrompt(job, "");
    expect(withoutPrompt).toBe(
      `<agent_job id="security-reviewer" name="Security Reviewer">\nAnalyze vulnerabilities\n</agent_job>`,
    );
  });
});
