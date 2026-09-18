"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { api } from "~/trpc/react";

export function InstitutionsWorkspace() {
  const utils = api.useUtils();
  const institutions = api.institutions.list.useQuery();
  const createInstitution = api.institutions.create.useMutation({
    onSuccess: async () => {
      setName("");
      setWebsite("");
      setNotes("");
      await utils.institutions.list.invalidate();
      toast.success("Institution added.");
    },
    onError: (error) => toast.error(error.message),
  });
  const deleteInstitution = api.institutions.delete.useMutation({
    onSuccess: async () => {
      await utils.institutions.list.invalidate();
      toast.success("Institution removed.");
    },
    onError: (error) => toast.error(error.message),
  });
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <div className="space-y-6">
      <Card className="shadow-none">
        <CardContent className="space-y-4 p-4">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!name.trim()) return;
              createInstitution.mutate({
                name: name.trim(),
                website: website.trim() || null,
                notes: notes.trim() || null,
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="institution-name">Institution name</Label>
              <Input
                id="institution-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="institution-website">Website</Label>
              <Input
                id="institution-website"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                placeholder="https://"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="institution-notes">Notes</Label>
              <Textarea
                id="institution-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
              />
            </div>
            <Button type="submit" disabled={createInstitution.isPending}>
              <Plus /> Add institution
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {institutions.data?.map((institution) => (
          <Card key={institution.id} className="shadow-none">
            <CardContent className="flex items-start justify-between gap-4 p-4">
              <div>
                <p className="font-medium">{institution.name}</p>
                {institution.website ? (
                  <p className="text-sm text-muted-foreground">{institution.website}</p>
                ) : null}
                {institution.notes ? (
                  <p className="mt-2 text-sm text-muted-foreground">{institution.notes}</p>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${institution.name}`}
                onClick={() => deleteInstitution.mutate({ id: institution.id })}
              >
                <Trash2 />
              </Button>
            </CardContent>
          </Card>
        ))}
        {institutions.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">No institutions yet.</p>
        ) : null}
      </div>
    </div>
  );
}
