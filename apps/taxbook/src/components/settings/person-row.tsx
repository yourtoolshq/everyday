"use client";

import { IconTrash } from "@tabler/icons-react";
import { useState, type FormEvent } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { type RouterOutputs } from "~/trpc/react";

type Person = RouterOutputs["settings"]["get"]["people"][number];

export function PersonRow({
  person,
  canDelete,
  pending,
  onRename,
  onDelete,
}: {
  person: Person;
  canDelete: boolean;
  pending: boolean;
  onRename: (id: number, name: string) => void;
  onDelete: (person: Person) => void;
}) {
  const [name, setName] = useState(person.name);
  const changed = name.trim() !== person.name;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (changed) onRename(person.id, name);
  }

  return (
    <form className="flex items-center gap-2" onSubmit={submit}>
      <Input aria-label={`Name for ${person.name}`} value={name} onChange={(event) => setName(event.target.value)} required />
      <Button type="submit" variant="outline" disabled={!changed || pending}>Save</Button>
      <Button type="button" variant="ghost" size="icon" disabled={!canDelete || pending} aria-label={`Remove ${person.name}`} title={canDelete ? "Remove person" : "At least one person is required"} onClick={() => onDelete(person)}>
        <IconTrash />
      </Button>
    </form>
  );
}
