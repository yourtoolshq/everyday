"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PersonFormDrawer } from "~/components/people/person-form-drawer";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { api } from "~/trpc/react";

export function PeopleWorkspace() {
  const utils = api.useUtils();
  const people = api.people.list.useQuery();
  const [createOpen, setCreateOpen] = useState(false);
  const [editPerson, setEditPerson] = useState<
    (typeof people.data extends (infer Item)[] | undefined ? Item : never) | null
  >(null);

  const deletePerson = api.people.delete.useMutation({
    onSuccess: async () => {
      await utils.people.list.invalidate();
      toast.success("Person removed.");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          Add person
        </Button>
      </div>

      <div className="space-y-3">
        {people.data?.map((person) => (
          <Card key={person.id} className="shadow-none">
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <p className="font-medium">{person.displayName}</p>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit ${person.displayName}`}
                  onClick={() => setEditPerson(person)}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${person.displayName}`}
                  onClick={() => deletePerson.mutate({ id: person.id })}
                >
                  <Trash2 />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {people.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">No people yet.</p>
        ) : null}
      </div>

      <PersonFormDrawer open={createOpen} onOpenChange={setCreateOpen} mode="create" />

      <PersonFormDrawer
        open={Boolean(editPerson)}
        onOpenChange={(open) => {
          if (!open) setEditPerson(null);
        }}
        mode="edit"
        person={editPerson ?? undefined}
        onSuccess={() => setEditPerson(null)}
      />
    </>
  );
}
