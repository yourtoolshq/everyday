"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";

export function PeopleWorkspace() {
  const utils = api.useUtils();
  const people = api.people.list.useQuery();
  const createPerson = api.people.create.useMutation({
    onSuccess: async () => {
      setName("");
      await utils.people.list.invalidate();
      toast.success("Person added.");
    },
    onError: (error) => toast.error(error.message),
  });
  const deletePerson = api.people.delete.useMutation({
    onSuccess: async () => {
      await utils.people.list.invalidate();
      toast.success("Person removed.");
    },
    onError: (error) => toast.error(error.message),
  });
  const [name, setName] = useState("");

  return (
    <div className="space-y-6">
      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          createPerson.mutate({ displayName: name.trim() });
        }}
      >
        <Input
          placeholder="Person name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Button type="submit" disabled={createPerson.isPending}>
          <Plus /> Add person
        </Button>
      </form>

      <div className="space-y-3">
        {people.data?.map((person) => (
          <Card key={person.id} className="shadow-none">
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <p className="font-medium">{person.displayName}</p>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${person.displayName}`}
                onClick={() => deletePerson.mutate({ id: person.id })}
              >
                <Trash2 />
              </Button>
            </CardContent>
          </Card>
        ))}
        {people.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">No people yet.</p>
        ) : null}
      </div>
    </div>
  );
}
