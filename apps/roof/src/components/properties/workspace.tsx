"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  FileText,
  Home,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { DocumentActionButtons } from "@yourtoolshq/data-ui";
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
import { Card, CardContent, CardHeader, CardTitle } from "@yourtoolshq/ui/card";
import { Skeleton } from "@yourtoolshq/ui/skeleton";

import type { Document, HistoryEntry, Property } from "./forms";
import { documentTypeLabels, formatFileSize } from "~/lib/documents";
import { eventCategoryLabels, eventStatusLabels } from "~/lib/events";
import {
  formatDateLabel,
  formatPropertyAddress,
  propertyKindLabels,
  propertyKinds,
} from "~/lib/properties";
import { api } from "~/trpc/react";
import { DocumentEditor, HistoryEditor, PropertyEditor } from "./forms";

function Loading() {
  return (
    <div className="space-y-4" aria-label="Loading properties">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
function Failure({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div role="alert" className="space-y-3 rounded-lg border p-6">
      <p>{message}</p>
      <Button variant="outline" onClick={retry}>
        Try again
      </Button>
      <Button variant="ghost" asChild>
        <Link href="/">Back to properties</Link>
      </Button>
    </div>
  );
}
export function PropertiesWorkspace() {
  const router = useRouter();
  const query = api.properties.list.useQuery();
  const [adding, setAdding] = useState(false);
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-6 md:px-8 md:py-9">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl space-y-2">
          <h2 className="text-3xl font-semibold tracking-tight">
            Your places, over time
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            From the first purchase agreement to your last rental. Keep each
            place’s details, visits, and documents together.
          </p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus aria-hidden />
          Add property
        </Button>
      </div>
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <Failure
          message={query.error.message}
          retry={() => void query.refetch()}
        />
      ) : query.data?.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-14 text-center">
          <Home className="text-primary mx-auto mb-4 size-9" aria-hidden />
          <h3 className="text-lg font-medium">Start with a place</h3>
          <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
            Add the home you’re purchasing, your current rental, or a previous
            address. You can fill in the details later.
          </p>
          <Button className="mt-5" onClick={() => setAdding(true)}>
            Add your first property
          </Button>
        </div>
      ) : (
        <div className="space-y-7">
          {propertyKinds.map((kind) => {
            const properties =
              query.data?.filter((property) => property.kind === kind) ?? [];
            if (!properties.length) return null;
            return (
              <section key={kind} className="space-y-3">
                <h3 className="flex items-center gap-2 text-base font-medium">
                  {propertyKindLabels[kind]}
                  <span className="text-muted-foreground text-sm">
                    {properties.length}
                  </span>
                </h3>
                <div className="grid gap-4 lg:grid-cols-2">
                  {properties.map((property) => (
                    <Link
                      key={property.id}
                      href={`/properties/${property.id}`}
                      className="group focus-visible:ring-ring rounded-xl focus-visible:ring-2"
                    >
                      <Card className="hover:border-primary/50 h-full shadow-none transition-colors">
                        <CardContent className="flex gap-4 p-5">
                          <div className="bg-secondary text-primary flex size-11 shrink-0 items-center justify-center rounded-lg">
                            <Home aria-hidden className="size-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="flex items-center justify-between gap-2 text-lg font-semibold">
                              {property.name}
                              <ArrowUpRight
                                aria-hidden
                                className="text-muted-foreground size-4 shrink-0"
                              />
                            </h4>
                            <p className="text-muted-foreground mt-1 text-sm whitespace-pre-line">
                              {formatPropertyAddress(property) ??
                                "Address not added"}
                            </p>
                            <p className="text-primary mt-4 text-xs font-medium">
                              {kind === "under_construction"
                                ? `Expected possession: ${formatDateLabel(property.targetPossessionDate) ?? "Not set"}`
                                : kind === "past_rental"
                                  ? `Moved out: ${formatDateLabel(property.moveOutDate) ?? "Not set"}`
                                  : kind === "owned"
                                    ? `Moved in: ${formatDateLabel(property.moveInDate) ?? "Not set"}`
                                    : `Lease ends: ${formatDateLabel(property.leaseEndDate) ?? "Not set"}`}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
      {adding && (
        <PropertyEditor
          onClose={() => setAdding(false)}
          onSaved={(id) => {
            void query.refetch();
            router.push(`/properties/${id}`);
          }}
        />
      )}
    </main>
  );
}
function DetailLine({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return value ? (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1 text-sm break-words whitespace-pre-line">{value}</dd>
    </div>
  ) : null;
}
function PropertyDetails({ property }: { property: Property }) {
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Property details</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-4">
          <DetailLine
            label="Expected possession"
            value={formatDateLabel(property.targetPossessionDate)}
          />
          <DetailLine
            label="Move-in"
            value={formatDateLabel(property.moveInDate)}
          />
          <DetailLine
            label="Move-out"
            value={formatDateLabel(property.moveOutDate)}
          />
          <DetailLine
            label="Lease starts"
            value={formatDateLabel(property.leaseStartDate)}
          />
          <DetailLine
            label="Lease ends"
            value={formatDateLabel(property.leaseEndDate)}
          />
          <DetailLine label="Lease notes" value={property.leaseNotes} />
          <DetailLine
            label="Landlord or property manager"
            value={property.landlordName}
          />
          <DetailLine label="Email" value={property.landlordEmail} />
          <DetailLine label="Phone" value={property.landlordPhone} />
          <DetailLine
            label="Tenant insurance"
            value={property.renterInsuranceProvider}
          />
          <DetailLine
            label="Policy number"
            value={property.renterInsurancePolicyNumber}
          />
          <DetailLine
            label="Insurance renewal or expiry"
            value={formatDateLabel(property.renterInsuranceExpiresOn)}
          />
          <DetailLine label="Notes" value={property.notes} />
        </dl>
        <p className="text-muted-foreground mt-5 text-xs">
          Update the relationship after possession or moving out. Your history
          and files stay here.
        </p>
      </CardContent>
    </Card>
  );
}
export function PropertyWorkspace({ id }: { id: string }) {
  const query = api.properties.detail.useQuery({ id }, { retry: false });
  const [editProperty, setEditProperty] = useState(false);
  const [history, setHistory] = useState<{
    entry?: HistoryEntry;
    visit?: boolean;
  } | null>(null);
  const [document, setDocument] = useState<{
    document?: Document;
    eventId?: string;
  } | null>(null);
  const [deleting, setDeleting] = useState<{
    type: "event" | "document";
    id: string;
    title: string;
  } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteEvent = api.properties.deleteEvent.useMutation();
  const deleteDocument = api.properties.deleteDocument.useMutation();
  const refresh = () => {
    void query.refetch();
  };
  async function confirmDelete() {
    if (!deleting) return;
    setDeleteError(null);
    try {
      if (deleting.type === "event")
        await deleteEvent.mutateAsync({ id: deleting.id });
      else await deleteDocument.mutateAsync({ id: deleting.id });
      toast.success("Record deleted");
      setDeleting(null);
      refresh();
    } catch (cause) {
      setDeleteError(
        cause instanceof Error ? cause.message : "Could not delete. Try again.",
      );
    }
  }
  if (query.isLoading)
    return (
      <main className="p-6">
        <Loading />
      </main>
    );
  if (query.error || !query.data)
    return (
      <main className="p-6">
        <Failure
          message={query.error?.message ?? "Property not found."}
          retry={refresh}
        />
      </main>
    );
  const { property, events, documents } = query.data;
  const upcoming = events
    .filter((entry) => entry.category === "visit" && entry.status === "planned")
    .sort((a, b) =>
      `${a.eventDate}${a.eventTime ?? ""}`.localeCompare(
        `${b.eventDate}${b.eventTime ?? ""}`,
      ),
    );
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-7 px-4 py-6 md:px-8 md:py-9">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link href="/">
          <ArrowLeft aria-hidden />
          All properties
        </Link>
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <Badge variant="secondary">{propertyKindLabels[property.kind]}</Badge>
          <h2 className="text-3xl font-semibold tracking-tight">
            {property.name}
          </h2>
          <p className="text-muted-foreground flex items-start gap-2 text-sm whitespace-pre-line">
            <MapPin aria-hidden className="mt-0.5 size-4 shrink-0" />
            {formatPropertyAddress(property) ?? "Address not added"}
          </p>
        </div>
        <Button variant="outline" onClick={() => setEditProperty(true)}>
          <Pencil aria-hidden />
          Edit property
        </Button>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-7">
          <section className="bg-secondary/60 rounded-xl border p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 font-semibold">
                <CalendarDays aria-hidden className="text-primary size-5" />
                Planned visits
              </h3>
              <Button size="sm" onClick={() => setHistory({ visit: true })}>
                <Plus aria-hidden />
                Schedule visit
              </Button>
            </div>
            {upcoming.length ? (
              <div className="mt-4 space-y-2">
                {upcoming.map((entry) => (
                  <button
                    key={entry.id}
                    className="bg-card hover:border-primary/50 flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-left"
                    onClick={() => setHistory({ entry })}
                  >
                    <span className="font-medium">{entry.title}</span>
                    <span className="text-muted-foreground text-sm">
                      {formatDateLabel(entry.eventDate)}
                      {entry.eventTime ? ` at ${entry.eventTime}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground mt-3 text-sm">
                No visits planned. Schedule a structure visit, walkthrough, or
                inspection.
              </p>
            )}
          </section>
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Property history</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  Visits, changes, decisions, and correspondence.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHistory({})}
              >
                <Plus aria-hidden />
                Add entry
              </Button>
            </div>
            {events.length ? (
              <div className="divide-y rounded-xl border">
                {events.map((entry) => (
                  <article key={entry.id} className="space-y-3 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <p className="text-muted-foreground text-xs">
                          {formatDateLabel(entry.eventDate)}
                          {entry.eventTime ? ` · ${entry.eventTime}` : ""}
                        </p>
                        <h4 className="font-semibold">{entry.title}</h4>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">
                            {eventCategoryLabels[entry.category]}
                          </Badge>
                          <Badge variant="secondary">
                            {eventStatusLabels[entry.status]}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex shrink-0">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${entry.title}`}
                          onClick={() => setHistory({ entry })}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${entry.title}`}
                          onClick={() => {
                            setDeleteError(null);
                            setDeleting({
                              type: "event",
                              id: entry.id,
                              title: entry.title,
                            });
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                    {entry.notes && (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {entry.notes}
                      </p>
                    )}
                    <div className="space-y-2">
                      {documents
                        .filter((doc) => doc.eventId === entry.id)
                        .map((doc) => (
                          <DocumentRow
                            key={doc.id}
                            document={doc}
                            onEdit={() => setDocument({ document: doc })}
                            onDelete={() => {
                              setDeleteError(null);
                              setDeleting({
                                type: "document",
                                id: doc.id,
                                title: doc.title,
                              });
                            }}
                          />
                        ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-primary -ml-2"
                        onClick={() => setDocument({ eventId: entry.id })}
                      >
                        <Plus aria-hidden />
                        Attach photo or document
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-sm">
                No history yet. Record a purchase milestone, lease change, or an
                issue you want to remember.
              </p>
            )}
          </section>
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Reference documents</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  Agreements, leases, plans, and other property files.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDocument({})}
              >
                <Plus aria-hidden />
                Add document
              </Button>
            </div>
            {documents.filter((doc) => !doc.eventId).length ? (
              <div className="space-y-2">
                {documents
                  .filter((doc) => !doc.eventId)
                  .map((doc) => (
                    <DocumentRow
                      key={doc.id}
                      document={doc}
                      onEdit={() => setDocument({ document: doc })}
                      onDelete={() => {
                        setDeleteError(null);
                        setDeleting({
                          type: "document",
                          id: doc.id,
                          title: doc.title,
                        });
                      }}
                    />
                  ))}
              </div>
            ) : (
              <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-sm">
                No reference documents yet. Upload an original file to keep it
                with this property.
              </p>
            )}
          </section>
        </div>
        <PropertyDetails property={property} />
      </div>
      {editProperty && (
        <PropertyEditor
          property={property}
          onClose={() => setEditProperty(false)}
          onSaved={refresh}
        />
      )}
      {history && (
        <HistoryEditor
          propertyId={id}
          {...history}
          onClose={() => setHistory(null)}
          onSaved={refresh}
        />
      )}
      {document && (
        <DocumentEditor
          propertyId={id}
          events={events}
          {...document}
          onClose={() => setDocument(null)}
          onSaved={refresh}
        />
      )}
      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.type === "event"
                ? "This removes the history entry. Its documents remain with the property as reference documents."
                : "This removes the document and its stored original file. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p role="alert" className="text-destructive text-sm">
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteEvent.isPending || deleteDocument.isPending}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteEvent.isPending || deleteDocument.isPending}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
function DocumentRow({
  document,
  onEdit,
  onDelete,
}: {
  document: Document;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-card flex items-start gap-3 rounded-lg border p-3">
      <FileText aria-hidden className="text-primary mt-1 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium break-words">{document.title}</p>
        <p className="text-muted-foreground mt-1 text-xs break-all">
          {document.originalFilename} · {formatFileSize(document.sizeBytes)}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          {documentTypeLabels[document.type]}
          {document.documentDate
            ? ` · ${formatDateLabel(document.documentDate)}`
            : ""}
        </p>
        {document.notes && (
          <p className="mt-2 text-sm whitespace-pre-wrap">{document.notes}</p>
        )}
      </div>
      <DocumentActionButtons
        fileId={document.fileId}
        title={document.title}
        mimeType={document.mimeType}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
}
