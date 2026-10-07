import { DateField } from "@yourtoolshq/ui/date-field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@yourtoolshq/ui/input-group";
import { Label } from "@yourtoolshq/ui/label";
import { MoneyField } from "@yourtoolshq/ui/money-field";
import { Textarea } from "@yourtoolshq/ui/textarea";

import type { AccountTerms } from "~/lib/account-terms";
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
        <InputGroup>
          <InputGroupInput
            id="terms-interest-rate"
            inputMode="decimal"
            value={terms.interestRate ?? ""}
            onChange={(event) =>
              updateField("interestRate", event.target.value)
            }
            placeholder="19.99"
          />
          <InputGroupAddon>
            <InputGroupText>%</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      </div>
      <div className="space-y-2">
        <Label htmlFor="terms-promo-rate">
          {accountTermsFieldLabels.promotionalInterestRate}
        </Label>
        <InputGroup>
          <InputGroupInput
            id="terms-promo-rate"
            inputMode="decimal"
            value={terms.promotionalInterestRate ?? ""}
            onChange={(event) =>
              updateField("promotionalInterestRate", event.target.value)
            }
            placeholder="0"
          />
          <InputGroupAddon>
            <InputGroupText>%</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      </div>
      <div className="space-y-2">
        <Label htmlFor="terms-promo-expires">
          {accountTermsFieldLabels.promotionalInterestRateExpires}
        </Label>
        <DateField
          id="terms-promo-expires"
          value={terms.promotionalInterestRateExpires ?? ""}
          onChange={(value) =>
            updateField("promotionalInterestRateExpires", value)
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="terms-credit-limit">
          {accountTermsFieldLabels.creditLimit}
        </Label>
        <MoneyField
          id="terms-credit-limit"
          value={terms.creditLimit ?? ""}
          onValueChange={(value) => updateField("creditLimit", value)}
          placeholder="10000"
        />
        <p className="text-muted-foreground text-xs">
          Saved as a number; shown with $ in the terms panel.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="terms-annual-fee">
          {accountTermsFieldLabels.annualFee}
        </Label>
        <MoneyField
          id="terms-annual-fee"
          value={terms.annualFee ?? ""}
          onValueChange={(value) => updateField("annualFee", value)}
          placeholder="120"
        />
        <p className="text-muted-foreground text-xs">
          Saved as a number; shown with $ in the terms panel.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="terms-renewal-date">
          {accountTermsFieldLabels.renewalDate}
        </Label>
        <DateField
          id="terms-renewal-date"
          value={terms.renewalDate ?? ""}
          onChange={(value) => updateField("renewalDate", value)}
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
