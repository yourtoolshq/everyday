"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { RouterOutputs } from "~/trpc/react";
import { InstitutionFormSheet } from "~/components/institutions/institution-form-sheet";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";

type Institution = RouterOutputs["institutions"]["list"][number];

export function InstitutionsWorkspace() {
  const utils = api.useUtils();
  const institutions = api.institutions.list.useQuery();
  const [editing, setEditing] = useState<Institution | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const deleteInstitution = api.institutions.delete.useMutation({
    onSuccess: async () => {
      await utils.institutions.list.invalidate();
      toast.success("Institution removed.");
    },
    onError: (error) => toast.error(error.message),
  });

  function addInstitution() {
    setEditing(null);
    setFormOpen(true);
  }

  function editInstitution(institution: Institution) {
    setEditing(institution);
    setFormOpen(true);
  }

  if (institutions.isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (institutions.error) {
    return (
      <p className="text-destructive text-sm">
        Unable to load institutions. {institutions.error.message}
      </p>
    );
  }

  const items = institutions.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-primary text-sm font-medium">Inventory</p>
          <h2 className="text-3xl font-semibold tracking-tight">
            Institutions
          </h2>
          <p className="text-muted-foreground">
            Banks, lenders, and investment providers.
          </p>
        </div>
        <Button onClick={addInstitution}>
          <Plus /> Add institution
        </Button>
      </div>

      {items.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="flex h-64 flex-col items-center justify-center text-center">
            <p className="font-medium">No institutions yet</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Add the banks, lenders, and providers your household uses.
            </p>
            <Button className="mt-4" variant="outline" onClick={addInstitution}>
              <Plus /> Add institution
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((institution) => (
            <Card key={institution.id} className="shadow-none">
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div>
                  <p className="font-medium">{institution.name}</p>
                  {institution.website ? (
                    <p className="text-muted-foreground text-sm">
                      {institution.website}
                    </p>
                  ) : null}
                  {institution.notes ? (
                    <p className="text-muted-foreground mt-2 text-sm">
                      {institution.notes}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${institution.name}`}
                    onClick={() => editInstitution(institution)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${institution.name}`}
                    onClick={() =>
                      deleteInstitution.mutate({ id: institution.id })
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {formOpen ? (
        <InstitutionFormSheet
          key={editing?.id ?? "new"}
          institution={editing}
          open={formOpen}
          onOpenChange={setFormOpen}
        />
      ) : null}
    </div>
  );
}
