import { describe, expect, it } from "vitest";

import { isAppError } from "@yourtoolshq/server/errors";

import {
  addAmounts,
  DECIMAL_PRECISION,
  parseDecimalAmount,
  subtractAmounts,
} from "~/modules/investment-statements/domain/decimal-money";

describe("parseDecimalAmount", () => {
  it("accepts plain decimals", () => {
    expect(parseDecimalAmount("100.25")?.toFixed()).toBe("100.25");
    expect(parseDecimalAmount(".5")?.toFixed()).toBe("0.5");
    expect(parseDecimalAmount("-12")?.toFixed()).toBe("-12");
  });

  it("rejects scientific, hex, and non-decimal syntax", () => {
    for (const value of ["1e10", "1E-3", "0x10", "12abc", "1,000.00"]) {
      try {
        parseDecimalAmount(value);
        throw new Error(`Expected rejection for ${value}`);
      } catch (error) {
        expect(isAppError(error) && error.code).toBe("invalid_input");
      }
    }
  });

  it("bounds significant digits and fraction length", () => {
    const tooManyDigits = "1".repeat(DECIMAL_PRECISION + 1);
    try {
      parseDecimalAmount(tooManyDigits);
      throw new Error("Expected digit limit rejection");
    } catch (error) {
      expect(isAppError(error) && error.code).toBe("invalid_input");
    }

    try {
      parseDecimalAmount(`1.${"1".repeat(21)}`);
      throw new Error("Expected fraction limit rejection");
    } catch (error) {
      expect(isAppError(error) && error.code).toBe("invalid_input");
    }
  });

  it("preserves cents when combining large integers within input bounds", () => {
    const large = "9".repeat(DECIMAL_PRECISION - 2);
    const withCents = `${large}.99`;
    const sum = addAmounts([large, "0.01"]);
    expect(sum.toFixed()).toBe(`${large}.01`);
    const difference = subtractAmounts(withCents, large);
    expect(difference?.toFixed()).toBe("0.99");
  });
});
