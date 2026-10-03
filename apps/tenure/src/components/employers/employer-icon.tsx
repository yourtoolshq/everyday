"use client";

import { useState } from "react";
import Image from "next/image";
import { Building2 } from "lucide-react";

import { cn } from "~/lib/utils";

export function EmployerIcon({
  fileId,
  className,
}: {
  fileId: string | null;
  className?: string;
}) {
  const [failedId, setFailedId] = useState<string | null>(null);
  const showImage = fileId !== null && fileId !== failedId;

  return (
    <span
      className={cn(
        "relative inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg",
        !showImage && "bg-muted text-muted-foreground border",
        className,
      )}
      aria-hidden="true"
    >
      {showImage ? (
        <Image
          src={`/api/data/files/${fileId}`}
          alt=""
          width={64}
          height={64}
          unoptimized
          className="size-full object-cover"
          onError={() => setFailedId(fileId)}
        />
      ) : (
        <Building2 className="size-1/2" />
      )}
    </span>
  );
}
