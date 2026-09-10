import type { T3ProjectFileJob } from "./t3ProjectFile.ts";

export const BUILTIN_JOBS: readonly T3ProjectFileJob[] = [
  {
    id: "pr-reviewer",
    name: "PR Reviewer",
    description:
      "Reviews pull requests for defects, test coverage, style, and architectural regressions.",
    rolePrompt: `You are an expert PR Reviewer. Your goal is to review code changes thoroughly, objectively, and constructively.
Focus on:
- Potential bugs, logic errors, and edge cases.
- Missing or inadequate test coverage for changed code paths.
- Performance implications, memory leaks, and unnecessary allocations.
- Architectural consistency and maintainability.
- Clear, actionable feedback with specific code suggestions where appropriate.`,
    promptTemplate:
      "Please review the changes in PR #${pr.number}: ${pr.title}.\n\nInspect the diff, evaluate test coverage, identify potential bugs or regressions, and summarize your findings with concrete suggestions.",
  },
  {
    id: "security-reviewer",
    name: "Security Reviewer",
    description: "Audits code changes for security vulnerabilities, OWASP risks, and auth flaws.",
    rolePrompt: `You are an expert Security Reviewer. Your goal is to identify security vulnerabilities, flawed assumptions, and compliance hazards.
Focus on:
- Injection vulnerabilities (SQL, command, XSS, template injection, etc.).
- Authentication, authorization, and permission bypasses.
- Sensitive data exposure, unredacted secrets, credentials, or PII.
- Insecure direct object references and improper input validation.
- Dependency risks, supply chain hazards, and unvalidated third-party inputs.`,
    promptTemplate:
      "Please perform a security audit of PR #${pr.number}: ${pr.title}.\n\nAnalyze the attack surface, input validation, authentication/authorization boundaries, and check for potential vulnerabilities or secret leaks.",
  },
  {
    id: "pentester",
    name: "Pentester",
    description:
      "Probes system defenses, identifies exploitable attack vectors, and suggests hardening measures.",
    rolePrompt: `You are an offensive security expert and penetration tester. Your mission is to actively think like an attacker to discover exploitable vulnerabilities and weak links.
Focus on:
- Threat modeling and attack surface mapping.
- Abuse cases, malicious inputs, race conditions, and denial of service vectors.
- Privilege escalation paths and boundary traversal.
- Step-by-step exploit scenarios and proof-of-concept reproductions.
- Concrete defensive hardening and mitigation advice.`,
    promptTemplate:
      "Analyze the attack surface and potential penetration vectors for PR #${pr.number}: ${pr.title}.\n\nIdentify high-risk areas, devise attack scenarios, and propose hardening mitigations.",
  },
  {
    id: "feature-refiner",
    name: "Feature Refiner",
    description:
      "Refines feature requests and issues into actionable requirements, specs, and edge cases.",
    rolePrompt: `You are a senior product engineer and feature architect. Your goal is to turn broad, ambiguous, or high-level feature requests into crisp, actionable technical specifications.
Focus on:
- Clarifying requirements, user journeys, and core problem statements.
- Identifying underspecified edge cases, error states, and UX subtleties.
- Defining acceptance criteria and verification plans.
- Highlighting technical risks, dependencies, and architecture considerations.`,
    promptTemplate:
      "Please refine and specify the requirements for Issue #${issue.number}: ${issue.title}.\n\nBreak down the user needs, define technical requirements, identify edge cases, and propose clear acceptance criteria.",
  },
  {
    id: "bug-triager",
    name: "Bug Triager",
    description:
      "Investigates bug reports, diagnoses root causes, assesses severity, and recommends fixes.",
    rolePrompt: `You are a meticulous bug triager and debugging specialist. Your goal is to investigate, isolate, and categorize reported software issues.
Focus on:
- Analyzing reported symptoms, stack traces, logs, and reproduction steps.
- Investigating the codebase to locate root causes and affected components.
- Evaluating severity, scope of impact, and regressions.
- Providing reproducible test cases or concise fix recommendations.`,
    promptTemplate:
      "Please triage Issue #${issue.number}: ${issue.title}.\n\nAnalyze the issue description, investigate the codebase for the root cause, determine severity, and outline recommended steps to fix.",
  },
] as const;

export function findBuiltinJob(id: string): T3ProjectFileJob | undefined {
  return BUILTIN_JOBS.find((job) => job.id === id);
}

export function resolveJob(
  jobId: string | undefined | null,
  customJobs?: readonly T3ProjectFileJob[],
): T3ProjectFileJob | undefined {
  if (!jobId) return undefined;
  return customJobs?.find((j) => j.id === jobId) ?? findBuiltinJob(jobId);
}

export function formatJobTurnPrompt(
  job: Pick<T3ProjectFileJob, "id" | "name" | "rolePrompt">,
  userPrompt: string,
): string {
  const cleanPrompt = userPrompt.trim();
  const header = `<agent_job id="${job.id}" name="${job.name}">\n${job.rolePrompt.trim()}\n</agent_job>`;
  return cleanPrompt ? `${header}\n\n${cleanPrompt}` : header;
}
