import type { EstimateData } from "./types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { formatCad } from "~/domain/money";

export function HouseholdItems({
  data,
  result,
  modeLabel,
}: {
  data: EstimateData;
  result: EstimateData["projected"];
  modeLabel: string;
}) {
  const medicalClaimant = result.people.find(
    (person) => person.personId === result.medicalClaimantPersonId,
  )?.personName;
  const creditsClaimant =
    result.people.find((person) => person.refundableCreditsCents > 0)
      ?.personName ?? result.people[0]?.personName;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Household items</CardTitle>
        <CardDescription>
          These amounts affect the household but must be assigned to an
          individual return.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">Medical expenses</p>
          <p className="mt-1 font-semibold">Claim on {medicalClaimant}</p>
          <p className="text-muted-foreground mt-2 text-sm">
            {result.medicalAlternativeDeltaCents > 0
              ? `This improves the ${modeLabel.toLowerCase()} household result by ${formatCad(result.medicalAlternativeDeltaCents)} compared with the other person.`
              : "Either person produces the same household result; this person is used for the estimate."}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">
            Manitoba household credits
          </p>
          <p className="mt-1 font-semibold">Shown on {creditsClaimant}</p>
          <p className="text-muted-foreground mt-2 text-sm">
            Includes {formatCad(result.manitobaCredits.totalCents)} of
            refundable credits. Either person produces the same combined result,
            so the estimate uses the first household member.
          </p>
          <p className="text-muted-foreground mt-2 text-xs">
            Eligible rent months:{" "}
            {data.rentMonths.length
              ? data.rentMonths.join(", ")
              : "none recorded"}
            . Housing eligibility is inferred from mapped Tax Items.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
