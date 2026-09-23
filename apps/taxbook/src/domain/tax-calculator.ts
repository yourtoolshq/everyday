import { rules2026Manitoba as rules } from "./tax-rules/2026-manitoba";

export type PersonEstimateInput = {
  id: number;
  name: string;
  employmentIncomeCents: number;
  interestIncomeCents: number;
  selfEmploymentIncomeCents: number;
  rrspDeductionCents: number;
  fhsaDeductionCents: number;
  professionalDuesCents: number;
  incomeTaxWithheldCents: number;
  cppCents: number;
  cpp2Cents: number;
  eiCents: number;
  currentTuitionCents: number;
  federalTuitionCarryforwardCents: number;
  manitobaTuitionCarryforwardCents: number;
};

export type HouseholdCreditsInput = {
  claimantPersonId: number;
  medicalExpensesCents: number;
  eligibleRentCents: number;
  eligibleRentMonths: number;
  eligibleSchoolTaxCents: number;
  homeownerAdvanceReceivedCents: number;
  homeOwnershipDays: number;
};

const mulRate = (cents: number, basisPoints: number) =>
  Math.round((cents * basisPoints) / 10_000);

export function progressiveTax(
  cents: number,
  brackets: readonly (readonly [number, number])[],
) {
  let remaining = Math.max(0, cents);
  let lower = 0;
  let tax = 0;
  for (const [upper, rate] of brackets) {
    const amount = Math.min(remaining, upper - lower);
    if (amount <= 0) break;
    tax += mulRate(amount, rate);
    remaining -= amount;
    lower = upper;
  }
  return tax;
}

function phasedAmount(
  maximum: number,
  minimum: number,
  income: number,
  start: number,
  end: number,
) {
  if (income <= start) return maximum;
  if (income >= end) return minimum;
  return Math.round(
    maximum - ((income - start) * (maximum - minimum)) / (end - start),
  );
}

function payrollAmounts(input: PersonEstimateInput) {
  const pensionable = Math.max(
    0,
    Math.min(input.employmentIncomeCents, rules.cpp.ympeCents) -
      rules.cpp.basicExemptionCents,
  );
  const allowedCpp = Math.min(
    input.cppCents,
    mulRate(
      pensionable,
      rules.cpp.baseRateBps + rules.cpp.firstAdditionalRateBps,
    ),
    rules.cpp.maximumCppCents,
  );
  const baseCpp = Math.min(
    allowedCpp,
    mulRate(pensionable, rules.cpp.baseRateBps),
  );
  const enhancedCpp = Math.max(0, allowedCpp - baseCpp);
  const cpp2Base = Math.max(
    0,
    Math.min(input.employmentIncomeCents, rules.cpp.yampeCents) -
      rules.cpp.ympeCents,
  );
  const allowedCpp2 = Math.min(
    input.cpp2Cents,
    mulRate(cpp2Base, rules.cpp.secondAdditionalRateBps),
    rules.cpp.maximumCpp2Cents,
  );
  const allowedEi = Math.min(
    input.eiCents,
    mulRate(
      Math.min(input.employmentIncomeCents, rules.ei.maximumInsurableCents),
      rules.ei.rateBps,
    ),
    rules.ei.maximumPremiumCents,
  );
  return {
    baseCpp,
    enhancedCpp,
    allowedCpp2,
    allowedEi,
    cppOverpaymentCents: Math.max(0, input.cppCents - allowedCpp),
    cpp2OverpaymentCents: Math.max(0, input.cpp2Cents - allowedCpp2),
    eiOverpaymentCents: Math.max(0, input.eiCents - allowedEi),
  };
}

function selfEmploymentCpp(
  input: PersonEstimateInput,
  payroll: ReturnType<typeof payrollAmounts>,
) {
  const earnings = Math.max(0, input.selfEmploymentIncomeCents);
  const employmentFirst = Math.max(
    0,
    Math.min(input.employmentIncomeCents, rules.cpp.ympeCents) -
      rules.cpp.basicExemptionCents,
  );
  const combinedFirst = Math.max(
    0,
    Math.min(input.employmentIncomeCents + earnings, rules.cpp.ympeCents) -
      rules.cpp.basicExemptionCents,
  );
  const firstRangeEarnings = Math.max(0, combinedFirst - employmentFirst);
  const secondMaximum = rules.cpp.yampeCents - rules.cpp.ympeCents;
  const employmentSecond = Math.max(
    0,
    Math.min(input.employmentIncomeCents - rules.cpp.ympeCents, secondMaximum),
  );
  const combinedSecond = Math.max(
    0,
    Math.min(
      input.employmentIncomeCents + earnings - rules.cpp.ympeCents,
      secondMaximum,
    ),
  );
  const secondRangeEarnings = Math.max(0, combinedSecond - employmentSecond);
  const base = mulRate(firstRangeEarnings, rules.cpp.selfEmployedBaseRateBps);
  const firstAdditional = mulRate(
    firstRangeEarnings,
    rules.cpp.selfEmployedFirstAdditionalRateBps,
  );
  const secondAdditional = mulRate(
    secondRangeEarnings,
    rules.cpp.selfEmployedSecondAdditionalRateBps,
  );
  const required = base + firstAdditional + secondAdditional;
  const employmentOverpayment =
    payroll.cppOverpaymentCents + payroll.cpp2OverpaymentCents;
  return {
    payableCents: Math.max(0, required - employmentOverpayment * 2),
    remainingEmploymentOverpaymentCents: Math.max(
      0,
      employmentOverpayment - Math.round(required / 2),
    ),
    creditableBaseCents: Math.round(base / 2),
    deductibleCents: Math.round(base / 2) + firstAdditional + secondAdditional,
  };
}

