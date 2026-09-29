"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, Pencil, Plus } from "lucide-react";

import { Badge } from "@yourtoolshq/ui/badge";
import { Button } from "@yourtoolshq/ui/button";
import { Card, CardContent } from "@yourtoolshq/ui/card";
import { Skeleton } from "@yourtoolshq/ui/skeleton";

import { AccountFormSheet } from "~/components/accounts/account-form-sheet";
import { InstitutionFormSheet } from "~/components/institutions/institution-form-sheet";
import { InstitutionIcon } from "~/components/institutions/institution-icon";
import { accountStatusLabels } from "~/lib/account-status";
import { accountTypeLabels } from "~/lib/account-types";
import { groupInstitutionAccounts } from "~/lib/institution-account-groups";
import { api } from "~/trpc/react";

export function InstitutionDetailWorkspace({
  institutionId,
}: {
  institutionId: string;
}) {
  const institution = api.institutions.get.useQuery({ id: institutionId });
  const accounts = api.accounts.list.useQuery();
  const [editOpen, setEditOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  if (institution.isLoading || accounts.isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }
  if (institution.error || !institution.data || accounts.error) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/institutions">
            <ArrowLeft />
            Institutions
          </Link>
        </Button>
        <p className="text-destructive text-sm">
          {institution.error?.message ??
            accounts.error?.message ??
            "Institution not found."}
        </p>
      </div>
    );
  }

  const item = institution.data;
  const groups = groupInstitutionAccounts(
    (accounts.data ?? []).filter(
      (account) => account.institutionId === institutionId,
    ),
  );

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/institutions">
          <ArrowLeft />
          Institutions
        </Link>
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <InstitutionIcon fileId={item.iconFileId} className="size-16" />
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">
              {item.name}
            </h2>
            {item.website ? (
              <p className="text-muted-foreground text-sm">{item.website}</p>
            ) : null}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil />
            Edit
          </Button>
          <Button onClick={() => setAccountOpen(true)}>
            <Plus />
            Add account
          </Button>
        </div>
      </div>
      {item.notes ? (
        <p className="text-muted-foreground text-sm">{item.notes}</p>
      ) : null}
      {groups.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="flex min-h-40 flex-col items-center justify-center gap-3 text-center">
            <p>No accounts at this institution yet.</p>
            <Button variant="outline" onClick={() => setAccountOpen(true)}>
              <Plus />
              Add account
            </Button>
          </CardContent>
        </Card>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="space-y-2">
            <h3 className="text-lg font-semibold">{group.label}</h3>
            <div className="space-y-2">
              {group.accounts.map((account) => (
                <Link
                  key={account.id}
                  href={`/accounts/${account.id}`}
                  className="block"
                >
                  <Card className="hover:bg-muted/30 shadow-none transition-colors">
                    <CardContent className="flex items-center justify-between gap-4 p-4">
                      <div>
                        <p className="font-medium">{account.displayName}</p>
                        <p className="text-muted-foreground text-sm">
                          {accountTypeLabels[account.accountType]}
                          {account.identifierSuffix
                            ? ` · …${account.identifierSuffix}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {accountStatusLabels[account.status]}
                        </Badge>
                        <ChevronRight className="text-muted-foreground size-4" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
      {editOpen ? (
        <InstitutionFormSheet
          key={item.id}
          institution={item}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      ) : null}
      {accountOpen ? (
        <AccountFormSheet
          key={`new-${item.id}`}
          account={null}
          initialInstitutionId={item.id}
          open={accountOpen}
          onOpenChange={setAccountOpen}
        />
      ) : null}
    </div>
  );
}
