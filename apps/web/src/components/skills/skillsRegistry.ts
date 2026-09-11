export interface SkillItem {
  readonly id: string;
  readonly name: string;
  readonly displayName?: string;
  readonly description: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly triggers?: readonly string[];
  readonly source: "antigravity" | "skillsllm" | "custom";
  readonly path?: string;
  readonly rawUrl?: string;
  readonly repoUrl?: string;
  readonly author?: string;
  readonly isBundle?: boolean;
}

export interface SkillBundle {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly skillIds: readonly string[];
}

export const SKILL_CATEGORIES = [
  "all",
  "development",
  "architecture",
  "infrastructure",
  "data-ai",
  "security",
  "testing",
  "workflow",
  "design-ui",
] as const;

export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

const ANTIGRAVITY_RAW_BASE =
  "https://raw.githubusercontent.com/rmyndharis/antigravity-skills/main/";
const ANTIGRAVITY_CATALOG_URL = `${ANTIGRAVITY_RAW_BASE}catalog.json`;
const ANTIGRAVITY_BUNDLES_URL = `${ANTIGRAVITY_RAW_BASE}bundles.json`;

export const CURATED_FEATURED_SKILLS: readonly SkillItem[] = [
  // Antigravity Core Skills
  {
    id: "backend-architect",
    name: "backend-architect",
    displayName: "Backend Architect",
    description:
      "Expert backend architect specializing in scalable API design, microservices, and distributed systems. Masters REST/GraphQL/gRPC, event-driven architectures, service mesh patterns, and resilience.",
    category: "architecture",
    tags: ["api", "microservices", "grpc", "graphql", "resilience"],
    triggers: ["create api", "microservices", "backend architecture", "distributed systems"],
    source: "antigravity",
    path: "skills/backend-architect/SKILL.md",
    rawUrl: `${ANTIGRAVITY_RAW_BASE}skills/backend-architect/SKILL.md`,
    repoUrl: "https://github.com/rmyndharis/antigravity-skills",
  },
  {
    id: "frontend-developer",
    name: "frontend-developer",
    displayName: "Frontend Developer",
    description:
      "Senior frontend engineer focused on modern React, state management, component hierarchy, responsive layouts, web vitals, and accessibility.",
    category: "development",
    tags: ["react", "ui", "state", "typescript", "web-vitals"],
    triggers: ["frontend", "react component", "ui state", "web vitals"],
    source: "antigravity",
    path: "skills/frontend-developer/SKILL.md",
    rawUrl: `${ANTIGRAVITY_RAW_BASE}skills/frontend-developer/SKILL.md`,
    repoUrl: "https://github.com/rmyndharis/antigravity-skills",
  },
  {
    id: "fastapi-pro",
    name: "fastapi-pro",
    displayName: "FastAPI Pro",
    description:
      "High-performance Python API design with FastAPI, Pydantic v2, async SQLAlchemy, dependency injection, and automatic OpenAPI generation.",
    category: "development",
    tags: ["python", "fastapi", "pydantic", "async", "sqlalchemy"],
    triggers: ["fastapi", "python api", "pydantic", "sqlalchemy async"],
    source: "antigravity",
    path: "skills/fastapi-pro/SKILL.md",
    rawUrl: `${ANTIGRAVITY_RAW_BASE}skills/fastapi-pro/SKILL.md`,
    repoUrl: "https://github.com/rmyndharis/antigravity-skills",
  },
  {
    id: "react-nextjs-pro",
    name: "react-nextjs-pro",
    displayName: "Next.js & React 19 Pro",
    description:
      "Production Next.js App Router patterns, React Server Components (RSC), server actions, streaming SSR, dynamic caching, and route handlers.",
    category: "development",
    tags: ["nextjs", "react19", "rsc", "server-actions", "ssr"],
    triggers: ["nextjs", "app router", "rsc", "server actions"],
    source: "antigravity",
    path: "skills/react-nextjs-pro/SKILL.md",
    rawUrl: `${ANTIGRAVITY_RAW_BASE}skills/react-nextjs-pro/SKILL.md`,
    repoUrl: "https://github.com/rmyndharis/antigravity-skills",
  },
  {
    id: "docker-master",
    name: "docker-master",
    displayName: "Docker Master",
    description:
      "Production-grade containerization, minimal multi-stage builds, rootless containers, docker-compose orchestration, and vulnerability caching.",
    category: "infrastructure",
    tags: ["docker", "containers", "compose", "devops", "security"],
    triggers: ["dockerfile", "docker compose", "containerize", "multistage build"],
    source: "antigravity",
    path: "skills/docker-master/SKILL.md",
    rawUrl: `${ANTIGRAVITY_RAW_BASE}skills/docker-master/SKILL.md`,
    repoUrl: "https://github.com/rmyndharis/antigravity-skills",
  },
  {
    id: "kubernetes-pro",
    name: "kubernetes-pro",
    displayName: "Kubernetes Pro",
    description:
      "Enterprise Kubernetes operations: Helm chart authoring, Ingress, cert-manager, Horizontal Pod Autoscaling (HPA), GitOps, and cluster resilience.",
    category: "infrastructure",
    tags: ["k8s", "helm", "gitops", "ingress", "cloud"],
    triggers: ["kubernetes", "k8s", "helm", "pod", "ingress"],
    source: "antigravity",
    path: "skills/kubernetes-pro/SKILL.md",
    rawUrl: `${ANTIGRAVITY_RAW_BASE}skills/kubernetes-pro/SKILL.md`,
    repoUrl: "https://github.com/rmyndharis/antigravity-skills",
  },
  {
    id: "postgres-expert",
    name: "postgres-expert",
    displayName: "PostgreSQL Expert",
    description:
      "Deep PostgreSQL query planning, EXPLAIN ANALYZE interpretation, indexing strategies (B-Tree, GIN, GiST), JSONB patterns, and zero-downtime migrations.",
    category: "data-ai",
    tags: ["postgres", "sql", "indexing", "explain", "migrations"],
    triggers: ["postgres query", "explain analyze", "sql index", "database migration"],
    source: "antigravity",
    path: "skills/postgres-expert/SKILL.md",
    rawUrl: `${ANTIGRAVITY_RAW_BASE}skills/postgres-expert/SKILL.md`,
    repoUrl: "https://github.com/rmyndharis/antigravity-skills",
  },
  {
    id: "typescript-wizard",
    name: "typescript-wizard",
    displayName: "TypeScript Wizard",
    description:
      "Advanced TypeScript type system patterns, template literal types, conditional types, recursive generics, branded types, and AST transformations.",
    category: "development",
    tags: ["typescript", "generics", "types", "compiler"],
    triggers: ["typescript types", "generics", "type narrowing", "branded types"],
    source: "antigravity",
    path: "skills/typescript-wizard/SKILL.md",
    rawUrl: `${ANTIGRAVITY_RAW_BASE}skills/typescript-wizard/SKILL.md`,
    repoUrl: "https://github.com/rmyndharis/antigravity-skills",
  },
  {
    id: "test-driven-development",
    name: "test-driven-development",
    displayName: "TDD & Test Architect",
    description:
      "Test-Driven Development practitioner: Red-Green-Refactor cycles, mock boundaries, contract testing, integration suites, and mutation testing.",
    category: "testing",
    tags: ["tdd", "unit-test", "vitest", "jest", "coverage"],
    triggers: ["write tests", "tdd", "unit test", "integration test", "vitest"],
    source: "antigravity",
    path: "skills/test-driven-development/SKILL.md",
    rawUrl: `${ANTIGRAVITY_RAW_BASE}skills/test-driven-development/SKILL.md`,
    repoUrl: "https://github.com/rmyndharis/antigravity-skills",
  },
  {
    id: "secure-code-auditor",
    name: "secure-code-auditor",
    displayName: "Secure Code Auditor",
    description:
      "Static code security analysis, OWASP Top 10 vulnerabilities, auth flow reviews, cryptographic hygiene, injection prevention, and secrets detection.",
    category: "security",
    tags: ["security", "owasp", "audit", "auth", "vulnerability"],
    triggers: ["security audit", "owasp", "check vulnerabilities", "auth review"],
    source: "antigravity",
    path: "skills/secure-code-auditor/SKILL.md",
    rawUrl: `${ANTIGRAVITY_RAW_BASE}skills/secure-code-auditor/SKILL.md`,
    repoUrl: "https://github.com/rmyndharis/antigravity-skills",
  },
  {
    id: "git-master",
    name: "git-master",
    displayName: "Git Master",
    description:
      "Advanced Git workflows, stacked pull requests, bisect debugging, interactive rebasing, filter-branch alternatives, and repo health recovery.",
    category: "workflow",
    tags: ["git", "rebase", "stacked-pr", "workflow", "vcs"],
    triggers: ["git rebase", "merge conflict", "git bisect", "stacked branch"],
    source: "antigravity",
    path: "skills/git-master/SKILL.md",
    rawUrl: `${ANTIGRAVITY_RAW_BASE}skills/git-master/SKILL.md`,
    repoUrl: "https://github.com/rmyndharis/antigravity-skills",
  },
  {
    id: "prompt-engineer",
    name: "prompt-engineer",
    displayName: "Prompt Engineer",
    description:
      "System prompt architecture, chain-of-thought steering, tool-use guidance, few-shot formatting, and agentic harness optimization.",
    category: "data-ai",
    tags: ["ai", "prompt", "llm", "system-prompt", "agents"],
    triggers: ["prompt engineering", "system prompt", "agent prompt", "llm steering"],
    source: "antigravity",
    path: "skills/prompt-engineer/SKILL.md",
    rawUrl: `${ANTIGRAVITY_RAW_BASE}skills/prompt-engineer/SKILL.md`,
    repoUrl: "https://github.com/rmyndharis/antigravity-skills",
  },

  // SkillsLLM Top Trending Skills
  {
    id: "ui-ux-pro-max",
    name: "ui-ux-pro-max",
    displayName: "UI/UX Pro Max",
    description:
      "AI-powered design intelligence with 79 UI styles, 192 color palettes, 74 font pairings, 119 UX guidelines, 105 curated icons, and 25 chart types across 22 tech stacks.",
    category: "design-ui",
    tags: ["ui", "ux", "design-system", "tailwind", "accessibility", "colors"],
    triggers: ["ui design", "ux review", "color palette", "design system", "tailwind style"],
    source: "skillsllm",
    rawUrl:
      "https://raw.githubusercontent.com/nextlevelbuilder/ui-ux-pro-max-skill/main/.claude/skills/ui-ux-pro-max/SKILL.md",
    repoUrl: "https://github.com/nextlevelbuilder/ui-ux-pro-max-skill",
    author: "NextLevelBuilder",
  },
  {
    id: "everything-claude-code",
    name: "everything-claude-code",
    displayName: "Everything Claude & Agent Code",
    description:
      "Curated patterns, instructions, workflows, and prompts for autonomous coding agents, multi-turn bug hunts, and high-impact refactorings.",
    category: "workflow",
    tags: ["claude-code", "workflows", "agents", "best-practices"],
    triggers: ["agent workflow", "coding patterns", "autonomous coding"],
    source: "skillsllm",
    rawUrl:
      "https://raw.githubusercontent.com/affaan-m/everything-claude-code/main/skills/everything-claude-code/SKILL.md",
    repoUrl: "https://github.com/affaan-m/everything-claude-code",
    author: "affaan-m",
  },
  {
    id: "anthropics-skills",
    name: "anthropics-skills",
    displayName: "Anthropic Agent Skills",
    description:
      "Standard collection of official agent skills designed for autonomous problem solving, tool chaining, file modifications, and test validation.",
    category: "workflow",
    tags: ["anthropic", "official", "agents", "skills"],
    triggers: ["agent skills", "tool chaining", "problem solving"],
    source: "skillsllm",
    rawUrl:
      "https://raw.githubusercontent.com/anthropics/skills/main/skills/webapp-testing/SKILL.md",
    repoUrl: "https://github.com/anthropics/skills",
    author: "Anthropic",
  },
  {
    id: "superpowers",
    name: "superpowers",
    displayName: "Superpowers Agent Kit",
    description:
      "Comprehensive toolkit for autonomous agents providing structured planning, test-driven execution, recursive verification, and subagent orchestration.",
    category: "workflow",
    tags: ["superpowers", "agent-kit", "planning", "subagents"],
    triggers: ["autonomous plan", "verification", "subagents"],
    source: "skillsllm",
    rawUrl:
      "https://raw.githubusercontent.com/obra/superpowers/main/skills/subagent-driven-development/SKILL.md",
    repoUrl: "https://github.com/obra/superpowers",
    author: "obra",
  },
  {
    id: "hermes-agent",
    name: "hermes-agent",
    displayName: "Hermes Multi-Turn Agent",
    description:
      "Advanced multi-turn reasoning and agentic research capabilities with structured hypothesis testing, validation checkpoints, and self-correction.",
    category: "data-ai",
    tags: ["reasoning", "research", "multi-turn", "validation"],
    triggers: ["deep research", "hypothesis testing", "self correction"],
    source: "skillsllm",
    rawUrl:
      "https://raw.githubusercontent.com/NousResearch/hermes-agent/main/skills/researcher/SKILL.md",
    repoUrl: "https://github.com/NousResearch/hermes-agent",
    author: "NousResearch",
  },
];

