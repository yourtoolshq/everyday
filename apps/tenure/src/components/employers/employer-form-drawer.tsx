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
import { EmployerIcon } from "~/components/employers/employer-icon";
import { countries } from "~/lib/countries";
import { useUpload } from "~/lib/uploads";
import { api } from "~/trpc/react";

type Employer = RouterOutputs["employers"]["list"][number];
type EmployerForm = {
  name: string;
  website: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  notes: string;
  removeIcon: boolean;
};

function formFromEmployer(employer?: Employer): EmployerForm {
  return {
    name: employer?.name ?? "",
    website: employer?.website ?? "",
    email: employer?.email ?? "",
    phone: employer?.phone ?? "",
    addressLine1: employer?.addressLine1 ?? "",
    addressLine2: employer?.addressLine2 ?? "",
    city: employer?.city ?? "",
    region: employer?.region ?? "",
    postalCode: employer?.postalCode ?? "",
    countryCode: employer?.countryCode ?? "",
    notes: employer?.notes ?? "",
    removeIcon: false,
  };
}

export function EmployerFormDrawer({
  open,
  onOpenChange,
  mode,
  employer,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  employer?: Employer;
  onSuccess?: () => void;
}) {
  const utils = api.useUtils();
  const [form, setForm] = useState<EmployerForm>(() =>
    formFromEmployer(employer),
  );
  const iconUpload = useUpload("employerIcon");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(formFromEmployer(mode === "edit" ? employer : undefined));
      setValidationError(null);
      iconUpload.reset();
      setPreviewUrl(null);
    }
    // Reset upload when the drawer opens for another employer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, employer?.id]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  function setField<K extends keyof EmployerForm>(
    key: K,
    value: EmployerForm[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setValidationError(null);
  }

  async function chooseIcon(file: File | undefined) {
    if (!file) return;
    if (
      !["image/png", "image/webp"].includes(file.type) ||
      file.size > 1024 * 1024
    ) {
      setValidationError("Choose a PNG or WebP image no larger than 1 MB.");
      return;
    }
    setPreviewUrl(URL.createObjectURL(file));
    setField("removeIcon", false);
    await iconUpload.upload(file);
  }

  const finish = async (message: string) => {
    await Promise.all([
      utils.employers.invalidate(),
      utils.employments.invalidate(),
      utils.overview.invalidate(),
      utils.paychecks.listForReview.invalidate(),
      utils.employmentRecords.listForReview.invalidate(),
    ]);
    toast.success(message);
    onOpenChange(false);
    onSuccess?.();
  };

  const createEmployer = api.employers.create.useMutation({
    onSuccess: () => finish("Employer added."),
    onError: (error) => setValidationError(error.message),
  });
  const updateEmployer = api.employers.update.useMutation({
    onSuccess: () => finish("Employer updated."),
    onError: (error) => setValidationError(error.message),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const addressFields = [
      form.addressLine1,
      form.addressLine2,
      form.city,
      form.region,
      form.postalCode,
    ];
    if (addressFields.some((value) => value.trim()) && !form.countryCode) {
      setValidationError("Choose a country when entering an address.");
      return;
    }
    if (iconUpload.status === "uploading") return;
    if (iconUpload.status === "failed") {
      setValidationError("Upload the icon again before saving.");
      return;
    }
    const optional = (value: string) => value.trim() || null;
    const payload = {
      name: form.name.trim(),
      website: optional(form.website),
      email: optional(form.email),
      phone: optional(form.phone),
      addressLine1: optional(form.addressLine1),
      addressLine2: optional(form.addressLine2),
      city: optional(form.city),
      region: optional(form.region),
      postalCode: optional(form.postalCode),
      countryCode:
        countries.find((country) => country.code === form.countryCode)?.code ??
        null,
      notes: optional(form.notes),
      icon: iconUpload.file?.token ?? (form.removeIcon ? null : undefined),
    };
    if (mode === "create") createEmployer.mutate(payload);
    else if (employer) updateEmployer.mutate({ id: employer.id, ...payload });
  }

  const pending =
    createEmployer.isPending ||
    updateEmployer.isPending ||
    iconUpload.status === "uploading";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto data-[side=right]:sm:max-w-xl"
      >
        <SheetHeader>
          <SheetTitle>
            {mode === "create" ? "Add employer" : "Edit employer"}
          </SheetTitle>
          <SheetDescription>
            {mode === "create"
              ? "Add an organization where someone in your household works or worked."
              : "Update this employer's details."}
          </SheetDescription>
        </SheetHeader>
        <form
          className="flex flex-1 flex-col gap-6 px-4 pb-4"
          onSubmit={submit}
        >
          <div className="space-y-2">
            <Label htmlFor="employer-icon">Icon (optional)</Label>
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
                <EmployerIcon
                  fileId={
                    form.removeIcon ? null : (employer?.iconFileId ?? null)
                  }
                  className="size-12"
                />
              )}
              <div className="space-y-2">
                <Input
                  id="employer-icon"
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
            {(employer?.iconFileId || iconUpload.file) && !form.removeIcon ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  iconUpload.reset();
                  setPreviewUrl(null);
                  setField("removeIcon", true);
                }}
              >
                Remove icon
              </Button>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="employer-name">Employer name</Label>
            <Input
              id="employer-name"
              value={form.name}
              onChange={(event) => setField("name", event.target.value)}
              required
              maxLength={160}
            />
          </div>
          <div className="space-y-4">
            <p className="text-sm font-medium">Contact details (optional)</p>
            <div className="space-y-2">
              <Label htmlFor="employer-website">Website</Label>
              <Input
                id="employer-website"
                value={form.website}
                onChange={(event) => setField("website", event.target.value)}
                placeholder="https://"
                maxLength={500}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="employer-email">Email</Label>
                <Input
                  id="employer-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setField("email", event.target.value)}
                  maxLength={254}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employer-phone">Phone</Label>
                <Input
                  id="employer-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(event) => setField("phone", event.target.value)}
                  maxLength={50}
                />
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <p className="text-sm font-medium">Address (optional)</p>
            <div className="space-y-2">
              <Label htmlFor="employer-country">Country</Label>
              <select
                id="employer-country"
                value={form.countryCode}
                onChange={(event) =>
                  setField("countryCode", event.target.value)
                }
                className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-[3px]"
              >
                <option value="">Choose country</option>
                {countries.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="employer-address-1">Address line 1</Label>
              <Input
                id="employer-address-1"
                value={form.addressLine1}
                onChange={(event) =>
                  setField("addressLine1", event.target.value)
                }
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="employer-address-2">Address line 2</Label>
              <Input
                id="employer-address-2"
                value={form.addressLine2}
                onChange={(event) =>
                  setField("addressLine2", event.target.value)
                }
                maxLength={200}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="employer-city">City or locality</Label>
                <Input
                  id="employer-city"
                  value={form.city}
                  onChange={(event) => setField("city", event.target.value)}
                  maxLength={120}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employer-region">
                  State, province, or region
                </Label>
                <Input
                  id="employer-region"
                  value={form.region}
                  onChange={(event) => setField("region", event.target.value)}
                  maxLength={120}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="employer-postal-code">Postal or ZIP code</Label>
              <Input
                id="employer-postal-code"
                value={form.postalCode}
                onChange={(event) => setField("postalCode", event.target.value)}
                maxLength={40}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="employer-notes">Notes (optional)</Label>
            <Textarea
              id="employer-notes"
              value={form.notes}
              onChange={(event) => setField("notes", event.target.value)}
              rows={4}
              maxLength={2000}
            />
          </div>
          {iconUpload.status === "failed" ? (
            <p className="text-destructive text-sm" role="alert">
              {iconUpload.error}
            </p>
          ) : null}
          {validationError ? (
            <p className="text-destructive text-sm" role="alert">
              {validationError}
            </p>
          ) : null}
          <SheetFooter className="px-0">
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
                : mode === "create"
                  ? "Add employer"
                  : "Save changes"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
