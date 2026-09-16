"use client";

import { IconCalendar, IconChevronDown, IconPlus } from "@tabler/icons-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "~/components/ui/sidebar";
import { api, type RouterOutputs } from "~/trpc/react";

type TaxYear = RouterOutputs["taxYear"]["list"][number];

export function YearSwitcher({ years }: { years: TaxYear[] }) {
  const utils = api.useUtils();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState((new Date().getFullYear() + 1).toString());
  const active = years.find((item) => item.isActive);
  const setActive = api.taxYear.setActive.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      window.location.reload();
    },
    onError: (error) => toast.error(error.message),
  });
  const create = api.taxYear.create.useMutation({
    onSuccess: async () => {
      setOpen(false);
      toast.success("Tax year created.");
      await utils.invalidate();
      window.location.reload();
    },
    onError: (error) => toast.error(error.message),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    create.mutate({ year: Number(year) });
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton size="lg" className="border bg-background" aria-label="Tax year">
                <IconCalendar />
                <div className="grid flex-1 text-left leading-tight">
                  <span className="text-xs text-muted-foreground">Tax year</span>
                  <span className="font-medium">{active?.year ?? "Choose year"}</span>
                </div>
                <IconChevronDown className="ml-auto" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start">
              <DropdownMenuLabel>Tax years</DropdownMenuLabel>
              {years.map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  disabled={item.isActive || setActive.isPending}
                  onSelect={() => setActive.mutate({ id: item.id })}
                >
                  {item.year}
                  {item.isActive ? <span className="ml-auto text-xs text-muted-foreground">Active</span> : null}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setOpen(true)}>
                <IconPlus /> New tax year
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>Create a tax year</DialogTitle>
              <DialogDescription>The new year becomes active immediately.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-6">
              <Label htmlFor="new-tax-year">Calendar year</Label>
              <Input id="new-tax-year" type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(event.target.value)} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button disabled={create.isPending}>{create.isPending ? "Creating…" : "Create year"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