function applyTuition(
  available: number,
  taxBeforeTuition: number,
  rateBps: number,
) {
  const amountNeeded =
    rateBps === 0 ? 0 : Math.ceil((taxBeforeTuition * 10_000) / rateBps);
  const used = Math.min(available, Math.max(0, amountNeeded));
  return {
    used,
    remaining: available - used,
    credit: Math.min(taxBeforeTuition, mulRate(used, rateBps)),
  };
}

function calculatePerson(input: PersonEstimateInput, medicalCents: number) {
  const payroll = payrollAmounts(input);
  const selfCpp = selfEmploymentCpp(input, payroll);
  const totalIncomeCents =
    input.employmentIncomeCents +
    input.interestIncomeCents +
    input.selfEmploymentIncomeCents;
  const totalDeductionsCents =
    input.rrspDeductionCents +
    input.fhsaDeductionCents +
    input.professionalDuesCents +
    payroll.enhancedCpp +
    payroll.allowedCpp2 +
    selfCpp.deductibleCents;
  const netIncomeCents = Math.max(0, totalIncomeCents - totalDeductionsCents);
  const taxableIncomeCents = netIncomeCents;

  const federalBasic = phasedAmount(
    rules.federal.basicPersonalMaximumCents,
    rules.federal.basicPersonalMinimumCents,
    netIncomeCents,
    rules.federal.basicPersonalPhaseStartCents,
    rules.federal.basicPersonalPhaseEndCents,
  );
  const mbBasic = phasedAmount(
    rules.manitoba.basicPersonalMaximumCents,
    0,
    netIncomeCents,
    rules.manitoba.basicPersonalPhaseStartCents,
    rules.manitoba.basicPersonalPhaseEndCents,
  );
  const employmentAmount = Math.min(
    input.employmentIncomeCents,
    rules.federal.employmentAmountMaximumCents,
  );
  const federalMedicalEligible = Math.max(
    0,
    medicalCents -
      Math.min(
        rules.federal.medicalThresholdCents,
        mulRate(netIncomeCents, 300),
      ),
  );
  const mbMedicalEligible = Math.max(
    0,
    medicalCents -
      Math.min(
        rules.manitoba.medicalThresholdCents,
        mulRate(netIncomeCents, 300),
      ),
  );

  const federalTaxBeforeCredits = progressiveTax(
    taxableIncomeCents,
    rules.federal.brackets,
  );
  const federalBaseCredits = mulRate(
    federalBasic +
      employmentAmount +
      payroll.baseCpp +
      selfCpp.creditableBaseCents +
      payroll.allowedEi +
      federalMedicalEligible,
    rules.federal.creditRateBps,
  );
  const federalBeforeTuition = Math.max(
    0,
    federalTaxBeforeCredits - federalBaseCredits,
  );
  const federalTuitionAvailable =
    input.federalTuitionCarryforwardCents + input.currentTuitionCents;
  const federalTuition = applyTuition(
    federalTuitionAvailable,
    federalBeforeTuition,
    rules.federal.creditRateBps,
  );
  const federalTaxCents = Math.max(
    0,
    federalBeforeTuition - federalTuition.credit,
  );

  const mbTaxBeforeCredits = progressiveTax(
    taxableIncomeCents,
    rules.manitoba.brackets,
  );
  const mbBaseCredits = mulRate(
    mbBasic +
      payroll.baseCpp +
      selfCpp.creditableBaseCents +
      payroll.allowedEi +
      mbMedicalEligible,
    rules.manitoba.creditRateBps,
  );
  const mbBeforeTuition = Math.max(0, mbTaxBeforeCredits - mbBaseCredits);
  const mbTuitionAvailable =
    input.manitobaTuitionCarryforwardCents + input.currentTuitionCents;
  const mbTuition = applyTuition(
    mbTuitionAvailable,
    mbBeforeTuition,
    rules.manitoba.creditRateBps,
  );
  const manitobaTaxCents = Math.max(0, mbBeforeTuition - mbTuition.credit);

  return {
    personId: input.id,
    personName: input.name,
    inputs: { ...input, medicalExpensesCents: medicalCents },
    totalIncomeCents,
    incomeBreakdown: {
      employmentIncomeCents: input.employmentIncomeCents,
      interestIncomeCents: input.interestIncomeCents,
      selfEmploymentIncomeCents: input.selfEmploymentIncomeCents,
    },
    totalDeductionsCents,
    deductionBreakdown: {
      rrspDeductionCents: input.rrspDeductionCents,
      fhsaDeductionCents: input.fhsaDeductionCents,
      professionalDuesCents: input.professionalDuesCents,
      enhancedCppCents: payroll.enhancedCpp,
      cpp2Cents: payroll.allowedCpp2,
      selfEmploymentCppCents: selfCpp.deductibleCents,
    },
    netIncomeCents,
    taxableIncomeCents,
    federalTaxBeforeCreditsCents: federalTaxBeforeCredits,
    federalTaxCents,
    manitobaTaxBeforeCreditsCents: mbTaxBeforeCredits,
    manitobaTaxCents,
    totalTaxCents: federalTaxCents + manitobaTaxCents,
    selfEmploymentCppPayableCents: selfCpp.payableCents,
    incomeTaxWithheldCents: input.incomeTaxWithheldCents,
    cppOverpaymentCents: selfCpp.remainingEmploymentOverpaymentCents,
    eiOverpaymentCents: payroll.eiOverpaymentCents,
    federalTuition: {
      availableCents: federalTuitionAvailable,
      usedCents: federalTuition.used,
      remainingCents: federalTuition.remaining,
    },
    manitobaTuition: {
      availableCents: mbTuitionAvailable,
      usedCents: mbTuition.used,
      remainingCents: mbTuition.remaining,
    },
    refundableCreditsCents: 0,
    resultCents:
      input.incomeTaxWithheldCents +
      selfCpp.remainingEmploymentOverpaymentCents +
      payroll.eiOverpaymentCents -
      federalTaxCents -
      manitobaTaxCents -
      selfCpp.payableCents,
  };
}

