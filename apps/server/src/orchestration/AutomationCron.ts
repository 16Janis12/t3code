/**
 * AutomationCron - Pure utilities for parsing and evaluating cron schedules.
 *
 * Supports standard 5-part cron syntax:
 *   minute (0-59)
 *   hour (0-23)
 *   day of month (1-31)
 *   month (1-12)
 *   day of week (0-7, 0 and 7 = Sunday)
 *
 * Supports wildcards (*), steps (*\/15, 1-10/2), ranges (1-5), and lists (1,2,5).
 * Supports standard aliases (@hourly, @daily, @midnight, @weekly, @monthly, @yearly).
 */

const CRON_ALIASES: Readonly<Record<string, string>> = {
  "@hourly": "0 * * * *",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@weekly": "0 0 * * 0",
  "@monthly": "0 0 1 * *",
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
};

interface FieldBoundary {
  readonly min: number;
  readonly max: number;
  readonly isDayOfWeek?: boolean;
}

const FIELD_BOUNDARIES: ReadonlyArray<FieldBoundary> = [
  { min: 0, max: 59 }, // minute
  { min: 0, max: 23 }, // hour
  { min: 1, max: 31 }, // day of month
  { min: 1, max: 12 }, // month
  { min: 0, max: 7, isDayOfWeek: true }, // day of week
];

export function resolveCronExpression(expression: string): string {
  const trimmed = expression.trim();
  const aliased = CRON_ALIASES[trimmed.toLowerCase()];
  return aliased ?? trimmed;
}

function matchCronItem(
  item: string,
  value: number,
  min: number,
  max: number,
  isDayOfWeek: boolean,
): boolean {
  if (item === "*") return true;

  if (item.startsWith("*/")) {
    const step = parseInt(item.slice(2), 10);
    if (Number.isNaN(step) || step <= 0) return false;
    return (value - min) % step === 0;
  }

  if (item.includes("/")) {
    const [rangePart, stepPart] = item.split("/");
    if (!rangePart || !stepPart) return false;
    const step = parseInt(stepPart, 10);
    if (Number.isNaN(step) || step <= 0) return false;

    if (rangePart === "*") {
      return (value - min) % step === 0;
    }

    if (rangePart.includes("-")) {
      const [startStr, endStr] = rangePart.split("-");
      if (!startStr || !endStr) return false;
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (Number.isNaN(start) || Number.isNaN(end) || start > end) return false;
      return value >= start && value <= end && (value - start) % step === 0;
    }
    return false;
  }

  if (item.includes("-")) {
    const [startStr, endStr] = item.split("-");
    if (!startStr || !endStr) return false;
    let start = parseInt(startStr, 10);
    let end = parseInt(endStr, 10);
    if (Number.isNaN(start) || Number.isNaN(end)) return false;
    if (isDayOfWeek) {
      if (start === 7) start = 0;
      if (end === 7) end = 0;
      if (start > end) {
        // e.g. 5-1 (Friday to Monday)
        return value >= start || value <= end;
      }
    }
    return value >= start && value <= end;
  }

  let target = parseInt(item, 10);
  if (Number.isNaN(target)) return false;
  if (isDayOfWeek && target === 7) target = 0;
  return value === target;
}

function matchCronField(
  fieldStr: string,
  value: number,
  min: number,
  max: number,
  isDayOfWeek = false,
): boolean {
  const normalizedValue = isDayOfWeek && value === 7 ? 0 : value;
  const items = fieldStr.split(",");
  return items.some((item) => matchCronItem(item.trim(), normalizedValue, min, max, isDayOfWeek));
}

/**
 * Check whether a cron expression matches the specified date.
 * Evaluates in UTC by default for deterministic time handling across environments.
 */
export function matchesCron(expression: string, date: Date = new Date()): boolean {
  const resolved = resolveCronExpression(expression);
  const parts = resolved.split(/\s+/).filter(Boolean);
  if (parts.length !== 5) return false;

  const currentValues: ReadonlyArray<number> = [
    date.getUTCMinutes(),
    date.getUTCHours(),
    date.getUTCDate(),
    date.getUTCMonth() + 1,
    date.getUTCDay(),
  ];

  return parts.every((part, idx) => {
    const boundary = FIELD_BOUNDARIES[idx]!;
    return matchCronField(
      part,
      currentValues[idx]!,
      boundary.min,
      boundary.max,
      boundary.isDayOfWeek ?? false,
    );
  });
}

/**
 * Validate that a string is a recognized cron expression or alias.
 */
export function isValidCron(expression: string): boolean {
  const resolved = resolveCronExpression(expression);
  const parts = resolved.split(/\s+/).filter(Boolean);
  if (parts.length !== 5) return false;

  return parts.every((part, idx) => {
    const boundary = FIELD_BOUNDARIES[idx]!;
    const items = part.split(",");
    return items.every((item) => {
      const trimmed = item.trim();
      if (trimmed === "*") return true;
      if (trimmed.startsWith("*/")) {
        const step = parseInt(trimmed.slice(2), 10);
        return !Number.isNaN(step) && step > 0 && step <= boundary.max;
      }
      if (trimmed.includes("/")) {
        const [, stepPart] = trimmed.split("/");
        const step = parseInt(stepPart ?? "", 10);
        return !Number.isNaN(step) && step > 0;
      }
      if (trimmed.includes("-")) {
        const [startStr, endStr] = trimmed.split("-");
        const start = parseInt(startStr ?? "", 10);
        const end = parseInt(endStr ?? "", 10);
        return (
          !Number.isNaN(start) && !Number.isNaN(end) && start >= boundary.min && end <= boundary.max
        );
      }
      const val = parseInt(trimmed, 10);
      return !Number.isNaN(val) && val >= boundary.min && val <= boundary.max;
    });
  });
}
