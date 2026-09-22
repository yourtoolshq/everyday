"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { api } from "~/trpc/react";

export function SetupForm() {
  const router = useRouter();
  const [householdName, setHouseholdName] = useState("Our household");
  const [members, setMembers] = useState(["", ""]);
  const initialize = api.setup.initialize.useMutation({
    onSuccess: () => {
      router.push("/");
      router.refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const names = members.map((name) => name.trim()).filter(Boolean);
    if (names.length === 0) {
      toast.error("Add at least one household member.");
      return;
    }
    initialize.mutate({
      householdName,
      people: names,
    });
  }

  return (
    <Card className="border-border/80 shadow-primary/5 w-full max-w-xl shadow-xl">
      <CardHeader className="space-y-4">
        <div className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl">
          <Briefcase className="size-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Set up Tenure
          </h1>
          <CardDescription className="mt-2">
            Start with your household name and members. You can add employers
            and employments next.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="household-name">Household label</Label>
            <Input
              id="household-name"
              value={householdName}
              onChange={(event) => setHouseholdName(event.target.value)}
              required
            />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Household members</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMembers((current) => [...current, ""])}
              >
                <Plus /> Add person
              </Button>
            </div>
            {members.map((member, index) => (
              <div className="flex gap-2" key={index}>
                <Input
                  aria-label={`Member ${index + 1} name`}
                  placeholder={`Member ${index + 1}`}
                  value={member}
                  onChange={(event) =>
                    setMembers((current) =>
                      current.map((value, itemIndex) =>
                        itemIndex === index ? event.target.value : value,
                      ),
                    )
                  }
                />
                {members.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove member ${index + 1}`}
                    onClick={() =>
                      setMembers((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    <Trash2 />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
          <Button className="w-full" size="lg" disabled={initialize.isPending}>
            {initialize.isPending ? "Creating Tenure…" : "Open Tenure"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
