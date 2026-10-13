"use client";

import { useState } from "react";
import { Pencil, Plus, ScrollText, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@yourtoolshq/ui/alert-dialog";
import { Badge } from "@yourtoolshq/ui/badge";
import { Button } from "@yourtoolshq/ui/button";

import type { Document, Property } from "./forms";
import type { RouterOutputs } from "~/trpc/react";
import { leaseFieldsSchema, leaseStatus, leaseSummary } from "~/lib/leases";
import { formatDateLabel } from "~/lib/properties";
import { api } from "~/trpc/react";
import { Editor, Field, FormEnd, formValues, SelectField } from "./forms";
import { DocumentRow } from "./workspace";

type Lease = RouterOutputs["properties"]["detail"]["leases"][number];
export function LeaseSection({
  property,
  records,
  documents,
  refresh,
  onAttach,
  onEditDocument,
  onDeleteDocument,
}: {
  property: Property;
  records: Lease[];
  documents: Document[];
  refresh: () => void;
  onAttach: (id: string) => void;
  onEditDocument: (document: Document) => void;
  onDeleteDocument: (document: Document) => void;
}) {
  const [editing, setEditing] = useState<{ record?: Lease } | null>(null);
  const [deleting, setDeleting] = useState<Lease | null>(null);
  const [error, setError] = useState<string | null>(null);
  const remove = api.properties.deleteLease.useMutation();
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <ScrollText className="text-primary size-5" aria-hidden />
            Leases
          </h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Lease terms, renewals, and original documents, kept with this
            rental.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing({})}>
          <Plus aria-hidden />
          Add lease
        </Button>
      </div>
      <p role="status" className="text-sm">
        {leaseSummary(records, today)}
      </p>
      {records.length ? (
        <div className="space-y-3">
          {[...records]
            .sort((a, b) => {
              const rank = {
                Active: 0,
                Upcoming: 1,
                "Dates incomplete": 2,
                Ended: 3,
              };
              return rank[leaseStatus(a, today)] - rank[leaseStatus(b, today)];
            })
            .map((record) => (
              <article
                key={record.id}
                className={`space-y-4 rounded-xl border p-5 ${leaseStatus(record, today) === "Active" ? "border-primary" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="font-semibold break-words">
                      {record.title}
                    </h4>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {record.termType === "fixed_term"
                        ? "Fixed term"
                        : "Month-to-month"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit lease ${record.title}`}
                      onClick={() => setEditing({ record })}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete lease ${record.title}`}
                      onClick={() => {
                        setError(null);
                        setDeleting(record);
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="secondary">
                    {leaseStatus(record, today)}
                  </Badge>
                  <p className="text-muted-foreground text-xs">
                    {formatDateLabel(record.startsOn) ?? "Start not set"} —{" "}
                    {formatDateLabel(record.endsOn) ?? "No end recorded"}
                  </p>
                </div>
                {record.notes && (
                  <p className="text-sm whitespace-pre-wrap">{record.notes}</p>
                )}
                <div className="space-y-2">
                  {documents
                    .filter((document) => document.leaseId === record.id)
                    .map((document) => (
                      <DocumentRow
                        key={document.id}
                        document={document}
                        onEdit={() => onEditDocument(document)}
                        onDelete={() => onDeleteDocument(document)}
                      />
                    ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-primary -ml-2"
                    onClick={() => onAttach(record.id)}
                  >
                    <Plus aria-hidden />
                    Attach lease document
                  </Button>
                </div>
              </article>
            ))}
        </div>
      ) : (
        <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-sm">
          No leases yet. Add a lease or renewal, then attach the signed
          agreement or confirmation emails.
        </p>
      )}
      {editing && (
        <LeaseEditor
          property={property}
          record={editing.record}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the lease details. Its documents stay with the
              property as reference documents.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleting)
                  void remove
                    .mutateAsync({ id: deleting.id })
                    .then(() => {
                      setDeleting(null);
                      refresh();
                      toast.success("Lease record deleted");
                    })
                    .catch((cause: unknown) =>
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "Could not delete lease.",
                      ),
                    );
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
function LeaseEditor({
  property,
  record,
  onClose,
  onSaved,
}: {
  property: Property;
  record?: Lease;
  onClose: () => void;
  onSaved: () => void;
}) {
  const save = api.properties.saveLease.useMutation();
  const [error, setError] = useState<string | null>(null);
  async function submit(form: HTMLFormElement) {
    setError(null);
    const parsed = leaseFieldsSchema.safeParse({
      ...formValues(form),
      propertyId: property.id,
    });
    if (!parsed.success) {
      setError(parsed.error.issues.map((issue) => issue.message).join(" "));
      return;
    }
    try {
      await save.mutateAsync({ ...parsed.data, id: record?.id });
      toast.success("Lease saved");
      onSaved();
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save lease.",
      );
    }
  }
  return (
    <Editor
      title={record ? "Edit lease" : "Add lease"}
      description={`Keep a lease or renewal with ${property.name}. Attach documents after saving.`}
      onClose={onClose}
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(e.currentTarget);
        }}
      >
        <Field
          name="title"
          label="Lease title"
          required
          value={record?.title}
        />
        <SelectField
          name="termType"
          label="Term type"
          options={{
            fixed_term: "Fixed term",
            month_to_month: "Month-to-month",
          }}
          value={record?.termType ?? "fixed_term"}
        />
        <p className="text-muted-foreground text-xs">
          Dates determine the status. Record month-to-month continuation as a
          separate lease; an expired fixed term does not continue automatically.
        </p>
        <Field
          name="startsOn"
          label="Lease starts (optional)"
          date
          value={record?.startsOn}
        />
        <Field
          name="endsOn"
          label="Lease ends (optional)"
          date
          value={record?.endsOn}
        />
        <Field
          name="notes"
          label="Notes (optional)"
          area
          value={record?.notes}
        />
        <FormEnd
          pending={save.isPending}
          error={error}
          onClose={onClose}
          label="Save lease"
        />
      </form>
    </Editor>
  );
}
