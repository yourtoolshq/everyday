"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import {
  Building2,
  ExternalLink,
  Pencil,
  Plus,
  Stethoscope,
  Trash2,
} from "lucide-react";

import type { RouterInputs, RouterOutputs } from "~/trpc/react";
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
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
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
import { Textarea } from "~/components/ui/textarea";
import { api } from "~/trpc/react";

type Overview = RouterOutputs["careProviders"]["overview"];
type Organization = Overview["organizations"][number];
type Provider = Overview["providers"][number];

function nullableUrl(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

export function CareProvidersWorkspace({
  initialOverview,
}: {
  initialOverview: Overview;
}) {
  const overview = api.careProviders.overview.useQuery(undefined, {
    initialData: initialOverview,
  });
  const data = overview.data;
  const independentProviders = data.providers.filter(
    (provider) => !provider.careOrganizationId,
  );

  return (
    <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-primary text-sm font-medium">
              Reusable directory
            </p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight">
              Care Providers
            </h2>
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
              Keep the clinics, labs, pharmacies, and people you need when
              recording visits.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ProviderDialog organizations={data.organizations} />
            <OrganizationDialog />
          </div>
        </div>

        <section aria-labelledby="organizations-heading">
          <div className="mb-3">
            <h3 id="organizations-heading" className="font-semibold">
              Organizations
            </h3>
            <p className="text-muted-foreground text-sm">
              Clinics, institutes, pharmacies, labs, and other care locations
            </p>
          </div>
          {data.organizations.length === 0 ? (
            <Card className="border-dashed shadow-none">
              <CardContent className="flex flex-col items-center gap-3 py-9 text-center">
                <Building2 className="text-muted-foreground size-6" />
                <div>
                  <p className="font-medium">No care organizations yet</p>
                  <p className="text-muted-foreground text-sm">
                    Add the first place where your household receives care.
                  </p>
                </div>
                <OrganizationDialog />
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {data.organizations.map((organization) => (
                <OrganizationCard
                  key={organization.id}
                  organization={organization}
                  providers={data.providers.filter(
                    (provider) =>
                      provider.careOrganizationId === organization.id,
                  )}
                  organizations={data.organizations}
                />
              ))}
            </div>
          )}
        </section>

        {independentProviders.length > 0 ? (
          <section aria-labelledby="independent-providers-heading">
            <div className="mb-3">
              <h3 id="independent-providers-heading" className="font-semibold">
                Independent providers
              </h3>
              <p className="text-muted-foreground text-sm">
                Providers not currently associated with an organization
              </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {independentProviders.map((provider) => (
                <ProviderRow
                  key={provider.id}
                  provider={provider}
                  organizations={data.organizations}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function OrganizationCard({
  organization,
  providers,
  organizations,
}: {
  organization: Organization;
  providers: Provider[];
  organizations: Organization[];
}) {
  const utils = api.useUtils();
  const deleteOrganization = api.careProviders.deleteOrganization.useMutation();
  const [editOpen, setEditOpen] = useState(false);
  const inUse = organization.providerCount > 0 || organization.visitCount > 0;

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
            <Building2 className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-lg">{organization.name}</CardTitle>
            <CardDescription>
              {organization.providerCount}{" "}
              {organization.providerCount === 1 ? "provider" : "providers"} ·{" "}
              {organization.visitCount}{" "}
              {organization.visitCount === 1 ? "visit" : "visits"}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${organization.name}`}
            onClick={() => setEditOpen(true)}
          >
            <Pencil />
          </Button>
          <DeleteButton
            label={organization.name}
            description={
              inUse
                ? "Reassign its providers and visits before deleting this organization."
                : "This permanently removes the care organization."
            }
            disabled={inUse}
            onDelete={async () => {
              await deleteOrganization.mutateAsync({ id: organization.id });
              await utils.careProviders.overview.invalidate();
            }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {organization.phoneNumbers.length > 0 ||
        organization.websiteUrl ||
        organization.bookingUrl ? (
          <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {organization.phoneNumbers.map((phone) => (
              <a
                key={phone}
                href={`tel:${phone}`}
                className="hover:text-foreground"
              >
                {phone}
              </a>
            ))}
            {organization.websiteUrl ? (
              <a
                href={organization.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground inline-flex items-center gap-1"
              >
                Website <ExternalLink className="size-3" />
              </a>
            ) : null}
            {organization.bookingUrl ? (
              <a
                href={organization.bookingUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground inline-flex items-center gap-1"
              >
                Book online <ExternalLink className="size-3" />
              </a>
            ) : null}
          </div>
        ) : null}
        <div className="space-y-2 border-t pt-4">
          {providers.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No named providers at this organization.
            </p>
          ) : (
            providers.map((provider) => (
              <ProviderRow
                key={provider.id}
                provider={provider}
                organizations={organizations}
                compact
              />
            ))
          )}
          <ProviderDialog
            organizations={organizations}
            defaultOrganizationId={organization.id}
            compact
          />
        </div>
      </CardContent>
      <OrganizationDialog
        organization={organization}
        open={editOpen}
        onOpenChange={setEditOpen}
        hideTrigger
      />
    </Card>
  );
}

function ProviderRow({
  provider,
  organizations,
  compact,
}: {
  provider: Provider;
  organizations: Organization[];
  compact?: boolean;
}) {
  const utils = api.useUtils();
  const deleteProvider = api.careProviders.deleteProvider.useMutation();
  const [editOpen, setEditOpen] = useState(false);
  return (
    <div
      className={
        compact
          ? "flex items-center gap-3 py-1"
          : "flex items-center gap-3 rounded-lg border p-4"
      }
    >
      <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-full">
        <Stethoscope className="text-muted-foreground size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{provider.name}</p>
        <p className="text-muted-foreground text-xs">
          {provider.visitCount} {provider.visitCount === 1 ? "visit" : "visits"}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Edit ${provider.name}`}
        onClick={() => setEditOpen(true)}
      >
        <Pencil />
      </Button>
      <DeleteButton
        label={provider.name}
        description={
          provider.visitCount > 0
            ? "Reassign this provider’s visits before deleting them."
            : "This permanently removes the provider."
        }
        disabled={provider.visitCount > 0}
        onDelete={async () => {
          await deleteProvider.mutateAsync({ id: provider.id });
          await utils.careProviders.overview.invalidate();
        }}
      />
      <ProviderDialog
        provider={provider}
        organizations={organizations}
        open={editOpen}
        onOpenChange={setEditOpen}
        hideTrigger
      />
    </div>
  );
}

function OrganizationDialog({
  organization,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger,
}: {
  organization?: Organization;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const utils = api.useUtils();
  const createOrganization = api.careProviders.createOrganization.useMutation();
  const updateOrganization = api.careProviders.updateOrganization.useMutation();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const form = new FormData(event.currentTarget);
    const fields: RouterInputs["careProviders"]["createOrganization"] = {
      name: String(form.get("name") ?? ""),
      phoneNumbers: String(form.get("phoneNumbers") ?? "")
        .split("\n")
        .map((phone) => phone.trim())
        .filter(Boolean),
      websiteUrl: nullableUrl(form.get("websiteUrl")),
      bookingUrl: nullableUrl(form.get("bookingUrl")),
    };
    try {
      if (organization)
        await updateOrganization.mutateAsync({
          id: organization.id,
          ...fields,
        });
      else await createOrganization.mutateAsync(fields);
      await Promise.all([
        utils.careProviders.overview.invalidate(),
        utils.visits.overview.invalidate(),
      ]);
      setOpen(false);
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        setError(undefined);
      }}
    >
      {!hideTrigger ? (
        <DialogTrigger asChild>
          <Button>
            <Plus />
            Add organization
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {organization ? "Edit care organization" : "Add care organization"}
          </DialogTitle>
          <DialogDescription>
            Add a clinic, institute, pharmacy, lab, or other place where care
            happens.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor={`organization-name-${organization?.id ?? "new"}`}>
              Name
            </Label>
            <Input
              id={`organization-name-${organization?.id ?? "new"}`}
              name="name"
              defaultValue={organization?.name}
              placeholder="e.g. Downtown Dental Clinic"
              maxLength={160}
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`organization-phones-${organization?.id ?? "new"}`}>
              Phone numbers{" "}
              <span className="text-muted-foreground font-normal">
                (optional, one per line)
              </span>
            </Label>
            <Textarea
              id={`organization-phones-${organization?.id ?? "new"}`}
              name="phoneNumbers"
              defaultValue={organization?.phoneNumbers.join("\n")}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor={`organization-website-${organization?.id ?? "new"}`}
            >
              Website URL{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Input
              id={`organization-website-${organization?.id ?? "new"}`}
              name="websiteUrl"
              type="url"
              defaultValue={organization?.websiteUrl ?? ""}
              placeholder="https://…"
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor={`organization-booking-${organization?.id ?? "new"}`}
            >
              Booking URL{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Input
              id={`organization-booking-${organization?.id ?? "new"}`}
              name="bookingUrl"
              type="url"
              defaultValue={organization?.bookingUrl ?? ""}
              placeholder="https://…"
            />
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <DialogFooter>
            <Button
              disabled={
                createOrganization.isPending || updateOrganization.isPending
              }
            >
              {createOrganization.isPending || updateOrganization.isPending
                ? "Saving…"
                : organization
                  ? "Save changes"
                  : "Add organization"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProviderDialog({
  provider,
  organizations,
  defaultOrganizationId,
  compact,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger,
}: {
  provider?: Provider;
  organizations: Organization[];
  defaultOrganizationId?: string;
  compact?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const utils = api.useUtils();
  const createProvider = api.careProviders.createProvider.useMutation();
  const updateProvider = api.careProviders.updateProvider.useMutation();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [organizationId, setOrganizationId] = useState(
    provider?.careOrganizationId ?? defaultOrganizationId ?? "none",
  );
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const form = new FormData(event.currentTarget);
    const fields: RouterInputs["careProviders"]["createProvider"] = {
      name: String(form.get("name") ?? ""),
      careOrganizationId: organizationId === "none" ? null : organizationId,
    };
    try {
      if (provider)
        await updateProvider.mutateAsync({ id: provider.id, ...fields });
      else await createProvider.mutateAsync(fields);
      await Promise.all([
        utils.careProviders.overview.invalidate(),
        utils.visits.overview.invalidate(),
      ]);
      setOpen(false);
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        setError(undefined);
      }}
    >
      {!hideTrigger ? (
        <DialogTrigger asChild>
          <Button
            variant={compact ? "ghost" : "outline"}
            size={compact ? "sm" : "default"}
          >
            <Plus />
            Add provider
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {provider ? "Edit provider" : "Add provider"}
          </DialogTitle>
          <DialogDescription>
            Keep an individual provider reusable across visits.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor={`provider-name-${provider?.id ?? "new"}`}>
              Provider name
            </Label>
            <Input
              id={`provider-name-${provider?.id ?? "new"}`}
              name="name"
              defaultValue={provider?.name}
              placeholder="e.g. Dr. Example"
              maxLength={160}
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`provider-organization-${provider?.id ?? "new"}`}>
              Care organization
            </Label>
            <Select value={organizationId} onValueChange={setOrganizationId}>
              <SelectTrigger
                id={`provider-organization-${provider?.id ?? "new"}`}
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  Independent / not specified
                </SelectItem>
                {organizations.map((organization) => (
                  <SelectItem key={organization.id} value={organization.id}>
                    {organization.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <DialogFooter>
            <Button
              disabled={createProvider.isPending || updateProvider.isPending}
            >
              {createProvider.isPending || updateProvider.isPending
                ? "Saving…"
                : provider
                  ? "Save changes"
                  : "Add provider"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteButton({
  label,
  description,
  disabled,
  onDelete,
}: {
  label: string;
  description: string;
  disabled: boolean;
  onDelete: () => Promise<void>;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={disabled}
          aria-label={`Delete ${label}`}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{label}”?</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onDelete}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
