"use client";

import { IconArrowLeft, IconEdit, IconFileDescription, IconPlus } from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { RecordFormSheet } from "~/components/records/record-form-sheet";
import { RecordsTable } from "~/components/records/records-table";
import { TaxDocumentFormSheet } from "~/components/tax-documents/tax-document-form-sheet";
import { TaxDocumentsTable } from "~/components/tax-documents/tax-documents-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { formatCad } from "~/domain/money";
import { itemTypeLabels, taxTreatmentLabels } from "~/domain/tax-item";
import { api, type RouterOutputs } from "~/trpc/react";
import { ItemFormSheet } from "./item-form-sheet";
import { ItemStatusBadge } from "./item-status-badge";

type RecordItem = RouterOutputs["record"]["list"]["items"][number];
type TaxDocument = RouterOutputs["taxDocument"]["list"]["items"][number];

export function TaxItemDetail({ id }: { id: number }) {
  const utils = api.useUtils();
  const itemQuery = api.taxItem.get.useQuery({ id });
  const recordsQuery = api.record.list.useQuery({ taxItemId: id });
  const documentsQuery = api.taxDocument.list.useQuery({ taxItemId: id });
  const settingsQuery = api.settings.get.useQuery();
  const [recordFormOpen, setRecordFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RecordItem | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<RecordItem | null>(null);
  const [deletingPending, setDeletingPending] = useState(false);
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [documentFormOpen, setDocumentFormOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<TaxDocument | null>(null);
  const [deletingDocument, setDeletingDocument] = useState<TaxDocument | null>(null);
  const [documentDeletePending, setDocumentDeletePending] = useState(false);

  if (itemQuery.isLoading || recordsQuery.isLoading || documentsQuery.isLoading || settingsQuery.isLoading) {
    return <div className="space-y-5 p-6"><Skeleton className="h-20 w-full" /><div className="grid gap-4 sm:grid-cols-3"><Skeleton className="h-28 rounded-xl" /><Skeleton className="h-28 rounded-xl" /><Skeleton className="h-28 rounded-xl" /></div><Skeleton className="h-80 rounded-xl" /></div>;
  }
  const error = itemQuery.error ?? recordsQuery.error ?? documentsQuery.error ?? settingsQuery.error;
  if (error || !itemQuery.data || !recordsQuery.data || !documentsQuery.data || !settingsQuery.data) {
    return <div className="p-6"><Button asChild variant="ghost" className="mb-4"><Link href="/items"><IconArrowLeft /> Tax Items</Link></Button><p className="text-sm text-destructive">Unable to load this Tax Item. {error?.message}</p></div>;
  }

  const item = itemQuery.data.item;
  const recordItems = recordsQuery.data.items;
  const documentItems = documentsQuery.data.items;
  const canAdd = item.valueSource !== "paycheques";

  function addRecord() {
    setEditingRecord(null);
    setRecordFormOpen(true);
  }

  function editRecord(record: RecordItem) {
    setEditingRecord(record);
    setRecordFormOpen(true);
  }

  function addDocument() {
    setEditingDocument(null);
    setDocumentFormOpen(true);
  }

  function editDocument(document: TaxDocument) {
    setEditingDocument(document);
    setDocumentFormOpen(true);
  }

  async function removeDocument() {
    if (!deletingDocument) return;
    setDocumentDeletePending(true);
    try {
      const response = await fetch(`/api/tax-documents/${deletingDocument.id}`, { method: "DELETE" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to delete the Tax Document.");
      setDeletingDocument(null);
      await Promise.all([
        utils.taxDocument.list.invalidate(),
        utils.taxDocument.overview.invalidate(),
      ]);
      toast.success("Tax Document deleted.");
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Unable to delete the Tax Document.");
    } finally {
      setDocumentDeletePending(false);
    }
  }

  async function removeRecord() {
    if (!deletingRecord) return;
    setDeletingPending(true);
    try {
      const response = await fetch(`/api/records/${deletingRecord.id}`, { method: "DELETE" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to delete the Record.");
      setDeletingRecord(null);
      await Promise.all([
        utils.record.list.invalidate({ taxItemId: id }),
        utils.taxItem.get.invalidate({ id }),
        utils.taxItem.list.invalidate(),
        utils.taxItem.overview.invalidate(),
        utils.taxEstimate.get.invalidate(),
      ]);
      toast.success("Record deleted.");
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Unable to delete the Record.");
    } finally {
      setDeletingPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 p-6">
      <div>
        <Button asChild variant="ghost" className="-ml-3 mb-2"><Link href="/items"><IconArrowLeft /> Tax Items</Link></Button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary">{itemQuery.data.year.year} tax year</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">{item.name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">{itemTypeLabels[item.type]}</Badge>
              <ItemStatusBadge status={item.status} />
              <span>{item.personName ?? "Household"}</span>
              {item.taxLineReference ? <span>· {item.taxLineReference}</span> : null}
              {item.taxTreatment ? <Badge variant="outline">{taxTreatmentLabels[item.taxTreatment]}</Badge> : <Badge variant="outline">Tracking only</Badge>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setItemFormOpen(true)}><IconEdit /> Edit Tax Item</Button>
            <Button variant="outline" onClick={addDocument}><IconFileDescription /> Add Tax Document</Button>
            <Button onClick={addRecord} disabled={!canAdd}><IconPlus /> Add Record</Button>
          </div>
        </div>
      </div>

      {!canAdd ? <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">This Tax Item is calculated from Paycheques, so supporting Records cannot be added here.</div> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader className="pb-1"><CardDescription>Expected amount</CardDescription><CardTitle className="text-xl tabular-nums">{formatCad(item.expectedAmountCents)}</CardTitle></CardHeader></Card>
        <Card className={item.valueSource === "records" ? "bg-gradient-to-b from-primary/[0.06] to-card" : undefined}><CardHeader className="pb-1"><CardDescription>Actual amount</CardDescription><CardTitle className="text-xl tabular-nums">{formatCad(item.actualAmountCents)}</CardTitle></CardHeader><CardContent><p className="text-xs text-muted-foreground">{item.valueSource === "records" ? "Calculated from Records" : item.valueSource === "paycheques" ? "Calculated from Paycheques" : "Entered manually"}</p></CardContent></Card>
        <Card><CardHeader className="pb-1"><CardDescription>Supporting Records</CardDescription><CardTitle className="text-xl">{recordItems.length.toLocaleString()}</CardTitle></CardHeader><CardContent><p className="text-xs text-muted-foreground">{recordItems.filter((record) => record.attachmentFileName).length.toLocaleString()} with attachments</p></CardContent></Card>
        <Card><CardHeader className="pb-1"><CardDescription>Tax Documents</CardDescription><CardTitle className="text-xl">{documentItems.length.toLocaleString()}</CardTitle></CardHeader><CardContent><p className="text-xs text-muted-foreground">{documentItems.filter((document) => document.status === "expected").length.toLocaleString()} still expected</p></CardContent></Card>
      </div>

      {item.notes ? <Card><CardHeader><CardDescription>Tax Item notes</CardDescription></CardHeader><CardContent className="whitespace-pre-wrap text-sm">{item.notes}</CardContent></Card> : null}

      <div className="flex items-end justify-between gap-4">
        <div><h3 className="text-lg font-semibold">Tax Documents</h3><p className="text-sm text-muted-foreground">Official slips expected for this Tax Item.</p></div>
        {documentItems.length > 0 ? <Button variant="outline" onClick={addDocument}><IconFileDescription /> Add Tax Document</Button> : null}
      </div>
      <TaxDocumentsTable items={documentItems} onAdd={addDocument} onEdit={editDocument} onDelete={setDeletingDocument} />

      <div className="flex items-end justify-between gap-4">
        <div><h3 className="text-lg font-semibold">Records</h3><p className="text-sm text-muted-foreground">Amounts are listed newest first and counted toward the actual total.</p></div>
        {recordItems.length > 0 && canAdd ? <Button variant="outline" onClick={addRecord}><IconPlus /> Add Record</Button> : null}
      </div>
      <RecordsTable items={recordItems} canAdd={canAdd} onAdd={addRecord} onEdit={editRecord} onDelete={setDeletingRecord} />

      {recordFormOpen ? <RecordFormSheet key={editingRecord?.id ?? "new"} item={item} record={editingRecord} people={settingsQuery.data.people} open={recordFormOpen} onOpenChange={setRecordFormOpen} /> : null}
      {documentFormOpen ? <TaxDocumentFormSheet key={editingDocument?.id ?? "new"} item={item} document={editingDocument} people={settingsQuery.data.people} open={documentFormOpen} onOpenChange={setDocumentFormOpen} /> : null}
      {itemFormOpen ? <ItemFormSheet key={item.id} item={item} people={settingsQuery.data.people} open={itemFormOpen} onOpenChange={setItemFormOpen} /> : null}

      <AlertDialog open={Boolean(deletingRecord)} onOpenChange={(open) => !open && setDeletingRecord(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this Record?</AlertDialogTitle><AlertDialogDescription>“{deletingRecord?.description}” and its attachment will be permanently removed. The Tax Item actual amount will be recalculated. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" disabled={deletingPending} onClick={() => void removeRecord()}>{deletingPending ? "Deleting…" : "Delete Record"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deletingDocument)} onOpenChange={(open) => !open && setDeletingDocument(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this Tax Document?</AlertDialogTitle><AlertDialogDescription>“{deletingDocument?.issuer}” and its attachment will be permanently removed. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" disabled={documentDeletePending} onClick={() => void removeDocument()}>{documentDeletePending ? "Deleting…" : "Delete Tax Document"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