export const CURATED_BUNDLES: readonly SkillBundle[] = [
  {
    id: "core-dev",
    name: "Core Development",
    description: "Essential skills for backend, frontend, APIs, testing, and modern frameworks.",
    skillIds: [
      "backend-architect",
      "frontend-developer",
      "fastapi-pro",
      "react-nextjs-pro",
      "typescript-wizard",
      "test-driven-development",
    ],
  },
  {
    id: "cloud-infra",
    name: "Cloud & DevOps",
    description: "Production containers, Kubernetes, Postgres tuning, and infrastructure mastery.",
    skillIds: ["docker-master", "kubernetes-pro", "postgres-expert", "git-master"],
  },
  {
    id: "security-audit",
    name: "Security & Quality",
    description: "Vulnerability analysis, code security auditing, and test-driven architecture.",
    skillIds: ["secure-code-auditor", "test-driven-development", "git-master"],
  },
  {
    id: "ui-ux-design",
    name: "UI / UX & Design",
    description: "Design systems, frontend excellence, color palettes, and UI intelligence.",
    skillIds: ["ui-ux-pro-max", "frontend-developer", "react-nextjs-pro"],
  },
];

export function parseSkillMarkdownFrontmatter(content: string): {
  readonly name?: string | undefined;
  readonly description?: string | undefined;
} {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match || !match[1]) return {};
  const frontmatterBlock = match[1];

  let name: string | undefined;
  let description: string | undefined;

  const nameMatch = frontmatterBlock.match(/^name:\s*(.+)$/m);
  if (nameMatch && nameMatch[1]) {
    name = nameMatch[1].trim().replace(/^["']|["']$/g, "");
  }

  const descMatch = frontmatterBlock.match(/^description:\s*([^\n]+(?:\n[ \t]+[^\n]+)*)/m);
  if (descMatch && descMatch[1]) {
    description = descMatch[1]
      .replace(/\n[ \t]+/g, " ")
      .trim()
      .replace(/^["']|["']$/g, "");
  }

  return { name, description };
}

export function parseCustomSkillInput(input: string): {
  readonly type: "url" | "markdown";
  readonly url?: string;
  readonly markdown?: string;
  readonly inferredId: string;
  readonly inferredName: string;
  readonly inferredDescription: string;
} {
  const trimmed = input.trim();

  // If input looks like a URL
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    let rawUrl = trimmed;

    // Convert github.com blob/tree to raw.githubusercontent.com
    if (trimmed.includes("github.com")) {
      rawUrl = trimmed
        .replace("github.com/", "raw.githubusercontent.com/")
        .replace("/blob/", "/")
        .replace("/tree/", "/");

      // If URL points to a folder or doesn't end with SKILL.md, append SKILL.md
      if (!rawUrl.endsWith(".md")) {
        rawUrl = rawUrl.replace(/\/+$/, "") + "/SKILL.md";
      }
    }

    const segments = trimmed.split("/").filter(Boolean);
    let candidate = segments[segments.length - 1] ?? "custom-skill";
    if (candidate.toLowerCase() === "skill.md" || candidate.toLowerCase() === "readme.md") {
      candidate = segments[segments.length - 2] ?? candidate;
    }
    const inferredId = candidate
      .replace(/\.md$/i, "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-");

    return {
      type: "url",
      url: rawUrl,
      inferredId,
      inferredName: formatSkillTitle(inferredId),
      inferredDescription: `Custom skill loaded from ${trimmed}`,
    };
  }

  // Otherwise assume raw Markdown
  const frontmatter = parseSkillMarkdownFrontmatter(trimmed);
  const inferredName = frontmatter.name || "custom-skill";
  const inferredId = inferredName.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  const inferredDescription =
    frontmatter.description || "Custom skill dropped in directly via markdown.";

  return {
    type: "markdown",
    markdown: trimmed,
    inferredId,
    inferredName,
    inferredDescription,
  };
}

const STORAGE_CATALOG_KEY = "t3code.skills.catalog.cache";

export async function fetchAntigravityCatalog(): Promise<SkillItem[]> {
  try {
    const res = await fetch(ANTIGRAVITY_CATALOG_URL, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) {
      throw new Error(`Failed to fetch catalog (${res.status})`);
    }
    const data = (await res.json()) as { skills: Array<Record<string, unknown>> };
    if (!Array.isArray(data.skills)) {
      return [...CURATED_FEATURED_SKILLS];
    }

    const remoteSkills: SkillItem[] = data.skills.map((s) => {
      const id = String(s.id || s.name || "").trim();
      const name = String(s.name || id).trim();
      const description = String(s.description || "").trim();
      const category = String(s.category || "development").toLowerCase();
      const tags = Array.isArray(s.tags) ? s.tags.map(String) : [];
      const triggers = Array.isArray(s.triggers) ? s.triggers.map(String) : [];
      const path = String(s.path || `skills/${id}/SKILL.md`);
      const rawUrl = `${ANTIGRAVITY_RAW_BASE}${path}`;

      return {
        id,
        name,
        displayName: formatSkillTitle(name),
        description,
        category: normalizeCategory(category),
        tags,
        triggers,
        source: "antigravity" as const,
        path,
        rawUrl,
        repoUrl: "https://github.com/rmyndharis/antigravity-skills",
      };
    });

    // Merge: keep featured skills (e.g. skillsllm ones) and append remote ones
    const seen = new Set<string>();
    const merged: SkillItem[] = [];

    for (const item of CURATED_FEATURED_SKILLS) {
      seen.add(item.id);
      merged.push(item);
    }

    for (const item of remoteSkills) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        merged.push(item);
      }
    }

    // Cache locally
    try {
      localStorage.setItem(STORAGE_CATALOG_KEY, JSON.stringify(merged));
    } catch {
      // ignore storage quota errors
    }

    return merged;
  } catch {
    // Fall back to cached or default
    try {
      const cached = localStorage.getItem(STORAGE_CATALOG_KEY);
      if (cached) {
        return JSON.parse(cached) as SkillItem[];
      }
    } catch {
      // fallback
    }
    return [...CURATED_FEATURED_SKILLS];
  }
}

