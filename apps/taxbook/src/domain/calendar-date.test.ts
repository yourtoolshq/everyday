import { describe, expect, it } from "vitest";

import {
  formatCalendarDate,
  parseTypedCalendarDate,
} from "@yourtoolshq/ui/calendar-date";

describe("parseTypedCalendarDate", () => {
  it("keeps a typed ISO date on that calendar day", () => {
    const date = parseTypedCalendarDate("2025-06-01");
    expect(date).toBeDefined();
    expect(formatCalendarDate(date!)).toBe("2025-06-01");
  });

  it("accepts the date picker input format", () => {
    const date = parseTypedCalendarDate("June 01, 2025");
    expect(formatCalendarDate(date!)).toBe("2025-06-01");
  });

  it("ignores a partial year", () => {
    expect(parseTypedCalendarDate("2025")).toBeUndefined();
    expect(parseTypedCalendarDate("2025-06")).toBeUndefined();
    expect(parseTypedCalendarDate("not a date")).toBeUndefined();
  });
});
