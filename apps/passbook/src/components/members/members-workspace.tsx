"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { api } from "~/trpc/react";

export function MembersWorkspace() {
  const utils = api.useUtils();
  const members = api.people.list.useQuery();
  const createMember = api.people.create.useMutation({
    onSuccess: async () => {
      setName("");
      await utils.people.list.invalidate();
      toast.success("Member added.");
    },
    onError: (error) => toast.error(error.message),
  });
  const updateMember = api.people.update.useMutation({
    onSuccess: async () => {
      setEditingId(null);
      await utils.people.list.invalidate();
      toast.success("Member updated.");
    },
    onError: (error) => toast.error(error.message),
  });
  const deleteMember = api.people.delete.useMutation({
    onSuccess: async () => {
      await utils.people.list.invalidate();
      toast.success("Member removed.");
    },
    onError: (error) => toast.error(error.message),
  });

  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  function openEdit(member: NonNullable<typeof members.data>[number]) {
    setEditingId(member.id);
    setEditName(member.displayName);
  }

  return (
    <div className="space-y-6">
      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          createMember.mutate({ displayName: name.trim() });
        }}
      >
        <Input
          placeholder="Member name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Button type="submit" disabled={createMember.isPending}>
          <Plus /> Add member
        </Button>
      </form>

      <div className="space-y-3">
        {members.data?.map((member) => (
          <Card key={member.id} className="shadow-none">
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <p className="font-medium">{member.displayName}</p>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit ${member.displayName}`}
                  onClick={() => openEdit(member)}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${member.displayName}`}
                  onClick={() => deleteMember.mutate({ id: member.id })}
                >
                  <Trash2 />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {members.data?.length === 0 ? (
          <p className="text-muted-foreground text-sm">No members yet.</p>
        ) : null}
      </div>

      <Dialog
        open={editingId !== null}
        onOpenChange={(open) => !open && setEditingId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit member</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!editingId || !editName.trim()) return;
              updateMember.mutate({
                id: editingId,
                displayName: editName.trim(),
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="edit-member-name">Name</Label>
              <Input
                id="edit-member-name"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                required
              />
            </div>
            <DialogFooter className="px-0 pb-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingId(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMember.isPending}>
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