export async function fetchSkillContent(skill: SkillItem): Promise<string> {
  if (skill.rawUrl) {
    const res = await fetch(skill.rawUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      throw new Error(`Failed to load skill from ${skill.rawUrl} (${res.status})`);
    }
    return await res.text();
  }

  // Fallback synthetic content if no raw URL
  return `---
name: ${skill.id}
description: ${skill.description}
---

# ${skill.displayName || skill.name}

${skill.description}

## Triggers
${skill.triggers?.map((t) => `- ${t}`).join("\n") || "None specified"}
`;
}

export function formatSkillTitle(rawName: string): string {
  return rawName
    .replace(/[-_]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function normalizeCategory(cat: string): string {
  if (cat.includes("dev") || cat.includes("code") || cat.includes("software")) return "development";
  if (cat.includes("arch") || cat.includes("system")) return "architecture";
  if (cat.includes("infra") || cat.includes("k8s") || cat.includes("ops") || cat.includes("docker"))
    return "infrastructure";
  if (cat.includes("data") || cat.includes("ai") || cat.includes("ml")) return "data-ai";
  if (cat.includes("sec") || cat.includes("audit") || cat.includes("auth")) return "security";
  if (cat.includes("test") || cat.includes("qa")) return "testing";
  if (cat.includes("flow") || cat.includes("git") || cat.includes("ci")) return "workflow";
  if (cat.includes("ui") || cat.includes("ux") || cat.includes("design") || cat.includes("css"))
    return "design-ui";
  return "development";
}
