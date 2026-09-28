import type { z } from "zod";

import type { DeductionSettings } from "~/lib/paycheck-deductions";
import {
  applyPaycheckIncomeTax,
  calculateNetPay,
  isIncomeTaxSplit,
  paycheckInput,
} from "~/lib/paycheck-deductions";

export type CreatePaycheckCommand = z.infer<typeof paycheckInput>;

export type PaycheckWriteValues = {
  grossPayCents: number;
  incomeTaxCents: number;
  federalIncomeTaxCents: number;
  manitobaIncomeTaxCents: number;
  cppCents: number;
  cpp2Cents: number;
  eiCents: number;
  wiCents: number;
  ltdCents: number;
  extendedHealthCents: number;
  travelMedicalCents: number;
  unionDuesCents: number;
  otherDeductionsCents: number;
  netPayCents: number;
  payDate: string;
  periodStartDate: string;
  periodEndDate: string;
};

/** Apply employment deduction settings to a create/update command. */
export function buildPaycheckWriteValues(
  input: CreatePaycheckCommand,
  deductionSettings: DeductionSettings,
): PaycheckWriteValues {
  const split = isIncomeTaxSplit(deductionSettings);
  const amounts = applyPaycheckIncomeTax(
    {
      grossPayCents: input.grossPayCents,
      incomeTaxCents: input.incomeTaxCents,
      federalIncomeTaxCents: input.federalIncomeTaxCents,
      manitobaIncomeTaxCents: input.manitobaIncomeTaxCents,
      cppCents: input.cppCents,
      cpp2Cents: input.cpp2Cents,
      eiCents: input.eiCents,
      wiCents: input.wiCents,
      ltdCents: input.ltdCents,
      extendedHealthCents: input.extendedHealthCents,
      travelMedicalCents: input.travelMedicalCents,
      unionDuesCents: input.unionDuesCents,
      otherDeductionsCents: input.otherDeductionsCents,
    },
    split,
  );

  return {
    ...amounts,
    netPayCents: calculateNetPay(amounts),
    payDate: input.payDate,
    periodStartDate: input.periodStartDate,
    periodEndDate: input.periodEndDate,
  };
}
