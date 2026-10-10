import { Input } from "@yourtoolshq/ui/input";
import { Label } from "@yourtoolshq/ui/label";

export function MoneyFieldGroup({
  id,
  label,
  help,
  value,
  onValueChange,
}: {
  id: string;
  label: string;
  help?: string;
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        className="tabular-nums"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      />
      {help ? <p className="text-muted-foreground text-xs">{help}</p> : null}
    </div>
  );
}
