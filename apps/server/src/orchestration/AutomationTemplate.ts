/**
 * AutomationTemplate - Simple template string renderer for automations.
 *
 * Supports `${var}` and `${nested.property}` syntax.
 * Automatically resolves dot-notated keys against nested objects or flat records.
 */

function getNestedValue(obj: unknown, path: string): unknown {
  if (obj == null) return undefined;
  if (typeof obj !== "object") return undefined;

  // Direct key lookup in case flat key exists (e.g. "pr.number")
  const record = obj as Record<string, unknown>;
  if (path in record) {
    return record[path];
  }

  // Nested property lookup
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Render a template string by interpolating expressions in `${...}` with values from `context`.
 * If an expression resolves to `null` or `undefined`, it is replaced with an empty string.
 */
export function renderTemplate(template: string, context: Record<string, unknown>): string {
  return template.replace(/\$\{([^}]+)\}/g, (match, path: string) => {
    const trimmedPath = path.trim();
    const value = getNestedValue(context, trimmedPath);
    if (value === undefined || value === null) {
      return "";
    }
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value);
  });
}
