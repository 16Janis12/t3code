import { describe, expect, it } from "vite-plus/test";

import { isValidCron, matchesCron, resolveCronExpression } from "./AutomationCron.ts";

describe("AutomationCron", () => {
  describe("resolveCronExpression", () => {
    it("resolves aliases correctly", () => {
      expect(resolveCronExpression("@hourly")).toBe("0 * * * *");
      expect(resolveCronExpression("@daily")).toBe("0 0 * * *");
      expect(resolveCronExpression("@midnight")).toBe("0 0 * * *");
      expect(resolveCronExpression("@weekly")).toBe("0 0 * * 0");
      expect(resolveCronExpression("@monthly")).toBe("0 0 1 * *");
      expect(resolveCronExpression("@yearly")).toBe("0 0 1 1 *");
    });

    it("leaves standard expressions unchanged", () => {
      expect(resolveCronExpression("*/15 9 * * 1-5")).toBe("*/15 9 * * 1-5");
    });
  });

  describe("isValidCron", () => {
    it("validates correct expressions and aliases", () => {
      expect(isValidCron("* * * * *")).toBe(true);
      expect(isValidCron("0 0 * * *")).toBe(true);
      expect(isValidCron("*/5 * * * *")).toBe(true);
      expect(isValidCron("0 9-17 * * 1-5")).toBe(true);
      expect(isValidCron("0,15,30,45 * * * *")).toBe(true);
      expect(isValidCron("@daily")).toBe(true);
      expect(isValidCron("@hourly")).toBe(true);
    });

    it("rejects invalid expressions", () => {
      expect(isValidCron("invalid")).toBe(false);
      expect(isValidCron("* * *")).toBe(false);
      expect(isValidCron("60 * * * *")).toBe(false); // minute out of range
      expect(isValidCron("* 25 * * *")).toBe(false); // hour out of range
      expect(isValidCron("* * 32 * *")).toBe(false); // day out of range
      expect(isValidCron("* * * 13 *")).toBe(false); // month out of range
      expect(isValidCron("* * * * 8")).toBe(false); // day of week out of range
    });
  });

  describe("matchesCron", () => {
    it("matches wildcard expression", () => {
      const now = new Date("2026-09-08T11:15:00Z");
      expect(matchesCron("* * * * *", now)).toBe(true);
    });

    it("matches exact minute and hour", () => {
      const date = new Date("2026-09-08T09:30:00Z"); // 09:30 UTC, Tuesday (2)
      expect(matchesCron("30 9 * * *", date)).toBe(true);
      expect(matchesCron("31 9 * * *", date)).toBe(false);
      expect(matchesCron("30 10 * * *", date)).toBe(false);
    });

    it("matches step patterns", () => {
      const date15 = new Date("2026-09-08T11:15:00Z");
      const date20 = new Date("2026-09-08T11:20:00Z");
      expect(matchesCron("*/15 * * * *", date15)).toBe(true);
      expect(matchesCron("*/15 * * * *", date20)).toBe(false);
    });

    it("matches day of week range", () => {
      // 2026-09-08 is a Tuesday (2 in JS Date UTC)
      const tuesday = new Date("2026-09-08T12:00:00Z");
      // 2026-09-13 is a Sunday (0 in JS Date UTC)
      const sunday = new Date("2026-09-13T12:00:00Z");

      expect(matchesCron("0 12 * * 1-5", tuesday)).toBe(true);
      expect(matchesCron("0 12 * * 1-5", sunday)).toBe(false);
      expect(matchesCron("0 12 * * 0", sunday)).toBe(true);
      expect(matchesCron("0 12 * * 7", sunday)).toBe(true); // 7 also means Sunday
    });

    it("matches aliases like @daily and @hourly", () => {
      const midnight = new Date("2026-09-08T00:00:00Z");
      const nonMidnight = new Date("2026-09-08T00:01:00Z");
      expect(matchesCron("@daily", midnight)).toBe(true);
      expect(matchesCron("@daily", nonMidnight)).toBe(false);

      const topOfHour = new Date("2026-09-08T14:00:00Z");
      expect(matchesCron("@hourly", topOfHour)).toBe(true);
      expect(matchesCron("@hourly", nonMidnight)).toBe(false);
    });
  });
});
