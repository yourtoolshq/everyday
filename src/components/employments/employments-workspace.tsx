"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { employmentStatusLabels, employmentStatuses } from "~/lib/employment-status";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
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

export function EmploymentsWorkspace() {
  const utils = api.useUtils();
  const employments = api.employments.list.useQuery();
  const employers = api.employers.list.useQuery();
  const people = api.people.list.useQuery();
  const createEmployment = api.employments.create.useMutation({
    onSuccess: async () => {
      resetForm();
      await utils.employments.list.invalidate();
      toast.success("Employment added.");
    },
    onError: (error) => toast.error(error.message),
  });
  const deleteEmployment = api.employments.delete.useMutation({
    onSuccess: async () => {
      await utils.employments.list.invalidate();
      toast.success("Employment removed.");
    },
    onError: (error) => toast.error(error.message),
  });

  const [employerId, setEmployerId] = useState("");
  const [personId, setPersonId] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [status, setStatus] = useState(employmentStatuses[0]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");

  function resetForm() {
    setEmployerId("");
    setPersonId("");
    setJobTitle("");
    setStatus(employmentStatuses[0]);
    setStartDate("");
    setEndDate("");
    setNotes("");
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-none">
        <CardContent className="space-y-4 p-4">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!employerId || !personId) {
                toast.error("Choose an employer and person.");
                return;
              }
              createEmployment.mutate({
                employerId,
                personId,
                jobTitle: jobTitle.trim() || null,
                status,
                startDate: startDate || null,
                endDate: endDate || null,
                notes: notes.trim() || null,
              });
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Employer</Label>
                <Select value={employerId} onValueChange={setEmployerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose employer" />
                  </SelectTrigger>
                  <SelectContent>
                    {employers.data?.map((employer) => (
                      <SelectItem key={employer.id} value={employer.id}>
                        {employer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Person</Label>
                <Select value={personId} onValueChange={setPersonId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose person" />
                  </SelectTrigger>
                  <SelectContent>
                    {people.data?.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="job-title">Job title</Label>
                <Input
                  id="job-title"
                  value={jobTitle}
                  onChange={(event) => setJobTitle(event.target.value)}
                  placeholder="Software engineer"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={status}
                  onValueChange={(value) => setStatus(value as typeof status)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {employmentStatuses.map((item) => (
                      <SelectItem key={item} value={item}>
                        {employmentStatusLabels[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="start-date">Start date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="employment-notes">Notes</Label>
              <Textarea
                id="employment-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
              />
            </div>
            <Button type="submit" disabled={createEmployment.isPending}>
              <Plus /> Add employment
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {employments.data?.map((employment) => (
          <Card key={employment.id} className="shadow-none">
            <CardContent className="flex items-start justify-between gap-4 p-4">
              <div className="space-y-1">
                <p className="font-medium">{employment.employerName}</p>
                <p className="text-sm text-muted-foreground">
                  {employment.personName}
                  {employment.jobTitle ? ` · ${employment.jobTitle}` : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  {employmentStatusLabels[employment.status]}
                  {employment.startDate ? ` · from ${employment.startDate}` : ""}
                  {employment.endDate ? ` to ${employment.endDate}` : ""}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove employment at ${employment.employerName}`}
                onClick={() => deleteEmployment.mutate({ id: employment.id })}
              >
                <Trash2 />
              </Button>
            </CardContent>
          </Card>
        ))}
        {employments.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">No employments yet.</p>
        ) : null}
      </div>
    </div>
  );
}
