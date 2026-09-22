"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { IconCalendar, IconChevronDown, IconPlus } from "@tabler/icons-react";
import { toast } from "sonner";

import type { RouterOutputs } from "~/trpc/react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "~/components/ui/sidebar";
import { api } from "~/trpc/react";

type TaxYear = RouterOutputs["taxYear"]["list"][number];
type CreateMode = "track" | "past";

export function YearSwitcher({ years }: { years: TaxYear[] }) {
  const utils = api.useUtils();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CreateMode>("track");
  const [year, setYear] = useState((new Date().getFullYear() - 1).toString());
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
  const createPast = api.taxYear.createPast.useMutation({
    onSuccess: async () => {
      setOpen(false);
      toast.success(
        "Past tax year added. Switch to it in the tax year menu when you are ready.",
      );
      await utils.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const pending = create.isPending || createPast.isPending;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedYear = Number(year);
    if (mode === "past") {
      createPast.mutate({ year: parsedYear });
      return;
    }
    create.mutate({ year: parsedYear });
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="bg-background border"
                aria-label="Tax year"
              >
                <IconCalendar />
                <div className="grid flex-1 text-left leading-tight">
                  <span className="text-muted-foreground text-xs">
                    Tax year
                  </span>
                  <span className="font-medium">
                    {active?.year ?? "Choose year"}
                  </span>
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
                  {item.isActive ? (
                    <span className="text-muted-foreground ml-auto text-xs">
                      Active
                    </span>
                  ) : null}
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
              <DialogDescription>
                {mode === "track"
                  ? "Start tracking a new year. It becomes active immediately."
                  : "Add a past year for filing history without changing the active year."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-6">
              <div className="space-y-2">
                <Label htmlFor="new-tax-year-mode">Purpose</Label>
                <Select
                  value={mode}
                  onValueChange={(value) => setMode(value as CreateMode)}
                >
                  <SelectTrigger id="new-tax-year-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="track">
                      Start tracking this year
                    </SelectItem>
                    <SelectItem value="past">Add a past year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-tax-year">Calendar year</Label>
                <Input
                  id="new-tax-year"
                  type="number"
                  min="2000"
                  max="2100"
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button disabled={pending}>
                {pending
                  ? "Creating…"
                  : mode === "past"
                    ? "Add past year"
                    : "Create year"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
