"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
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
  const deleteMember = api.people.delete.useMutation({
    onSuccess: async () => {
      await utils.people.list.invalidate();
      toast.success("Member removed.");
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
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${member.displayName}`}
                onClick={() => deleteMember.mutate({ id: member.id })}
              >
                <Trash2 />
              </Button>
            </CardContent>
          </Card>
        ))}
        {members.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members yet.</p>
        ) : null}
      </div>
    </div>
  );
}
