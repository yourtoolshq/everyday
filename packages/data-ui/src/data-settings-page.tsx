"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  BackupScheduleSummary,
  BackupSummary,
  IntegrityReport,
  StorageUsage,
} from "@yourtoolshq/data";

import { BackupsCard } from "./backups-card";
import { dataClient, describeError } from "./client";
import { IntegrityCard } from "./integrity-card";
import { ScheduleCard } from "./schedule-card";
import { StorageCard } from "./storage-card";

export interface DataSettings {
  usage: StorageUsage;
  schedule: BackupScheduleSummary | null;
  backups: BackupSummary[];
  integrity: IntegrityReport | null;
}

export function DataSettingsPage() {
  const [settings, setSettings] = useState<DataSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [usage, schedule, list, integrity] = await Promise.all([
        dataClient.usage.get.query(),
        dataClient.schedule.get.query(),
        dataClient.backups.list.query(),
        dataClient.integrity.last.query(),
      ]);
      setSettings({ usage, schedule, backups: list.backups, integrity });
      setLoadError(null);
    } catch (error) {
      setLoadError(describeError(error));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      {loadError ? (
        <p role="alert" className="text-destructive">
          The data settings could not be loaded: {loadError}
        </p>
      ) : null}
      {settings ? (
        <DataSettingsView settings={settings} onChanged={load} />
      ) : loadError ? null : (
        <p className="text-muted-foreground">Loading…</p>
      )}
    </div>
  );
}

export function DataSettingsView({
  settings,
  onChanged,
}: {
  settings: DataSettings;
  onChanged: () => Promise<void>;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <StorageCard usage={settings.usage} />
      <ScheduleCard schedule={settings.schedule} backups={settings.backups} />
      <div className="md:col-span-2">
        <BackupsCard backups={settings.backups} onChanged={onChanged} />
      </div>
      <div className="md:col-span-2">
        <IntegrityCard report={settings.integrity} onChanged={onChanged} />
      </div>
    </div>
  );
}
