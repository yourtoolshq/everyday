"use client";

import { useState } from "react";
import { Pencil, Plus, Shield, Trash2 } from "lucide-react";
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
import { insuranceFieldsSchema, insuranceStatus } from "~/lib/insurance";
import { formatDateLabel } from "~/lib/properties";
import { api } from "~/trpc/react";
import { Editor, Field, FormEnd, formValues } from "./forms";
import { DocumentRow } from "./workspace";

type Insurance = RouterOutputs["properties"]["detail"]["insurance"][number];
export function InsuranceSection({
  property,
  records,
  documents,
  refresh,
  onAttach,
  onEditDocument,
  onDeleteDocument,
}: {
  property: Property;
  records: Insurance[];
  documents: Document[];
  refresh: () => void;
  onAttach: (id: string) => void;
  onEditDocument: (document: Document) => void;
  onDeleteDocument: (document: Document) => void;
}) {
  const [editing, setEditing] = useState<{ record?: Insurance } | null>(null);
  const [deleting, setDeleting] = useState<Insurance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const remove = api.properties.deleteInsurance.useMutation();
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <Shield className="text-primary size-5" aria-hidden />
            Insurance
          </h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Policy details and original documents, kept with this place.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing({})}>
          <Plus aria-hidden />
          Add insurance
        </Button>
      </div>
      {records.length ? (
        <div className="space-y-3">
          {records.map((record) => (
            <article
              key={record.id}
              className="space-y-4 rounded-xl border p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-semibold">
                    {record.provider ?? "Insurance policy"}
                  </h4>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {record.type === "tenant"
                      ? "Tenant insurance"
                      : "Home insurance"}
                    {record.policyNumber ? ` · ${record.policyNumber}` : ""}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit insurance ${record.provider ?? record.policyNumber}`}
                    onClick={() => setEditing({ record })}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete insurance ${record.provider ?? record.policyNumber}`}
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
                  {insuranceStatus(record, today)}
                </Badge>
                <p className="text-muted-foreground text-xs">
                  {formatDateLabel(record.startsOn) ?? "Start not set"} —{" "}
                  {formatDateLabel(record.endsOn) ?? "End not set"}
                </p>
              </div>
              {record.notes && (
                <p className="text-sm whitespace-pre-wrap">{record.notes}</p>
              )}
              <div className="space-y-2">
                {documents
                  .filter((document) => document.insuranceId === record.id)
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
                  Attach policy document
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-sm">
          No insurance records yet. Add policy details now and attach the
          original document when you have it.
        </p>
      )}
      {editing && (
        <InsuranceEditor
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
            <AlertDialogTitle>Delete this insurance record?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the policy metadata. Its documents stay with the
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
                      toast.success("Insurance record deleted");
                    })
                    .catch((cause: unknown) =>
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "Could not delete insurance.",
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
function InsuranceEditor({
  property,
  record,
  onClose,
  onSaved,
}: {
  property: Property;
  record?: Insurance;
  onClose: () => void;
  onSaved: () => void;
}) {
  const save = api.properties.saveInsurance.useMutation();
  const [error, setError] = useState<string | null>(null);
  async function submit(form: HTMLFormElement) {
    setError(null);
    const parsed = insuranceFieldsSchema.safeParse({
      ...formValues(form),
      propertyId: property.id,
      type: property.relationship === "rental" ? "tenant" : "home",
    });
    if (!parsed.success) {
      setError(parsed.error.issues.map((issue) => issue.message).join(" "));
      return;
    }
    try {
      await save.mutateAsync({ ...parsed.data, id: record?.id });
      toast.success("Insurance saved");
      onSaved();
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save insurance.",
      );
    }
  }
  return (
    <Editor
      title={record ? "Edit insurance" : "Add insurance"}
      description={`Keep ${property.relationship === "rental" ? "tenant" : "home"} insurance with ${property.name}. Attach documents after saving.`}
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
          name="provider"
          label="Insurance provider"
          value={record?.provider}
        />
        <Field
          name="policyNumber"
          label="Policy number"
          value={record?.policyNumber}
        />
        <p className="text-muted-foreground text-xs">
          Enter a provider or policy number. Other details are optional.
        </p>
        <Field
          name="startsOn"
          label="Coverage starts (optional)"
          date
          value={record?.startsOn}
        />
        <Field
          name="endsOn"
          label="Coverage ends (optional)"
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
          label="Save insurance"
        />
      </form>
    </Editor>
  );
}
