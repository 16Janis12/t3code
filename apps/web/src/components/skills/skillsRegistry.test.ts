import { describe, expect, it } from "vite-plus/test";
import {
  formatSkillTitle,
  parseCustomSkillInput,
  parseSkillMarkdownFrontmatter,
} from "./skillsRegistry";

describe("skillsRegistry", () => {
  describe("parseSkillMarkdownFrontmatter", () => {
    it("extracts name and description from standard markdown frontmatter", () => {
      const md = `---
name: my-awesome-skill
description: Comprehensive testing guidelines for web applications.
---
# Skill Content Here
`;
      const result = parseSkillMarkdownFrontmatter(md);
      expect(result.name).toBe("my-awesome-skill");
      expect(result.description).toBe("Comprehensive testing guidelines for web applications.");
    });

    it("handles quoted names and multiline descriptions", () => {
      const md = `---
name: "special-skill"
description: "A skill that handles
  multiple lines gracefully."
---
`;
      const result = parseSkillMarkdownFrontmatter(md);
      expect(result.name).toBe("special-skill");
      expect(result.description).toBe("A skill that handles multiple lines gracefully.");
    });

    it("returns empty object for markdown without frontmatter", () => {
      const md = `# Just a title\nSome body without frontmatter`;
      const result = parseSkillMarkdownFrontmatter(md);
      expect(result.name).toBeUndefined();
      expect(result.description).toBeUndefined();
    });
  });

  describe("parseCustomSkillInput", () => {
    it("converts GitHub blob URLs to raw user content URLs", () => {
      const url =
        "https://github.com/rmyndharis/antigravity-skills/blob/main/skills/api-designer/SKILL.md";
      const result = parseCustomSkillInput(url);
      expect(result.type).toBe("url");
      expect(result.url).toBe(
        "https://raw.githubusercontent.com/rmyndharis/antigravity-skills/main/skills/api-designer/SKILL.md",
      );
      expect(result.inferredId).toBe("api-designer");
      expect(result.inferredName).toBe("Api Designer");
    });

    it("handles direct raw.githubusercontent.com URLs", () => {
      const url =
        "https://raw.githubusercontent.com/anthropics/skills/main/skills/webapp-testing/SKILL.md";
      const result = parseCustomSkillInput(url);
      expect(result.type).toBe("url");
      expect(result.url).toBe(url);
      expect(result.inferredId).toBe("webapp-testing");
      expect(result.inferredName).toBe("Webapp Testing");
    });

    it("parses raw pasted markdown with frontmatter", () => {
      const md = `---
name: docker-expert
description: Deep containerization and multi-stage build optimization.
---
# Docker Expert Instructions
Run tests in isolated containers.`;
      const result = parseCustomSkillInput(md);
      expect(result.type).toBe("markdown");
      expect(result.inferredId).toBe("docker-expert");
      expect(result.inferredName).toBe("docker-expert");
      expect(result.inferredDescription).toBe(
        "Deep containerization and multi-stage build optimization.",
      );
    });
  });

  describe("formatSkillTitle", () => {
    it("converts kebab-case strings to title case", () => {
      expect(formatSkillTitle("react-nextjs-pro")).toBe("React Nextjs Pro");
      expect(formatSkillTitle("api-designer")).toBe("Api Designer");
    });
  });
});
