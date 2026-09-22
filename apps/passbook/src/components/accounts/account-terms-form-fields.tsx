import type { AccountTerms } from "~/lib/account-terms";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { accountTermsFieldLabels } from "~/lib/account-terms";

type AccountTermsFormFieldsProps = {
  terms: AccountTerms;
  onChange: (terms: AccountTerms) => void;
};

export function AccountTermsFormFields({
  terms,
  onChange,
}: AccountTermsFormFieldsProps) {
  function updateField<K extends keyof AccountTerms>(field: K, value: string) {
    onChange({ ...terms, [field]: value });
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="terms-interest-rate">
          {accountTermsFieldLabels.interestRate}
        </Label>
        <Input
          id="terms-interest-rate"
          inputMode="decimal"
          value={terms.interestRate ?? ""}
          onChange={(event) => updateField("interestRate", event.target.value)}
          placeholder="19.99%"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="terms-promo-rate">
          {accountTermsFieldLabels.promotionalInterestRate}
        </Label>
        <Input
          id="terms-promo-rate"
          inputMode="decimal"
          value={terms.promotionalInterestRate ?? ""}
          onChange={(event) =>
            updateField("promotionalInterestRate", event.target.value)
          }
          placeholder="0%"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="terms-promo-expires">
          {accountTermsFieldLabels.promotionalInterestRateExpires}
        </Label>
        <Input
          id="terms-promo-expires"
          type="date"
          value={terms.promotionalInterestRateExpires ?? ""}
          onChange={(event) =>
            updateField("promotionalInterestRateExpires", event.target.value)
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="terms-credit-limit">
          {accountTermsFieldLabels.creditLimit}
        </Label>
        <Input
          id="terms-credit-limit"
          inputMode="decimal"
          value={terms.creditLimit ?? ""}
          onChange={(event) => updateField("creditLimit", event.target.value)}
          placeholder="$10,000"
        />
        <p className="text-muted-foreground text-xs">
          Saved as a number; shown with $ in the terms panel.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="terms-annual-fee">
          {accountTermsFieldLabels.annualFee}
        </Label>
        <Input
          id="terms-annual-fee"
          inputMode="decimal"
          value={terms.annualFee ?? ""}
          onChange={(event) => updateField("annualFee", event.target.value)}
          placeholder="$120"
        />
        <p className="text-muted-foreground text-xs">
          Saved as a number; shown with $ in the terms panel.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="terms-renewal-date">
          {accountTermsFieldLabels.renewalDate}
        </Label>
        <Input
          id="terms-renewal-date"
          type="date"
          value={terms.renewalDate ?? ""}
          onChange={(event) => updateField("renewalDate", event.target.value)}
        />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="terms-insurance">
          {accountTermsFieldLabels.insurance}
        </Label>
        <Textarea
          id="terms-insurance"
          value={terms.insurance ?? ""}
          onChange={(event) => updateField("insurance", event.target.value)}
          placeholder="Balance protection, optional coverage notes…"
          rows={3}
        />
      </div>
    </div>
  );
}
