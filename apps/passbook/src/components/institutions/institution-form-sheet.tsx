"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";

import { Button } from "@yourtoolshq/ui/button";
import { Input } from "@yourtoolshq/ui/input";
import { Label } from "@yourtoolshq/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@yourtoolshq/ui/sheet";
import { Textarea } from "@yourtoolshq/ui/textarea";

import type { RouterOutputs } from "~/trpc/react";
import { InstitutionIcon } from "~/components/institutions/institution-icon";
import { useUpload } from "~/lib/uploads";
import { api } from "~/trpc/react";

type Institution = RouterOutputs["institutions"]["list"][number];

type InstitutionFormState = {
  name: string;
  website: string;
  notes: string;
  removeIcon: boolean;
};

function emptyFormState(): InstitutionFormState {
  return { name: "", website: "", notes: "", removeIcon: false };
}

function institutionToFormState(
  institution: Institution,
): InstitutionFormState {
  return {
    name: institution.name,
    website: institution.website ?? "",
    notes: institution.notes ?? "",
    removeIcon: false,
  };
}

function toInstitutionPayload(form: InstitutionFormState) {
  return {
    name: form.name.trim(),
    website: form.website.trim() || null,
    notes: form.notes.trim() || null,
  };
}

export function InstitutionFormSheet({
  institution,
  open,
  onOpenChange,
}: {
  institution: Institution | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = api.useUtils();
  const [form, setForm] = useState<InstitutionFormState>(
    institution ? institutionToFormState(institution) : emptyFormState(),
  );
  const iconUpload = useUpload("institutionIcon");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function chooseIcon(file: File | undefined) {
    if (!file) return;
    if (
      !["image/png", "image/webp"].includes(file.type) ||
      file.size > 1024 * 1024
    ) {
      toast.error("Choose a PNG or WebP image no larger than 1 MB.");
      return;
    }
    setPreviewUrl(URL.createObjectURL(file));
    setForm((current) => ({ ...current, removeIcon: false }));
    await iconUpload.upload(file);
  }

  const finish = async (message: string) => {
    await Promise.all([
      utils.institutions.invalidate(),
      utils.accounts.invalidate(),
      utils.overview.invalidate(),
      utils.documents.invalidate(),
      utils.accountEvents.invalidate(),
    ]);
    toast.success(message);
    onOpenChange(false);
  };

  const createInstitution = api.institutions.create.useMutation({
    onSuccess: () => finish("Institution added."),
    onError: (error) => toast.error(error.message),
  });
  const updateInstitution = api.institutions.update.useMutation({
    onSuccess: () => finish("Institution updated."),
    onError: (error) => toast.error(error.message),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) return;
    if (iconUpload.status === "uploading") return;
    if (iconUpload.status === "failed") {
      toast.error("Upload the icon again before saving.");
      return;
    }
    const payload = {
      ...toInstitutionPayload(form),
      icon: iconUpload.file?.token ?? (form.removeIcon ? null : undefined),
    };
    if (institution) {
      updateInstitution.mutate({ id: institution.id, ...payload });
    } else {
      createInstitution.mutate(payload);
    }
  }

  const pending =
    createInstitution.isPending ||
    updateInstitution.isPending ||
    iconUpload.status === "uploading";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <form className="flex min-h-full flex-col" onSubmit={submit}>
          <SheetHeader>
            <SheetTitle>
              {institution ? "Edit institution" : "Add institution"}
            </SheetTitle>
            <SheetDescription>
              Banks, lenders, and investment providers that hold household
              accounts.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-6 px-4 py-6">
            <div className="space-y-2">
              <Label htmlFor="institution-icon">Icon (optional)</Label>
              <div className="flex items-center gap-3">
                {previewUrl && !form.removeIcon ? (
                  <Image
                    src={previewUrl}
                    alt="Selected icon preview"
                    width={48}
                    height={48}
                    unoptimized
                    className="size-12 rounded-lg object-cover"
                  />
                ) : (
                  <InstitutionIcon
                    fileId={
                      form.removeIcon ? null : (institution?.iconFileId ?? null)
                    }
                    className="size-12"
                  />
                )}
                <div className="space-y-2">
                  <Input
                    id="institution-icon"
                    type="file"
                    accept="image/png,image/webp,.png,.webp"
                    onChange={(event) => {
                      void chooseIcon(event.target.files?.[0]);
                      event.currentTarget.value = "";
                    }}
                  />
                  <p className="text-muted-foreground text-xs">
                    PNG or WebP, up to 1 MB.
                  </p>
                </div>
              </div>
              {(institution?.iconFileId || iconUpload.file) &&
              !form.removeIcon ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    iconUpload.reset();
                    setPreviewUrl(null);
                    setForm((current) => ({ ...current, removeIcon: true }));
                  }}
                >
                  Remove icon
                </Button>
              ) : null}
              {iconUpload.status === "failed" ? (
                <p className="text-destructive text-sm">{iconUpload.error}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="institution-name">Institution name</Label>
              <Input
                id="institution-name"
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="institution-website">Website</Label>
              <Input
                id="institution-website"
                value={form.website}
                onChange={(event) =>
                  setForm({ ...form, website: event.target.value })
                }
                placeholder="https://"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="institution-notes">Notes</Label>
              <Textarea
                id="institution-notes"
                value={form.notes}
                onChange={(event) =>
                  setForm({ ...form, notes: event.target.value })
                }
                rows={4}
              />
            </div>
          </div>
          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending
                ? "Saving…"
                : institution
                  ? "Save changes"
                  : "Add institution"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
