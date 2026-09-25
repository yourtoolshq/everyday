import type { BackupScheduleSummary, BackupSummary } from "@yourtoolshq/data";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@yourtoolshq/ui/card";

import { LocalTime } from "./local-time";
import { VerificationBadge } from "./verification-badge";

export function ScheduleCard({
  schedule,
  backups,
}: {
  schedule: BackupScheduleSummary | null;
  backups: BackupSummary[];
}) {
  const lastScheduled = backups.find(
    (backup) => backup.manifest?.trigger === "scheduled",
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Automatic backups</CardTitle>
        <CardDescription>
          {schedule
            ? `Every day at ${schedule.schedule.slice("daily@".length)}, server time.`
            : "Automatic backups are off for this app."}
        </CardDescription>
      </CardHeader>
      {schedule ? (
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
            <dt>Keeps</dt>
            <dd>
              {schedule.retention.daily} daily · {schedule.retention.weekly}{" "}
              weekly · {schedule.retention.monthly} monthly
            </dd>
            <dt>Last</dt>
            <dd className="flex flex-wrap items-center gap-2">
              {lastScheduled?.manifest ? (
                <>
                  <LocalTime iso={lastScheduled.manifest.createdAt} />
                  <VerificationBadge
                    verification={lastScheduled.verification}
                  />
                </>
              ) : (
                "None yet"
              )}
            </dd>
            <dt>Next</dt>
            <dd>
              {schedule.nextRunAt ? (
                <LocalTime iso={schedule.nextRunAt} />
              ) : (
                "Not scheduled"
              )}
            </dd>
          </dl>
        </CardContent>
      ) : null}
    </Card>
  );
}
