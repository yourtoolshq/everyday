"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  TenureEmploymentLink,
  TenureHomeButton,
  TenureHomeLink,
} from "~/components/tenure/tenure-external-link";
import { api } from "~/trpc/react";

export function TenureIntegrationSetting() {
  const utils = api.useUtils();
  const status = api.tenureSync.status.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const employmentLinks = api.tenureSync.employmentLinks.useQuery(undefined, {
    enabled: status.data?.connected ?? false,
  });
  const [baseUrl, setBaseUrl] = useState("https://tenure.tools.local");

  useEffect(() => {
    if (status.data?.baseUrl) setBaseUrl(status.data.baseUrl);
  }, [status.data?.baseUrl]);

  const updateSettings = api.tenureSync.updateSettings.useMutation({
    onSuccess: async () => {
      await Promise.all([status.refetch(), employmentLinks.refetch()]);
      toast.success("Tenure connection settings saved.");
    },
    onError: (error) => toast.error(error.message),
  });
  const testConnection = api.tenureSync.testConnection.useMutation({
    onSuccess: async () => {
      await Promise.all([status.refetch(), employmentLinks.refetch()]);
      toast.success("Connected to Tenure.");
    },
    onError: (error) => toast.error(error.message),
  });
  const syncNow = api.tenureSync.syncNow.useMutation({
    onSuccess: async (result) => {
      await refreshEmploymentData();
      toast.success(
        `Synced ${result.upsertedCount} paycheque${result.upsertedCount === 1 ? "" : "s"} from Tenure.`,
      );
    },
    onError: (error) => {
      status.refetch();
      toast.error(error.message);
    },
  });
  const importEmployments = api.tenureSync.importEmployments.useMutation({
    onSuccess: async (result) => {
      await refreshEmploymentData();
      toast.success(
        `Imported ${result.createdCount} employment${result.createdCount === 1 ? "" : "s"} and synced ${result.upsertedCount} paycheque${result.upsertedCount === 1 ? "" : "s"}.`,
      );
    },
    onError: (error) => toast.error(error.message),
  });
  const setPersonMapping = api.tenureSync.setPersonMapping.useMutation({
    onSuccess: async () => {
      await employmentLinks.refetch();
      toast.success("Person mapping saved.");
    },
    onError: (error) => toast.error(error.message),
  });

  async function refreshEmploymentData() {
    await Promise.all([
      status.refetch(),
      employmentLinks.refetch(),
      utils.paycheque.list.invalidate(),
      utils.employment.list.invalidate(),
      utils.taxItem.list.invalidate(),
      utils.taxItem.overview.invalidate(),
      utils.taxEstimate.get.invalidate(),
    ]);
  }

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateSettings.mutate({ baseUrl });
  }

  const lastSyncLabel = status.data?.lastSyncAt
    ? new Date(status.data.lastSyncAt).toLocaleString()
    : "Never";

  const importableCount = useMemo(
    () =>
      employmentLinks.data?.tenureEmployments.filter((employment) => employment.canImport)
        .length ?? 0,
    [employmentLinks.data?.tenureEmployments],
  );

  const householdPeople = employmentLinks.data?.householdPeople ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          <TenureHomeLink>Tenure</TenureHomeLink> integration
        </CardTitle>
        <CardDescription>
          Tax Book is year-based. Link employments from{" "}
          <TenureHomeLink>Tenure</TenureHomeLink> for the active tax year, then sync
          paycheques and employment-income tax items automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          className="flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={saveSettings}
        >
          <div className="flex-1 space-y-2">
            <Label htmlFor="tenure-base-url">Tenure base URL</Label>
            <Input
              id="tenure-base-url"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://tenure.tools.local"
              required
            />
          </div>
          <Button type="submit" variant="outline" disabled={updateSettings.isPending}>
            Save
          </Button>
        </form>

        <div className="flex flex-wrap gap-2">
          <TenureHomeButton />
          <Button
            variant="outline"
            disabled={testConnection.isPending}
            onClick={() => testConnection.mutate()}
          >
            {testConnection.isPending ? "Testing…" : "Test connection"}
          </Button>
          <Button
            variant="outline"
            disabled={importEmployments.isPending || importableCount === 0}
            onClick={() => importEmployments.mutate()}
          >
            {importEmployments.isPending
              ? "Importing…"
              : `Import from Tenure (${importableCount})`}
          </Button>
          <Button
            disabled={syncNow.isPending || (status.data?.linkedEmploymentCount ?? 0) === 0}
            onClick={() => syncNow.mutate({ fullRefresh: true })}
          >
            {syncNow.isPending ? "Syncing…" : "Sync paycheques"}
          </Button>
        </div>

        <div className="space-y-1 text-sm text-muted-foreground">
          <p>
            Status:{" "}
            {status.data?.connected ? "Connected" : "Unable to reach Tenure"}
          </p>
          <p>Last sync: {lastSyncLabel}</p>
          <p>
            Linked employments this year: {status.data?.linkedEmploymentCount ?? 0}
          </p>
          {status.data?.lastSyncError ? (
            <p className="text-destructive">{status.data.lastSyncError}</p>
          ) : null}
          {!status.data?.connected && status.data?.connectionError ? (
            <p className="text-destructive">{status.data.connectionError}</p>
          ) : null}
        </div>

        {status.data?.connected ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium">Employments for this tax year</h3>
                <p className="text-xs text-muted-foreground">
                  Match each Tenure person to a Tax Book household member, then import
                  employments for the active tax year.
                </p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/items">View tax items</Link>
              </Button>
            </div>

            {employmentLinks.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading employments…</p>
            ) : employmentLinks.data?.tenureEmployments.length ? (
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Tenure person</th>
                      <th className="px-3 py-2">Tax Book person</th>
                      <th className="px-3 py-2">Employer</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Tenure</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employmentLinks.data.tenureEmployments.map((employment) => (
                      <tr key={employment.id} className="border-t align-top">
                        <td className="px-3 py-2">{employment.personName}</td>
                        <td className="px-3 py-2">
                          {employment.linkedEmploymentId ? (
                            <span className="text-muted-foreground">
                              {householdPeople.find(
                                (person) => person.id === employment.matchedPersonId,
                              )?.name ?? "Linked"}
                            </span>
                          ) : (
                            <Select
                              value={
                                employment.matchedPersonId
                                  ? String(employment.matchedPersonId)
                                  : "__none__"
                              }
                              onValueChange={(value) => {
                                setPersonMapping.mutate({
                                  tenurePersonId: employment.tenurePersonId,
                                  taxbookPersonId:
                                    value === "__none__" ? null : Number(value),
                                });
                              }}
                              disabled={setPersonMapping.isPending}
                            >
                              <SelectTrigger
                                className="w-full min-w-40"
                                aria-label={`Map ${employment.personName} to a Tax Book person`}
                              >
                                <SelectValue placeholder="Choose person" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Not mapped</SelectItem>
                                {householdPeople.map((person) => (
                                  <SelectItem key={person.id} value={String(person.id)}>
                                    {person.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {!employment.linkedEmploymentId &&
                          employment.personMatchKind === "name" ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Matched by name
                            </p>
                          ) : null}
                          {!employment.linkedEmploymentId &&
                          employment.personMatchKind === "mapped" ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Manually mapped
                            </p>
                          ) : null}
                          {!employment.linkedEmploymentId &&
                          !employment.matchedPersonId ? (
                            <p className="mt-1 text-xs text-destructive">
                              Choose the matching Tax Book person
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">{employment.employerName}</td>
                        <td className="px-3 py-2">
                          {employment.linkedEmploymentId ? (
                            <Badge variant="secondary">Linked</Badge>
                          ) : employment.canImport ? (
                            <Badge>Ready to import</Badge>
                          ) : (
                            <Badge variant="outline">Needs person</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <TenureEmploymentLink
                            employmentId={employment.id}
                            className="text-sm text-primary underline-offset-4 hover:underline"
                          >
                            Open
                          </TenureEmploymentLink>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No Tenure employments overlap the active tax year.
              </p>
            )}

            {employmentLinks.data?.localEmployments.length ? (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Tax Book employments this year</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {employmentLinks.data.localEmployments.map((employment) => (
                    <li key={employment.id}>
                      {employment.tenureEmploymentId ? (
                        <Link
                          href={`/items/${employment.taxItemId}`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {employment.personName} — {employment.employerName}
                        </Link>
                      ) : (
                        <span>
                          {employment.personName} — {employment.employerName}
                        </span>
                      )}
                      {employment.tenureEmploymentId ? (
                        <>
                          {" · "}
                          <TenureEmploymentLink employmentId={employment.tenureEmploymentId}>
                            Tenure
                          </TenureEmploymentLink>
                        </>
                      ) : (
                        " · not linked"
                      )}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  To link an existing Tax Book employment manually, edit it from the Paycheques
                  workspace when manual employments are in use.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
