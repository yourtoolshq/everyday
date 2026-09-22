"use client";

import { useMemo, useState } from "react";
import { IconBriefcase, IconDownload, IconPlus } from "@tabler/icons-react";
import { toast } from "sonner";

import type { RouterOutputs } from "~/trpc/react";
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
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import { formatCad } from "~/domain/money";
import { api } from "~/trpc/react";
import { EmploymentFormSheet } from "./employment-form-sheet";
import { PaychequeFormSheet } from "./paycheque-form-sheet";
import { PaychequesTable } from "./paycheques-table";

type Employment = RouterOutputs["employment"]["list"]["items"][number];
type Paycheque = RouterOutputs["paycheque"]["list"]["items"][number];

const totalFields = [
  "grossPayCents",
  "incomeTaxCents",
  "cppCents",
  "cpp2Cents",
  "eiCents",
  "wiCents",
  "ltdCents",
  "extendedHealthCents",
  "travelMedicalCents",
  "unionDuesCents",
  "otherDeductionsCents",
  "netPayCents",
] as const;

export function Paycheques() {
  const utils = api.useUtils();
  const employmentsQuery = api.employment.list.useQuery();
  const paychequesQuery = api.paycheque.list.useQuery();
  const settingsQuery = api.settings.get.useQuery();
  const [personFilter, setPersonFilter] = useState("all");
  const [employmentFilter, setEmploymentFilter] = useState("all");
  const [employmentFormOpen, setEmploymentFormOpen] = useState(false);
  const [editingEmployment, setEditingEmployment] = useState<Employment | null>(
    null,
  );
  const [deletingEmployment, setDeletingEmployment] =
    useState<Employment | null>(null);
  const [paychequeFormOpen, setPaychequeFormOpen] = useState(false);
  const [editingPaycheque, setEditingPaycheque] = useState<Paycheque | null>(
    null,
  );
  const [deletingPaycheque, setDeletingPaycheque] = useState<Paycheque | null>(
    null,
  );

  const employments = useMemo(
    () => employmentsQuery.data?.items ?? [],
    [employmentsQuery.data],
  );
  const paycheques = useMemo(
    () => paychequesQuery.data?.items ?? [],
    [paychequesQuery.data],
  );
  const personEmployments = useMemo(
    () =>
      employments.filter(
        (employment) =>
          personFilter === "all" ||
          String(employment.personId) === personFilter,
      ),
    [employments, personFilter],
  );
  const filteredEmployments = useMemo(
    () =>
      personEmployments.filter(
        (employment) =>
          employmentFilter === "all" ||
          String(employment.id) === employmentFilter,
      ),
    [employmentFilter, personEmployments],
  );
  const filteredPaycheques = useMemo(
    () =>
      paycheques.filter(
        (paycheque) =>
          (personFilter === "all" ||
            String(paycheque.personId) === personFilter) &&
          (employmentFilter === "all" ||
            String(paycheque.employmentId) === employmentFilter),
      ),
    [employmentFilter, paycheques, personFilter],
  );
  const totals = useMemo(
    () =>
      Object.fromEntries(
        totalFields.map((field) => [
          field,
          filteredPaycheques.reduce((sum, item) => sum + item[field], 0),
        ]),
      ) as Record<(typeof totalFields)[number], number>,
    [filteredPaycheques],
  );
  const projection = filteredEmployments.reduce(
    (sum, employment) =>
      sum + (employment.projection?.projectedGrossCents ?? 0),
    0,
  );
  const selectedEmployment =
    employmentFilter === "all"
      ? null
      : (employments.find(
          (employment) => String(employment.id) === employmentFilter,
        ) ?? null);

  const deletePaycheque = api.paycheque.delete.useMutation({
    onSuccess: async () => {
      setDeletingPaycheque(null);
      await Promise.all([
        utils.paycheque.list.invalidate(),
        utils.employment.list.invalidate(),
        utils.taxItem.list.invalidate(),
        utils.taxItem.overview.invalidate(),
        utils.taxEstimate.get.invalidate(),
      ]);
      toast.success("Paycheque deleted.");
    },
    onError: (error) => toast.error(error.message),
  });
  const deleteEmployment = api.employment.delete.useMutation({
    onSuccess: async () => {
      setDeletingEmployment(null);
      setEmploymentFilter("all");
      await Promise.all([
        utils.employment.list.invalidate(),
        utils.paycheque.list.invalidate(),
        utils.taxItem.list.invalidate(),
        utils.taxItem.overview.invalidate(),
        utils.taxEstimate.get.invalidate(),
      ]);
      toast.success("Employment and its paycheques deleted.");
    },
    onError: (error) => toast.error(error.message),
  });

  function addEmployment() {
    setEditingEmployment(null);
    setEmploymentFormOpen(true);
  }

  function editEmployment(employmentId: number) {
    const employment = employments.find((item) => item.id === employmentId);
    if (!employment) return;
    setEditingEmployment(employment);
    setEmploymentFormOpen(true);
  }

  function addPaycheque() {
    setEditingPaycheque(null);
    setPaychequeFormOpen(true);
  }

  function editPaycheque(paycheque: Paycheque) {
    setEditingPaycheque(paycheque);
    setPaychequeFormOpen(true);
  }

  if (
    employmentsQuery.isLoading ||
    paychequesQuery.isLoading ||
    settingsQuery.isLoading
  ) {
    return (
      <div className="space-y-5 p-6">
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-4 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }
  const error =
    employmentsQuery.error ?? paychequesQuery.error ?? settingsQuery.error;
  if (
    error ||
    !employmentsQuery.data ||
    !paychequesQuery.data ||
    !settingsQuery.data
  ) {
    return (
      <div className="text-destructive p-6 text-sm">
        Unable to load paycheques. {error?.message}
      </div>
    );
  }

  const year = paychequesQuery.data.year.year;
  const summary = [
    ["Gross received", totals.grossPayCents],
    [
      "Deductions",
      totals.incomeTaxCents +
        totals.cppCents +
        totals.cpp2Cents +
        totals.eiCents +
        totals.wiCents +
        totals.ltdCents +
        totals.extendedHealthCents +
        totals.travelMedicalCents +
        totals.unionDuesCents +
        totals.otherDeductionsCents,
    ],
    ["Net pay", totals.netPayCents],
    ["Projected income", projection],
  ] as const;

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-primary text-sm font-medium">{year} tax year</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            Paycheques
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Track employment income from each pay statement.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={addEmployment}>
            <IconBriefcase /> Add employment
          </Button>
          <Button onClick={addPaycheque} disabled={employments.length === 0}>
            <IconPlus /> Add paycheque
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={personFilter}
          onValueChange={(value) => {
            setPersonFilter(value);
            setEmploymentFilter("all");
          }}
        >
          <SelectTrigger className="w-48" aria-label="Filter by person">
            <SelectValue placeholder="All people" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All people</SelectItem>
            {settingsQuery.data.people.map((person) => (
              <SelectItem key={person.id} value={String(person.id)}>
                {person.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={employmentFilter} onValueChange={setEmploymentFilter}>
          <SelectTrigger className="w-64" aria-label="Filter by employer">
            <SelectValue placeholder="All employers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All employers</SelectItem>
            {personEmployments.map((employment) => (
              <SelectItem key={employment.id} value={String(employment.id)}>
                {personFilter === "all" ? `${employment.personName} — ` : ""}
                {employment.employerName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedEmployment ? (
          <>
            <Button
              variant="ghost"
              onClick={() => editEmployment(selectedEmployment.id)}
            >
              Edit employment
            </Button>
            <Button asChild variant="outline">
              <a
                href={`/api/paycheques/export?employmentId=${selectedEmployment.id}`}
                download
              >
                <IconDownload />
                Export for Tenure
              </a>
            </Button>
          </>
        ) : null}
        <span className="text-muted-foreground ml-auto text-xs">
          {filteredPaycheques.length} of {paycheques.length} shown
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map(([label, value]) => (
          <Card
            key={label}
            className={
              label === "Projected income"
                ? "from-primary/[0.06] to-card bg-gradient-to-b"
                : undefined
            }
          >
            <CardHeader className="pb-1">
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-xl tabular-nums">
                {formatCad(value)}
              </CardTitle>
            </CardHeader>
            {label === "Projected income" && selectedEmployment?.projection ? (
              <CardContent>
                <p className="text-muted-foreground text-xs">
                  {selectedEmployment.projection.remainingPaycheques} estimated
                  pays remaining
                  {selectedEmployment.projection.typicalGrossCents !== null
                    ? ` · ${formatCad(selectedEmployment.projection.typicalGrossCents)} ${selectedEmployment.typicalGrossOverrideCents === null ? "average" : "typical override"}`
                    : ""}
                </p>
              </CardContent>
            ) : null}
          </Card>
        ))}
      </div>

      <PaychequesTable
        items={filteredPaycheques}
        totalCount={paycheques.length}
        hasEmployments={employments.length > 0}
        onAdd={addPaycheque}
        onEdit={editPaycheque}
        onEditEmployment={editEmployment}
        onDelete={setDeletingPaycheque}
      />

      {employmentFormOpen ? (
        <EmploymentFormSheet
          key={editingEmployment?.id ?? "new"}
          employment={editingEmployment}
          people={settingsQuery.data.people}
          initialPersonId={personFilter === "all" ? null : Number(personFilter)}
          year={year}
          open={employmentFormOpen}
          onOpenChange={setEmploymentFormOpen}
          onRequestDelete={(employment) => {
            setEmploymentFormOpen(false);
            setDeletingEmployment(employment);
          }}
        />
      ) : null}
      {paychequeFormOpen ? (
        <PaychequeFormSheet
          key={editingPaycheque?.id ?? "new"}
          paycheque={editingPaycheque}
          employments={employments}
          initialEmploymentId={selectedEmployment?.id ?? null}
          year={year}
          open={paychequeFormOpen}
          onOpenChange={setPaychequeFormOpen}
        />
      ) : null}

      <AlertDialog
        open={Boolean(deletingPaycheque)}
        onOpenChange={(open) => !open && setDeletingPaycheque(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this paycheque?</AlertDialogTitle>
            <AlertDialogDescription>
              The paycheque and calculated employment-income totals will be
              updated. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              disabled={deletePaycheque.isPending}
              onClick={() =>
                deletingPaycheque &&
                deletePaycheque.mutate({ id: deletingPaycheque.id })
              }
            >
              {deletePaycheque.isPending ? "Deleting…" : "Delete paycheque"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deletingEmployment)}
        onOpenChange={(open) => !open && setDeletingEmployment(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this employment?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deletingEmployment?.employerName}”, all of its paycheques, and
              its calculated Tax Item will be permanently removed. This cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              disabled={deleteEmployment.isPending}
              onClick={() =>
                deletingEmployment &&
                deleteEmployment.mutate({ id: deletingEmployment.id })
              }
            >
              {deleteEmployment.isPending ? "Deleting…" : "Delete employment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
