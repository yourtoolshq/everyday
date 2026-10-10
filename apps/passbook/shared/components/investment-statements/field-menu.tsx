import type { ComponentProps } from "react";
import { DropdownMenu } from "radix-ui";

export const FieldMenu = DropdownMenu.Root;
export const FieldMenuTrigger = DropdownMenu.Trigger;
export function FieldMenuContent(
  props: ComponentProps<typeof DropdownMenu.Content>,
) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        sideOffset={6}
        className="bg-popover text-popover-foreground z-50 min-w-48 rounded-lg border p-1 shadow-md"
        {...props}
      />
    </DropdownMenu.Portal>
  );
}
export function FieldMenuItem(props: ComponentProps<typeof DropdownMenu.Item>) {
  return (
    <DropdownMenu.Item
      className="data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:text-muted-foreground cursor-default rounded-md px-3 py-2 text-sm outline-none"
      {...props}
    />
  );
}
