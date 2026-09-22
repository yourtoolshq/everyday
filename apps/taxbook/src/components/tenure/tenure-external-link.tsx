"use client";

import { IconExternalLink } from "@tabler/icons-react";

import { Button } from "~/components/ui/button";
import { tenureEmploymentUrl, tenureHomeUrl } from "~/lib/tenure-url";
import { api } from "~/trpc/react";

import { TenureTag } from "./tenure-tag";

function useTenureUrls() {
  const status = api.tenureSync.status.useQuery();
  const baseUrl = status.data?.baseUrl;

  return {
    baseUrl,
    employmentUrl: (employmentId: string) =>
      baseUrl ? tenureEmploymentUrl(baseUrl, employmentId) : null,
    homeUrl: baseUrl ? tenureHomeUrl(baseUrl) : null,
  };
}

export function TenureEmploymentButton({
  employmentId,
  label = "Manage in Tenure",
  size = "default",
  variant = "default",
}: {
  employmentId: string;
  label?: string;
  size?: "default" | "sm";
  variant?: "default" | "outline";
}) {
  const { employmentUrl } = useTenureUrls();
  const href = employmentUrl(employmentId);
  if (!href) return null;

  return (
    <Button asChild size={size} variant={variant}>
      <a href={href} target="_blank" rel="noreferrer">
        {label}
        <IconExternalLink className="size-4" />
      </a>
    </Button>
  );
}

export function TenureHomeButton({
  label = "Open Tenure",
  size = "sm",
  variant = "outline",
}: {
  label?: string;
  size?: "default" | "sm";
  variant?: "default" | "outline";
}) {
  const { homeUrl } = useTenureUrls();
  if (!homeUrl) return null;

  return (
    <Button asChild size={size} variant={variant}>
      <a href={homeUrl} target="_blank" rel="noreferrer">
        {label}
        <IconExternalLink className="size-4" />
      </a>
    </Button>
  );
}

export function TenureEmploymentLink({
  employmentId,
  children,
  className,
}: {
  employmentId: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { employmentUrl } = useTenureUrls();
  const href = employmentUrl(employmentId);
  if (!href) return <>{children}</>;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={className ?? "text-primary underline-offset-4 hover:underline"}
    >
      {children}
    </a>
  );
}

export function TenureHomeLink({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { homeUrl } = useTenureUrls();
  if (!homeUrl) return <>{children}</>;

  return (
    <a
      href={homeUrl}
      target="_blank"
      rel="noreferrer"
      className={className ?? "text-primary underline-offset-4 hover:underline"}
    >
      {children}
    </a>
  );
}

export function TenureEmploymentTag({ employmentId }: { employmentId: string }) {
  const { employmentUrl } = useTenureUrls();
  return <TenureTag href={employmentUrl(employmentId) ?? undefined} />;
}
