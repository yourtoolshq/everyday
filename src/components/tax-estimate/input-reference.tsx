import { formatCad } from "~/domain/money";
import type { EstimateData, EstimateMode } from "./types";

export function InputReference({
  data,
  mode,
}: {
  data: EstimateData;
  mode: EstimateMode;
}) {
  const selected = data[mode];
  const credits = data.inputs[mode];
  const personRows = selected.people.flatMap((person) => [
    {
      label: `${person.personName} — employment income`,
      value: person.inputs.employmentIncomeCents,
    },
    {
      label: `${person.personName} — interest income`,
      value: person.inputs.interestIncomeCents,
    },
    {
      label: `${person.personName} — recorded net self-employment income (loss)`,
      value: person.inputs.selfEmploymentIncomeCents,
    },
    {
      label: `${person.personName} — RRSP/FHSA/professional deductions`,
      value: person.inputs.rrspDeductionCents
        + person.inputs.fhsaDeductionCents
        + person.inputs.professionalDuesCents,
    },
    {
      label: `${person.personName} — tax withheld`,
      value: person.inputs.incomeTaxWithheldCents,
    },
    {
      label: `${person.personName} — CPP/CPP2`,
      value: person.inputs.cppCents + person.inputs.cpp2Cents,
    },
    {
      label: `${person.personName} — EI`,
      value: person.inputs.eiCents,
    },
    {
      label: `${person.personName} — tuition`,
      value: person.inputs.currentTuitionCents
        + person.inputs.federalTuitionCarryforwardCents
        + person.inputs.manitobaTuitionCarryforwardCents,
    },
  ]);

  return (
    <details className="rounded-xl bg-card ring-1 ring-foreground/10">
      <summary className="cursor-pointer px-4 py-4 font-medium">
        {mode === "actual" ? "Recorded" : "Projected"} input reference
      </summary>
      <div className="border-t px-4 py-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Input</th>
                <th className="pb-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {personRows.map((row) => (
                <InputRow key={row.label} {...row} />
              ))}
              <InputRow
                label="Household medical expenses"
                value={credits.medicalExpensesCents}
              />
              <InputRow
                label="Eligible rent"
                value={credits.eligibleRentCents}
              />
              <InputRow
                label="Eligible school tax"
                value={credits.eligibleSchoolTaxCents}
              />
              <InputRow
                label="Homeowner advance received"
                value={credits.homeownerAdvanceReceivedCents}
                last
              />
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Housing facts are inferred from mapped Tax Items · eligible rent months: {data.rentMonths.length} · eligible ownership days: {credits.homeOwnershipDays}
        </p>
      </div>
    </details>
  );
}

function InputRow({
  label,
  value,
  last,
}: {
  label: string;
  value: number;
  last?: boolean;
}) {
  return (
    <tr className={last ? "" : "border-b"}>
      <td className="py-2">{label}</td>
      <td className="py-2 text-right tabular-nums">{formatCad(value)}</td>
    </tr>
  );
}
