"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { EmployerFormDrawer } from "~/components/employers/employer-form-drawer";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { api } from "~/trpc/react";

export function EmployersWorkspace() {
  const utils = api.useUtils();
  const employers = api.employers.list.useQuery();
  const [createOpen, setCreateOpen] = useState(false);
  const [editEmployer, setEditEmployer] = useState<
    (typeof employers.data extends (infer Item)[] | undefined ? Item : never) | null
  >(null);

  const deleteEmployer = api.employers.delete.useMutation({
    onSuccess: async () => {
      await utils.employers.list.invalidate();
      toast.success("Employer removed.");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          Add employer
        </Button>
      </div>

      <div className="space-y-3">
        {employers.data?.map((employer) => (
          <Card key={employer.id} className="shadow-none">
            <CardContent className="flex items-start justify-between gap-4 p-4">
              <Link href={`/employers/${employer.id}`} className="min-w-0 flex-1">
                <p className="font-medium">{employer.name}</p>
                {employer.website ? (
                  <p className="text-sm text-muted-foreground">{employer.website}</p>
                ) : null}
                {employer.notes ? (
                  <p className="mt-2 text-sm text-muted-foreground">{employer.notes}</p>
                ) : null}
              </Link>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit ${employer.name}`}
                  onClick={() => setEditEmployer(employer)}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${employer.name}`}
                  onClick={() => deleteEmployer.mutate({ id: employer.id })}
                >
                  <Trash2 />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {employers.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">No employers yet.</p>
        ) : null}
      </div>

      <EmployerFormDrawer open={createOpen} onOpenChange={setCreateOpen} mode="create" />

      <EmployerFormDrawer
        open={Boolean(editEmployer)}
        onOpenChange={(open) => {
          if (!open) setEditEmployer(null);
        }}
        mode="edit"
        employer={editEmployer ?? undefined}
        onSuccess={() => setEditEmployer(null)}
      />
    </>
  );
}
