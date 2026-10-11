"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Building2, Check, Home, ImagePlus } from "lucide-react";
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
import { Button } from "@yourtoolshq/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@yourtoolshq/ui/dialog";
import { Label } from "@yourtoolshq/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@yourtoolshq/ui/select";

import type { Property } from "./forms";
import type { PropertyRelationship, PropertyStage } from "~/lib/properties";
import {
  formatDateLabel,
  formatPropertyAddress,
  propertyFieldsSchema,
  relationshipLabels,
  stageLabels,
  stagesFor,
} from "~/lib/properties";
import { useUpload } from "~/lib/uploads";
import { api } from "~/trpc/react";
import { Field, formValues } from "./forms";

const detailLabels: Record<string, string> = {
  moveInDate: "Move-in",
  moveOutDate: "Move-out",
  leaseStartDate: "Lease starts",
  leaseEndDate: "Lease ends",
  leaseNotes: "Lease notes",
  landlordName: "Landlord or property manager",
  landlordEmail: "Contact email",
  landlordPhone: "Contact phone",
  targetPossessionDate: "Expected possession",
  possessionDate: "Possession",
  notes: "Property notes",
};
const steps = ["Relationship", "The place", "Details", "Review"];
const stepTitles = [
  "How is this place part of your life?",
  "Give this place a name",
  "Add the details you know",
  "Ready to add your property?",
];
const stepDescriptions = [
  "Choose your relationship. You can update its stage as things change.",
  "An address and photo make it easier to recognize. Both are optional.",
  "Just the details that belong to this property. Everything here is optional.",
  "Check the essentials. You can add insurance, documents, and visits after saving.",
];

