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

export function EmployersWorkspace() {
  const utils = api.useUtils();
  const employers = api.employers.list.useQuery();
  const createEmployer = api.employers.create.useMutation({
    onSuccess: async () => {
      setName("");
      setWebsite("");
      setNotes("");
      await utils.employers.list.invalidate();
      toast.success("Employer added.");
    },
    onError: (error) => toast.error(error.message),
  });
  const deleteEmployer = api.employers.delete.useMutation({
    onSuccess: async () => {
      await utils.employers.list.invalidate();
      toast.success("Employer removed.");
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
              createEmployer.mutate({
                name: name.trim(),
                website: website.trim() || null,
                notes: notes.trim() || null,
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="employer-name">Employer name</Label>
              <Input
                id="employer-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="employer-website">Website</Label>
              <Input
                id="employer-website"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                placeholder="https://"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="employer-notes">Notes</Label>
              <Textarea
                id="employer-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
              />
            </div>
            <Button type="submit" disabled={createEmployer.isPending}>
              <Plus /> Add employer
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {employers.data?.map((employer) => (
          <Card key={employer.id} className="shadow-none">
            <CardContent className="flex items-start justify-between gap-4 p-4">
              <div>
                <p className="font-medium">{employer.name}</p>
                {employer.website ? (
                  <p className="text-sm text-muted-foreground">{employer.website}</p>
                ) : null}
                {employer.notes ? (
                  <p className="mt-2 text-sm text-muted-foreground">{employer.notes}</p>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${employer.name}`}
                onClick={() => deleteEmployer.mutate({ id: employer.id })}
              >
                <Trash2 />
              </Button>
            </CardContent>
          </Card>
        ))}
        {employers.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">No employers yet.</p>
        ) : null}
      </div>
    </div>
  );
}
