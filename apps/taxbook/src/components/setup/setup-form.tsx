"use client";

import { IconBook2, IconPlus, IconTrash } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { api } from "~/trpc/react";

export function SetupForm() {
  const router = useRouter();
  const [householdName, setHouseholdName] = useState("Our household");
  const [people, setPeople] = useState(["", ""]);
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const initialize = api.setup.initialize.useMutation({
    onSuccess: () => {
      router.push("/");
      router.refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const names = people.map((name) => name.trim()).filter(Boolean);
    if (names.length === 0) {
      toast.error("Add at least one household member.");
      return;
    }
    initialize.mutate({
      householdName,
      people: names,
      year: Number(year),
    });
  }

  return (
    <Card className="w-full max-w-xl border-border/80 shadow-xl shadow-primary/5">
      <CardHeader className="space-y-4">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <IconBook2 className="size-6" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Set up your Tax Book</h1>
          <CardDescription className="mt-2">
            Start with your household and current tax year. You can change these later.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="household-name">Household label</Label>
            <Input id="household-name" value={householdName} onChange={(event) => setHouseholdName(event.target.value)} required />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Household members</Label>
              <Button type="button" variant="ghost" size="sm" onClick={() => setPeople((current) => [...current, ""])}>
                <IconPlus /> Add person
              </Button>
            </div>
            {people.map((person, index) => (
              <div className="flex gap-2" key={index}>
                <Input
                  aria-label={`Person ${index + 1} name`}
                  placeholder={`Person ${index + 1}`}
                  value={person}
                  onChange={(event) => setPeople((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value))}
                />
                {people.length > 1 ? (
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove person ${index + 1}`} onClick={() => setPeople((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                    <IconTrash />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="tax-year">Starting tax year</Label>
            <Input id="tax-year" type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(event.target.value)} required />
          </div>
          <Button className="w-full" size="lg" disabled={initialize.isPending}>
            {initialize.isPending ? "Creating Tax Book…" : "Open Tax Book"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
