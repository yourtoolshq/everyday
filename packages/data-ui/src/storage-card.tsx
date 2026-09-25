import type { StorageUsage, VolumeSpace } from "@yourtoolshq/data";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@yourtoolshq/ui/card";

import { formatBytes } from "./format";

const groupLabels: Record<keyof StorageUsage["files"]["byGroup"], string> = {
  pdf: "PDF",
  image: "Images",
  eml: "Email",
  audio: "Audio",
  other: "Other",
};

export function StorageCard({ usage }: { usage: StorageUsage }) {
  const groups = Object.entries(usage.files.byGroup)
    .filter(([, amount]) => amount.count > 0)
    .map(
      ([group, amount]) =>
        `${groupLabels[group as keyof typeof groupLabels]} ${formatBytes(amount.bytes)}`,
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Storage</CardTitle>
        <CardDescription>Space used by this app&apos;s data.</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="space-y-3">
          <Row label="Database" value={formatBytes(usage.database.bytes)} />
          <Row
            label={`Files (${usage.files.count})`}
            value={formatBytes(usage.files.bytes)}
            detail={groups.join(" · ")}
          />
          <Row
            label={`Backups (${usage.backups.count})`}
            value={formatBytes(usage.backups.bytes)}
          />
          <VolumeRow label="Data volume" space={usage.volumes.data} />
          <VolumeRow label="Backup volume" space={usage.volumes.backups} />
        </dl>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-x-4">
      <dt>{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
      {detail ? (
        <dd className="text-muted-foreground col-span-2 text-xs">{detail}</dd>
      ) : null}
    </div>
  );
}

function VolumeRow({ label, space }: { label: string; space: VolumeSpace }) {
  const usedPercent =
    space.totalBytes > 0
      ? Math.round((1 - space.freeBytes / space.totalBytes) * 100)
      : 0;
  return (
    <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5">
      <dt>{label}</dt>
      <dd className="font-medium tabular-nums">
        {formatBytes(space.freeBytes)} free of {formatBytes(space.totalBytes)}
      </dd>
      <dd
        aria-hidden
        className="bg-muted col-span-2 h-1.5 overflow-hidden rounded-full"
      >
        <div
          className="bg-primary h-full rounded-full"
          style={{ width: `${usedPercent}%` }}
        />
      </dd>
    </div>
  );
}
