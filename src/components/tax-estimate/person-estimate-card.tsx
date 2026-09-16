import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { formatCad } from "~/domain/money";
import { resultLabel, type PersonResult } from "./types";

export function PersonEstimateCard({ person, modeLabel }: { person: PersonResult; modeLabel: string }) {
  const paymentsAndCredits = person.incomeTaxWithheldCents + person.cppOverpaymentCents + person.eiOverpaymentCents + person.refundableCreditsCents;
  const federalCredits = person.federalTaxBeforeCreditsCents - person.federalTaxCents;
  const manitobaCredits = person.manitobaTaxBeforeCreditsCents - person.manitobaTaxCents;
  const explanation = person.resultCents >= 0
    ? `${modeLabel} tax paid, overpayments, and refundable credits exceed estimated tax by ${formatCad(person.resultCents)}.`
    : `Estimated tax exceeds ${modeLabel.toLowerCase()} tax paid, overpayments, and refundable credits by ${formatCad(Math.abs(person.resultCents))}.`;

  return (
    <Card>
      <CardHeader className="border-b">
        <CardDescription>{person.personName}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">
          {resultLabel(person.resultCents)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <StatementSection title="Income">
          <StatementLine
            label="Employment income"
            value={person.incomeBreakdown.employmentIncomeCents}
          />
          <StatementLine
            label="Interest income"
            value={person.incomeBreakdown.interestIncomeCents}
          />
          <StatementLine label="Total income" value={person.totalIncomeCents} total />
        </StatementSection>
        <StatementSection title="Deductions">
          <StatementLine label="RRSP deduction" value={person.deductionBreakdown.rrspDeductionCents} />
          <StatementLine label="FHSA deduction" value={person.deductionBreakdown.fhsaDeductionCents} />
          <StatementLine label="Professional dues" value={person.deductionBreakdown.professionalDuesCents} />
          <StatementLine label="Enhanced CPP deduction" value={person.deductionBreakdown.enhancedCppCents} />
          <StatementLine label="CPP2 deduction" value={person.deductionBreakdown.cpp2Cents} />
          <StatementLine label="Total deductions" value={person.totalDeductionsCents} total />
          <StatementLine label="Taxable income" value={person.taxableIncomeCents} emphasis />
        </StatementSection>
        <StatementSection title="Estimated tax">
          <StatementLine label="Federal tax before credits" value={person.federalTaxBeforeCreditsCents} />
          <StatementLine label="Federal non-refundable credits" value={federalCredits === 0 ? 0 : -federalCredits} />
          <StatementLine label="Federal tax" value={person.federalTaxCents} total />
          <StatementLine label="Manitoba tax before credits" value={person.manitobaTaxBeforeCreditsCents} />
          <StatementLine label="Manitoba non-refundable credits" value={manitobaCredits === 0 ? 0 : -manitobaCredits} />
          <StatementLine label="Manitoba tax" value={person.manitobaTaxCents} total />
          <StatementLine label="Total estimated tax" value={person.totalTaxCents} emphasis />
        </StatementSection>
        <StatementSection title="Payments and refundable credits">
          <StatementLine label="Income tax withheld" value={person.incomeTaxWithheldCents} />
          <StatementLine label="CPP/EI overpayments" value={person.cppOverpaymentCents + person.eiOverpaymentCents} />
          <StatementLine label="Refundable Manitoba credits" value={person.refundableCreditsCents} />
          <StatementLine label="Total payments and credits" value={paymentsAndCredits} total />
          <StatementLine
            label={person.resultCents >= 0 ? "Estimated refund" : "Estimated amount owing"}
            value={Math.abs(person.resultCents)}
            result
          />
        </StatementSection>
        <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          {explanation}
        </p>
      </CardContent>
    </Card>
  );
}

function StatementSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-2 text-sm font-semibold">{title}</h4>
      <div className="space-y-1.5 text-sm">{children}</div>
    </section>
  );
}

function StatementLine({ label, value, total, emphasis, result }: { label: string; value: number; total?: boolean; emphasis?: boolean; result?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${total ? "border-t pt-1.5 font-medium" : ""} ${emphasis ? "mt-2 rounded-md bg-muted/50 px-2 py-2 font-semibold" : ""} ${result ? "mt-3 border-t-2 pt-3 text-base font-semibold" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{formatCad(value)}</span>
    </div>
  );
}