function householdCredits(
  people: PersonEstimateInput[],
  credits: HouseholdCreditsInput,
) {
  const familyNet = people.reduce((sum, person) => {
    const payroll = payrollAmounts(person);
    const selfCpp = selfEmploymentCpp(person, payroll);
    return (
      sum +
      Math.max(
        0,
        person.employmentIncomeCents +
          person.interestIncomeCents +
          person.selfEmploymentIncomeCents -
          person.rrspDeductionCents -
          person.fhsaDeductionCents -
          person.professionalDuesCents -
          payroll.enhancedCpp -
          payroll.allowedCpp2 -
          selfCpp.deductibleCents,
      )
    );
  }, 0);
  const personal = Math.max(
    0,
    rules.manitoba.personalCreditAdultCents * 2 - mulRate(familyNet, 100),
  );
  const renter = Math.min(
    credits.eligibleRentCents,
    Math.round(
      (rules.manitoba.renterMaximumCents * credits.eligibleRentMonths) / 12,
    ),
  );
  const homeownerMaximum = Math.round(
    (rules.manitoba.homeownerMaximumCents * credits.homeOwnershipDays) / 365,
  );
  const homeowner = Math.max(
    0,
    Math.min(credits.eligibleSchoolTaxCents, homeownerMaximum) -
      credits.homeownerAdvanceReceivedCents,
  );
  return {
    personalCreditCents: personal,
    renterCreditCents: renter,
    homeownerCreditCents: homeowner,
    totalCents: personal + renter + homeowner,
  };
}

export function calculateHouseholdEstimate(
  people: PersonEstimateInput[],
  credits: HouseholdCreditsInput,
) {
  const alternatives = people.map((claimant) => {
    const calculated = people.map((person) =>
      calculatePerson(
        person,
        person.id === claimant.id ? credits.medicalExpensesCents : 0,
      ),
    );
    const mbCredits = householdCredits(people, credits);
    const withCredits = calculated.map((person) =>
      person.personId === credits.claimantPersonId
        ? {
            ...person,
            refundableCreditsCents: mbCredits.totalCents,
            resultCents: person.resultCents + mbCredits.totalCents,
          }
        : person,
    );
    return {
      medicalClaimantPersonId: claimant.id,
      people: withCredits,
      householdResultCents: withCredits.reduce(
        (sum, person) => sum + person.resultCents,
        0,
      ),
      manitobaCredits: mbCredits,
    };
  });
  alternatives.sort((a, b) => b.householdResultCents - a.householdResultCents);
  const chosen = alternatives[0]!;
  const other = alternatives[1]!;
  return {
    ...chosen,
    medicalAlternativeDeltaCents:
      chosen.householdResultCents - other.householdResultCents,
  };
}
