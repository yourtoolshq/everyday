"use client";

import { Download, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { claimStatusLabels } from "~/lib/benefits";
import {
  documentTypeLabels,
  documentTypes,
  formatFileSize,
  isClaimDocumentType,
  titleFromFilename,
  type DocumentType,
} from "~/lib/documents";
import { api, type RouterOutputs } from "~/trpc/react";

type VisitDetail = NonNullable<RouterOutputs["visits"]["detail"]>;
type VisitDocument = VisitDetail["documents"][number];
type VisitClaim = VisitDetail["claims"][number];

export function DocumentManager({
  visitId,
  documents,
  claims,
}: {
  visitId: string;
  documents: VisitDocument[];
  claims: VisitClaim[];
}) {
  return (
    <section aria-labelledby="visit-documents" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="visit-documents" className="text-xl font-semibold">Documents</h2>
          <p className="text-sm text-muted-foreground">
            Keep forms, receipts, results, and claim paperwork with this visit.
          </p>
        </div>
        <UploadDocumentDialog visitId={visitId} claims={claims} />
      </div>

      {documents.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <FileText className="mb-3 size-6 text-muted-foreground" />
            <p className="font-medium">No documents attached</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add the first file related to this healthcare interaction.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {documents.map((document) => (
            <DocumentCard
              key={document.id}
              document={document}
              visitId={visitId}
              claims={claims}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function claimLabel(claims: VisitClaim[], claimId: string | null) {
  if (!claimId) return null;
  const claim = claims.find((candidate) => candidate.id === claimId);
  return claim ? `${claim.benefitName} claim` : "Linked claim";
}

function DocumentCard({
  document,
  visitId,
  claims,
}: {
  document: VisitDocument;
  visitId: string;
  claims: VisitClaim[];
}) {
  const utils = api.useUtils();
  const deleteDocument = api.documents.delete.useMutation();
  const [editOpen, setEditOpen] = useState(false);
  const linkedClaim = claimLabel(claims, document.claimId);

  async function refreshDocuments() {
    await Promise.all([
      utils.visits.detail.invalidate({ id: visitId }),
      utils.visits.overview.invalidate(),
      utils.documents.overview.invalidate(),
    ]);
  }

  return (
    <Card className="shadow-none">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <FileText className="size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{document.title}</h3>
            <Badge variant="outline">{documentTypeLabels[document.type]}</Badge>
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {document.originalFilename} · {formatFileSize(document.sizeBytes)}
          </p>
          {linkedClaim ? (
            <p className="mt-1 text-sm text-muted-foreground">Linked to {linkedClaim}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button asChild size="sm" variant="outline">
            <a href={`/api/documents/${document.id}/file`} target="_blank" rel="noreferrer">
              <Download />Open
            </a>
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label={`Edit ${document.title}`} onClick={() => setEditOpen(true)}>
            <Pencil />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon-sm" variant="ghost" aria-label={`Delete ${document.title}`} className="text-muted-foreground hover:text-destructive">
                <Trash2 />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete “{document.title}”?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes the managed file from First Aid.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={async () => {
                    await deleteDocument.mutateAsync({ id: document.id });
                    await refreshDocuments();
                  }}
                >
                  Delete document
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
      <EditDocumentDialog
        document={document}
        visitId={visitId}
        claims={claims}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </Card>
  );
}

export function UploadDocumentDialog({
  visitId,
  claims,
  defaultClaimId,
  trigger,
}: {
  visitId: string;
  claims: VisitClaim[];
  defaultClaimId?: string;
  trigger?: React.ReactNode;
}) {
  const utils = api.useUtils();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<DocumentType>();
  const [claimId, setClaimId] = useState(defaultClaimId ?? "none");
  const [file, setFile] = useState<File>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setClaimId(defaultClaimId ?? "none");
    if (defaultClaimId) setType("claim_record");
  }, [defaultClaimId, open]);

  function reset() {
    setTitle("");
    setType(undefined);
    setClaimId(defaultClaimId ?? "none");
    setFile(undefined);
    setError(undefined);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !type) {
      setError("Choose a file and document type.");
      return;
    }
    setPending(true);
    setError(undefined);
    const body = new FormData();
    body.set("file", file);
    body.set("title", title);
    body.set("type", type);
    if (isClaimDocumentType(type) && claimId !== "none") {
      body.set("claimId", claimId);
    }

    try {
      const response = await fetch(`/api/visits/${visitId}/documents`, { method: "POST", body });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(result?.error ?? "The document could not be uploaded.");
      }
      await Promise.all([
        utils.visits.detail.invalidate({ id: visitId }),
        utils.visits.overview.invalidate(),
        utils.documents.overview.invalidate(),
      ]);
      setOpen(false);
      reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The document could not be uploaded.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? <Button><Plus />Add document</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add document</DialogTitle>
          <DialogDescription>
            Upload one PDF or image up to 25 MB. Claim records and EOBs can be linked to a specific claim.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-5" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="document-file">File</Label>
            <Input
              id="document-file"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
              required
              onChange={(event) => {
                const nextFile = event.target.files?.[0];
                setFile(nextFile);
                if (nextFile) setTitle(titleFromFilename(nextFile.name));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="document-title">Title</Label>
            <Input id="document-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required />
          </div>
          <DocumentTypeSelect
            value={type}
            onValueChange={(value) => {
              setType(value as DocumentType);
              if (!isClaimDocumentType(value as DocumentType)) setClaimId("none");
            }}
          />
          {type && isClaimDocumentType(type) ? (
            <ClaimSelect claims={claims} value={claimId} onValueChange={setClaimId} />
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>{pending ? "Uploading…" : "Add document"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditDocumentDialog({
  document,
  visitId,
  claims,
  open,
  onOpenChange,
}: {
  document: VisitDocument;
  visitId: string;
  claims: VisitClaim[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = api.useUtils();
  const updateDocument = api.documents.update.useMutation();
  const [title, setTitle] = useState(document.title);
  const [type, setType] = useState<DocumentType>(document.type);
  const [claimId, setClaimId] = useState(document.claimId ?? "none");

  useEffect(() => {
    if (open) {
      setTitle(document.title);
      setType(document.type);
      setClaimId(document.claimId ?? "none");
    }
  }, [document, open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await updateDocument.mutateAsync({
      id: document.id,
      title,
      type,
      claimId: isClaimDocumentType(type) && claimId !== "none" ? claimId : null,
    });
    await Promise.all([
      utils.visits.detail.invalidate({ id: visitId }),
      utils.documents.overview.invalidate(),
    ]);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit document</DialogTitle>
          <DialogDescription>The original managed file will not be changed.</DialogDescription>
        </DialogHeader>
        <form className="space-y-5" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor={`document-title-${document.id}`}>Title</Label>
            <Input id={`document-title-${document.id}`} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required />
          </div>
          <DocumentTypeSelect
            value={type}
            onValueChange={(value) => {
              setType(value as DocumentType);
              if (!isClaimDocumentType(value as DocumentType)) setClaimId("none");
            }}
            id={`document-type-${document.id}`}
          />
          {isClaimDocumentType(type) ? (
            <ClaimSelect
              claims={claims}
              value={claimId}
              onValueChange={setClaimId}
              id={`document-claim-${document.id}`}
            />
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={updateDocument.isPending}>
              {updateDocument.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DocumentTypeSelect({ value, onValueChange, id = "document-type" }: { value?: string; onValueChange: (value: string) => void; id?: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Document type</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id} className="w-full"><SelectValue placeholder="Choose a type" /></SelectTrigger>
        <SelectContent>
          {documentTypes.map((documentType) => (
            <SelectItem key={documentType} value={documentType}>{documentTypeLabels[documentType]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ClaimSelect({
  claims,
  value,
  onValueChange,
  id = "document-claim",
}: {
  claims: VisitClaim[];
  value: string;
  onValueChange: (value: string) => void;
  id?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Linked claim <span className="font-normal text-muted-foreground">(optional)</span></Label>
      {claims.length === 0 ? (
        <p className="text-sm text-muted-foreground">Add a claim first to link claim paperwork to it.</p>
      ) : (
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger id={id} className="w-full"><SelectValue placeholder="No linked claim" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No linked claim</SelectItem>
            {claims.map((claim) => (
              <SelectItem key={claim.id} value={claim.id}>
                {claim.benefitName} · {claimStatusLabels[claim.status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
