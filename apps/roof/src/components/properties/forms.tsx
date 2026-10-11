"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@yourtoolshq/ui/button";
import { DateField } from "@yourtoolshq/ui/date-field";
import { Input } from "@yourtoolshq/ui/input";
import { Label } from "@yourtoolshq/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@yourtoolshq/ui/sheet";
import { Textarea } from "@yourtoolshq/ui/textarea";

import type { RouterOutputs } from "~/trpc/react";
import {
  documentAccept,
  documentMetadataSchema,
  documentTypeLabels,
  documentTypes,
} from "~/lib/documents";
import {
  eventCategoryLabels,
  eventFieldsSchema,
  eventStatusLabels,
} from "~/lib/events";
import { FileDropzone, useUpload } from "~/lib/uploads";
import { api } from "~/trpc/react";

type Detail = RouterOutputs["properties"]["detail"];
export type Property = Detail["property"];
export type HistoryEntry = Detail["events"][number];
export type Document = Detail["documents"][number];

const selectClass =
  "border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2";
export function SelectField({
  name,
  label,
  options,
  value,
  onChange,
  required = false,
}: {
  name: string;
  label: string;
  options: Record<string, string>;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <select
        className={selectClass}
        id={name}
        name={name}
        defaultValue={onChange ? undefined : value}
        value={onChange ? value : undefined}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        required={required}
      >
        {Object.entries(options).map(([key, text]) => (
          <option value={key} key={key}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}
export function Field({
  name,
  label,
  value,
  date = false,
  area = false,
  required = false,
  type = "text",
}: {
  name: string;
  label: string;
  value?: string | null;
  date?: boolean;
  area?: boolean;
  required?: boolean;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>
        {label}
        {required ? " *" : ""}
      </Label>
      {date ? (
        <DateField
          id={name}
          name={name}
          defaultValue={value ?? ""}
          required={required}
        />
      ) : area ? (
        <Textarea
          id={name}
          name={name}
          defaultValue={value ?? ""}
          rows={4}
          maxLength={4000}
        />
      ) : (
        <Input
          id={name}
          name={name}
          defaultValue={value ?? ""}
          required={required}
          type={type}
          maxLength={160}
        />
      )}
    </div>
  );
}
export function formValues(form: HTMLFormElement) {
  return Object.fromEntries(
    [...new FormData(form).entries()].map(([key, value]) => [
      key,
      typeof value === "string" && value.trim() === "" ? null : value,
    ]),
  );
}
export function Editor({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-8">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
export function FormEnd({
  pending,
  error,
  onClose,
  label = "Save changes",
}: {
  pending: boolean;
  error: string | null;
  onClose: () => void;
  label?: string;
}) {
  return (
    <>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button disabled={pending}>{pending ? "Saving…" : label}</Button>
      </div>
    </>
  );
}
export { PropertyEditor } from "./property-editor";
export function HistoryEditor({
  propertyId,
  entry,
  visit = false,
  onClose,
  onSaved,
}: {
  propertyId: string;
  entry?: HistoryEntry;
  visit?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [category, setCategory] = useState(
    entry?.category ?? (visit ? "visit" : "construction_change"),
  );
  const [error, setError] = useState<string | null>(null);
  const mutation = api.properties.saveEvent.useMutation();
  async function save(form: HTMLFormElement) {
    setError(null);
    const parsed = eventFieldsSchema.safeParse({
      ...formValues(form),
      propertyId,
    });
    if (!parsed.success) {
      setError(parsed.error.issues.map((issue) => issue.message).join(" "));
      return;
    }
    try {
      await mutation.mutateAsync({ ...parsed.data, id: entry?.id });
      toast.success("History entry saved");
      onSaved();
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save this entry. Try again.",
      );
    }
  }
  return (
    <Editor
      title={
        entry
          ? "Edit history entry"
          : visit
            ? "Schedule visit"
            : "Add history entry"
      }
      description="Keep appointments, decisions, correspondence, and issues with this property."
      onClose={onClose}
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save(e.currentTarget);
        }}
      >
        <Field
          name="title"
          label={category === "visit" ? "Visit purpose" : "Title"}
          value={entry?.title}
          required
        />
        <SelectField
          name="category"
          label="Category"
          options={eventCategoryLabels}
          value={category}
          onChange={(value) => setCategory(value as typeof category)}
        />
        <div className="grid grid-cols-2 gap-4">
          <Field
            name="eventDate"
            label="Date"
            date
            value={entry?.eventDate}
            required
          />
          <Field
            name="eventTime"
            label="Time (optional)"
            type="time"
            value={entry?.eventTime}
          />
        </div>
        <p className="text-muted-foreground text-xs">
          Dates and times are local to the property, without timezone
          conversion.
        </p>
        <SelectField
          name="status"
          label="Status"
          options={eventStatusLabels}
          value={entry?.status ?? (visit ? "planned" : "completed")}
        />
        <Field
          name="notes"
          label="Notes (optional)"
          area
          value={entry?.notes}
        />
        <p className="text-muted-foreground text-sm">
          After saving, attach photos or documents from the history entry.
        </p>
        <FormEnd
          pending={mutation.isPending}
          error={error}
          onClose={onClose}
          label="Save entry"
        />
      </form>
    </Editor>
  );
}
export function DocumentEditor({
  propertyId,
  events,
  document,
  eventId,
  insuranceId,
  insurance,
  onClose,
  onSaved,
}: {
  propertyId: string;
  events: HistoryEntry[];
  document?: Document;
  eventId?: string;
  insuranceId?: string;
  insurance: Detail["insurance"];
  onClose: () => void;
  onSaved: () => void;
}) {
  const upload = useUpload("document");
  const [error, setError] = useState<string | null>(null);
  const create = api.properties.attachDocument.useMutation();
  const update = api.properties.updateDocument.useMutation();
  async function save(form: HTMLFormElement) {
    setError(null);
    const parsed = documentMetadataSchema.safeParse(formValues(form));
    if (!parsed.success) {
      setError(parsed.error.issues.map((issue) => issue.message).join(" "));
      return;
    }
    if (!document && !upload.file) {
      setError("Choose and upload a file before saving.");
      return;
    }
    try {
      if (document)
        await update.mutateAsync({ ...parsed.data, id: document.id });
      else
        await create.mutateAsync({
          ...parsed.data,
          propertyId,
          file: upload.file!.token,
        });
      toast.success("Document saved");
      onSaved();
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save this document. Try again.",
      );
    }
  }
  return (
    <Editor
      title={document ? "Edit document" : "Add document"}
      description="Preserve the original file with its property and optional history entry."
      onClose={onClose}
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save(e.currentTarget);
        }}
      >
        {!document && (
          <div className="space-y-2">
            <Label htmlFor="file">File *</Label>
            <FileDropzone id="file" upload={upload} accept={documentAccept} />
            <p className="text-muted-foreground text-xs">
              PDF, images, and exported emails (.eml), up to 25 MB. Add each
              file separately.
            </p>
          </div>
        )}
        <Field
          name="title"
          label="Document title"
          value={document?.title}
          required
        />
        <SelectField
          name="type"
          label="Type"
          options={Object.fromEntries(
            documentTypes.map((key) => [key, documentTypeLabels[key]]),
          )}
          value={document?.type ?? "other"}
        />
        <Field
          name="documentDate"
          label="Document date (optional)"
          date
          value={document?.documentDate}
        />
        <SelectField
          name="eventId"
          label="History entry (optional)"
          options={{
            "": "Property reference document",
            ...Object.fromEntries(
              events.map((entry) => [entry.id, entry.title]),
            ),
          }}
          value={document?.eventId ?? eventId ?? ""}
        />
        <SelectField
          name="insuranceId"
          label="Insurance record (optional)"
          options={{
            "": "No insurance record",
            ...Object.fromEntries(
              insurance.map((record) => [
                record.id,
                `${record.provider ?? "Insurance"} ${record.policyNumber ?? ""}`,
              ]),
            ),
          }}
          value={document?.insuranceId ?? insuranceId ?? ""}
        />
        <Field
          name="notes"
          label="Document notes (optional)"
          area
          value={document?.notes}
        />
        <FormEnd
          pending={
            create.isPending ||
            update.isPending ||
            upload.status === "uploading"
          }
          error={error}
          onClose={onClose}
          label="Save document"
        />
      </form>
    </Editor>
  );
}