export function PropertyEditor({
  property,
  onClose,
  onSaved,
}: {
  property?: Property;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [relationship, setRelationship] = useState<PropertyRelationship | null>(
    property?.relationship ?? null,
  );
  const [stage, setStage] = useState<PropertyStage>(
    property?.stage ?? "current",
  );
  const stageDrafts = useRef<Record<PropertyRelationship, PropertyStage>>({
    rental: property?.relationship === "rental" ? property.stage : "current",
    purchase:
      property?.relationship === "purchase"
        ? property.stage
        : "purchase_in_progress",
  });
  const [step, setStep] = useState(property ? 1 : 0);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [review, setReview] = useState<Record<string, unknown>>({});
  const upload = useUpload("propertyPhoto");
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const create = api.properties.create.useMutation();
  const update = api.properties.update.useMutation();
  const pending = create.isPending || update.isPending;
  const blocked = pending || upload.status === "uploading";
  const rental = relationship === "rental";
  useEffect(() => {
    if (!upload.source) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(upload.source);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [upload.source]);
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  function close() {
    if (!blocked) {
      if (dirty || upload.source || photoRemoved) setDiscard(true);
      else onClose();
    }
  }
  function values() {
    const data = formValues(form.current!);
    const rentalKeys = [
      "moveOutDate",
      "leaseStartDate",
      "leaseEndDate",
      "leaseNotes",
      "landlordName",
      "landlordEmail",
      "landlordPhone",
    ];
    for (const key of rental
      ? ["targetPossessionDate", "possessionDate"]
      : rentalKeys)
      delete data[key];
    return { ...data, relationship, stage };
  }
  function go(next: number) {
    setError(null);
    if (!relationship) {
      setError("Choose rental or purchased home to continue.");
      return;
    }
    if (
      step === 1 &&
      !form.current?.querySelector<HTMLInputElement>("#name")?.reportValidity()
    )
      return;
    if (next === 3) {
      const data = values();
      const parsed = propertyFieldsSchema.safeParse(data);
      if (!parsed.success) {
        setError(parsed.error.issues.map((issue) => issue.message).join(" "));
        return;
      }
      setReview(data);
    }
    setStep(next);
  }
  async function save() {
    setError(null);
    if (upload.status === "failed") {
      setError("Retry or remove the photo before saving.");
      return;
    }
    const parsed = propertyFieldsSchema.safeParse(values());
    if (!parsed.success) {
      setError(parsed.error.issues.map((issue) => issue.message).join(" "));
      return;
    }
    try {
      const input = {
        ...parsed.data,
        ...(upload.file
          ? { photo: upload.file.token }
          : photoRemoved
            ? { photo: null }
            : {}),
      };
      const result = property
        ? await update.mutateAsync({ ...input, id: property.id })
        : await create.mutateAsync(input);
      toast.success(property ? "Property updated" : "Property added");
      onSaved(result.id);
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save the property. Try again.",
      );
    }
  }
  const photoUrl =
    preview ??
    (!photoRemoved && property?.photoFileId
      ? `/api/data/files/${property.photoFileId}`
      : null);
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <DialogContent
          className="bg-background flex h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
          showCloseButton={!blocked}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            close();
          }}
        >
          <div className="border-b px-6 py-5 md:px-10">
            <DialogHeader className="mx-auto max-w-5xl pr-8">
              <DialogTitle className="text-lg">
                {property ? "Edit property" : "Add property"}
              </DialogTitle>
              <DialogDescription>
                {property
                  ? "Update the details or stage. History and documents stay with this place."
                  : "A few details at a time. Make room for the rest later."}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-8 md:px-10 md:py-10">
            <div className="mx-auto max-w-4xl">
              {!property && (
                <ol
                  aria-label="Property setup progress"
                  className="mb-6 grid grid-cols-4 gap-2 sm:mb-10 md:gap-5"
                >
                  {steps.map((label, index) => (
                    <li
                      key={label}
                      aria-current={step === index ? "step" : undefined}
                      className={`border-t-2 pt-3 text-xs sm:text-sm ${step >= index ? "border-primary text-primary" : "text-muted-foreground"}`}
                    >
                      <span className="mb-1 flex items-center gap-2 font-medium">
                        {step > index ? (
                          <Check className="size-4 shrink-0" aria-hidden />
                        ) : (
                          <span>{index + 1}</span>
                        )}
                        <span className="sr-only sm:not-sr-only">{label}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              <h2
                ref={heading}
                tabIndex={-1}
                className="text-2xl font-semibold tracking-tight outline-none md:text-3xl"
              >
                {property ? "Your property details" : stepTitles[step]}
              </h2>
              <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-relaxed">
                {property
                  ? "Your relationship stays the same. Update its stage when you take possession or move out."
                  : stepDescriptions[step]}
              </p>
              <form
                ref={form}
                className="mt-8"
                onChange={() => setDirty(true)}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (property || step === 3) void save();
                  else go(step + 1);
                }}
              >
                <div
                  hidden={property ? false : step !== 0}
                  className="space-y-6"
                >
                  {!property && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {(["rental", "purchase"] as const).map((value) => {
                        const Icon = value === "rental" ? Building2 : Home;
                        return (
                          <button
                            type="button"
                            key={value}
                            aria-pressed={relationship === value}
                            className={`focus-visible:ring-ring relative rounded-xl border p-6 text-left focus-visible:ring-2 ${relationship === value ? "border-primary bg-secondary" : "bg-card hover:border-primary/50"}`}
                            onClick={() => {
                              setRelationship(value);
                              setStage(stageDrafts.current[value]);
                              setDirty(true);
                            }}
                          >
                            <Icon
                              className="text-primary mb-5 size-6"
                              aria-hidden
                            />
                            <span className="block text-lg font-semibold">
                              {relationshipLabels[value]}
                            </span>
                            <span className="text-muted-foreground mt-2 block text-sm leading-relaxed">
                              {value === "rental"
                                ? "A place you rent now, or rented in the past."
                                : "A home you’re buying, building, or already own."}
                            </span>
                            {relationship === value && (
                              <Check
                                className="text-primary absolute top-5 right-5 size-5"
                                aria-hidden
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {relationship && (
                    <div className="max-w-md">
                      <div className="space-y-2">
                        <Label htmlFor="stage">
                          {rental ? "Rental status" : "Current stage"}
                        </Label>
                        <Select
                          value={stage}
                          key={relationship}
                          onValueChange={(value) => {
                            if (
                              !stagesFor(relationship).some(
                                (key) => key === value,
                              )
                            )
                              return;
                            stageDrafts.current[relationship] =
                              value as PropertyStage;
                            setStage(value as PropertyStage);
                            setDirty(true);
                          }}
                        >
                          <SelectTrigger id="stage" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {stagesFor(relationship).map((key) => (
                              <SelectItem key={key} value={key}>
                                {stageLabels[key]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-muted-foreground mt-2 text-xs">
                        {rental
                          ? "Keep the same record when you move out."
                          : "This home stays together through every stage, including possession."}
                      </p>
                    </div>
                  )}
                </div>
                <div
                  hidden={property ? false : step !== 1}
                  className={`${property ? "mt-8" : ""} grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_260px]`}
                >
                  <div className="space-y-5">
                    <Field
                      name="name"
                      label="Property name"
                      value={property?.name}
                      required={Boolean(property) || step === 1}
                    />
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Field
                          name="addressLine1"
                          label="Street address (optional)"
                          value={property?.addressLine1}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Field
                          name="addressLine2"
                          label="Unit or address line 2 (optional)"
                          value={property?.addressLine2}
                        />
                      </div>
                      <Field
                        name="city"
                        label="City (optional)"
                        value={property?.city}
                      />
                      <Field
                        name="region"
                        label="Province or region (optional)"
                        value={property?.region}
                      />
                      <Field
                        name="postalCode"
                        label="Postal code (optional)"
                        value={property?.postalCode}
                      />
                    </div>
                  </div>
                  <aside className="space-y-3">
                    <h3 className="font-medium">
                      Property photo{" "}
                      <span className="text-muted-foreground text-xs font-normal">
                        Optional
                      </span>
                    </h3>
                    <div className="bg-muted/40 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-dashed">
                      {photoUrl ? (
                        <Image
                          unoptimized
                          width={600}
                          height={450}
                          src={photoUrl}
                          alt="Property photo preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="text-muted-foreground p-6 text-center">
                          <ImagePlus
                            className="mx-auto mb-3 size-7"
                            aria-hidden
                          />
                          <p className="text-sm">
                            A familiar view of this place
                          </p>
                        </div>
                      )}
                    </div>
                    <input
                      ref={photoInput}
                      id="property-photo"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      aria-label="Property photo"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setPhotoRemoved(false);
                          setDirty(true);
                          void upload.upload(file);
                        }
                        e.target.value = "";
                      }}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => photoInput.current?.click()}
                        disabled={pending}
                      >
                        {photoUrl ? "Replace photo" : "Choose photo"}
                      </Button>
                      {photoUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            upload.reset();
                            setPhotoRemoved(true);
                            setDirty(true);
                          }}
                          disabled={pending}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      JPEG, PNG, or WebP, up to 10 MB.
                    </p>
                    {upload.status === "uploading" && (
                      <p role="status" className="text-sm">
                        Uploading photo… {Math.round(upload.progress * 100)}%
                      </p>
                    )}
                    {upload.status === "uploaded" && (
                      <p
                        role="status"
                        className="text-muted-foreground text-xs"
                      >
                        Photo ready to save
                      </p>
                    )}
                    {upload.error && (
                      <p role="alert" className="text-destructive text-sm">
                        {upload.error}
                      </p>
                    )}
                  </aside>
                </div>
                <div
                  hidden={property ? false : step !== 2}
                  className={`${property ? "mt-8 border-t pt-8" : ""} max-w-2xl space-y-6`}
                >
                  <div hidden={!rental && stage !== "owned"}>
                    <Field
                      name="moveInDate"
                      label="Move-in date"
                      date
                      value={property?.moveInDate}
                    />
                  </div>
                  <fieldset
                    disabled={!rental}
                    hidden={!rental}
                    className="space-y-6"
                  >
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div hidden={stage !== "past"}>
                        <Field
                          name="moveOutDate"
                          label="Move-out date"
                          date
                          value={property?.moveOutDate}
                        />
                      </div>
                      <Field
                        name="leaseStartDate"
                        label="Lease starts"
                        date
                        value={property?.leaseStartDate}
                      />
                      <Field
                        name="leaseEndDate"
                        label="Lease ends"
                        date
                        value={property?.leaseEndDate}
                      />
                    </div>
                    <div className="space-y-5 border-t pt-6">
                      <h3 className="font-medium">
                        Landlord or property manager
                      </h3>
                      <Field
                        name="landlordName"
                        label="Contact name"
                        value={property?.landlordName}
                      />
                      <div className="grid gap-5 sm:grid-cols-2">
                        <Field
                          name="landlordEmail"
                          label="Contact email"
                          type="email"
                          value={property?.landlordEmail}
                        />
                        <Field
                          name="landlordPhone"
                          label="Contact phone"
                          type="tel"
                          value={property?.landlordPhone}
                        />
                      </div>
                      <Field
                        name="leaseNotes"
                        label="Lease notes"
                        area
                        value={property?.leaseNotes}
                      />
                    </div>
                  </fieldset>
                  <fieldset
                    disabled={rental}
                    hidden={rental}
                    className="grid gap-5 sm:grid-cols-2"
                  >
                    <Field
                      name="targetPossessionDate"
                      label="Expected possession"
                      date
                      value={property?.targetPossessionDate}
                    />
                    <div hidden={stage !== "owned"}>
                      <Field
                        name="possessionDate"
                        label="Possession date"
                        date
                        value={property?.possessionDate}
                      />
                    </div>
                  </fieldset>
                  <Field
                    name="notes"
                    label="Property notes"
                    area
                    value={property?.notes}
                  />
                </div>
                {!property && step === 3 && (
                  <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_260px]">
                    <div className="space-y-6">
                      <section>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="font-medium">The place</h3>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => go(1)}
                          >
                            Edit place
                          </Button>
                        </div>
                        <p className="mt-2 text-xl font-semibold">
                          {String(review.name)}
                        </p>
                        <p className="text-muted-foreground mt-2 text-sm whitespace-pre-line">
                          {formatPropertyAddress(review) ?? "Address not added"}
                        </p>
                      </section>
                      <section className="border-t pt-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="font-medium">
                            Relationship and stage
                          </h3>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => go(0)}
                          >
                            Edit relationship
                          </Button>
                        </div>
                        <p className="mt-2 text-sm">
                          {relationship && relationshipLabels[relationship]} ·{" "}
                          {stageLabels[stage]}
                        </p>
                      </section>
                      <section className="border-t pt-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="font-medium">Relevant details</h3>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => go(2)}
                          >
                            Edit details
                          </Button>
                        </div>
                        <dl className="mt-2 space-y-2 text-sm">
                          {Object.entries(review)
                            .filter(
                              ([key, value]) =>
                                value &&
                                ![
                                  "name",
                                  "relationship",
                                  "stage",
                                  "addressLine1",
                                  "addressLine2",
                                  "city",
                                  "region",
                                  "postalCode",
                                ].includes(key),
                            )
                            .map(([key, value]) => (
                              <div key={key}>
                                <dt className="text-muted-foreground">
                                  {detailLabels[key] ?? key}
                                </dt>
                                <dd className="whitespace-pre-wrap">
                                  {key.endsWith("Date")
                                    ? formatDateLabel(String(value))
                                    : String(value)}
                                </dd>
                              </div>
                            ))}
                        </dl>
                        <p className="text-muted-foreground mt-3 text-xs">
                          Insurance and supporting documents can be added from
                          the property.
                        </p>
                      </section>
                    </div>
                    {photoUrl && (
                      <Image
                        unoptimized
                        width={600}
                        height={450}
                        src={photoUrl}
                        alt="Property photo preview"
                        className="aspect-[4/3] w-full rounded-xl object-cover"
                      />
                    )}
                  </div>
                )}
              </form>
            </div>
          </div>
          <div className="bg-background border-t px-6 py-4 md:px-10">
            <div className="mx-auto max-w-4xl">
              {error && (
                <p role="alert" className="text-destructive mb-3 text-sm">
                  {error}
                </p>
              )}
              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={blocked}
                  onClick={property || step === 0 ? close : () => go(step - 1)}
                >
                  {property || step === 0 ? "Cancel" : "Back"}
                </Button>
                <div className="flex items-center gap-4">
                  {!property && (
                    <span className="text-muted-foreground text-xs">
                      Step {step + 1} of {steps.length}
                    </span>
                  )}
                  <Button
                    type="button"
                    disabled={blocked || (!property && !relationship)}
                    onClick={() => {
                      if (property || step === 3) {
                        if (form.current?.reportValidity()) void save();
                      } else go(step + 1);
                    }}
                  >
                    {pending
                      ? "Saving…"
                      : property
                        ? "Save changes"
                        : step === 3
                          ? "Add property"
                          : "Continue"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={discard} onOpenChange={setDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Your unsaved property details and photo will be discarded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={onClose}>
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
