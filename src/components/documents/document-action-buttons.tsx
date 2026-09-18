"use client";

import { ExternalLink, Pencil, Trash2 } from "lucide-react";

import { Button } from "~/components/ui/button";

type DocumentActionButtonsProps = {
  documentId: string;
  title: string;
  onEdit?: () => void;
  onDelete?: () => void;
  size?: "icon" | "icon-sm";
};

export function DocumentActionButtons({
  documentId,
  title,
  onEdit,
  onDelete,
  size = "icon-sm",
}: DocumentActionButtonsProps) {
  return (
    <div className="flex shrink-0 gap-1">
      <Button variant="ghost" size={size} asChild>
        <a
          href={`/api/documents/${documentId}/file`}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${title}`}
        >
          <ExternalLink />
        </a>
      </Button>
      {onEdit ? (
        <Button
          variant="ghost"
          size={size}
          aria-label={`Edit ${title}`}
          onClick={onEdit}
        >
          <Pencil />
        </Button>
      ) : null}
      {onDelete ? (
        <Button
          variant="ghost"
          size={size}
          aria-label={`Delete ${title}`}
          onClick={onDelete}
        >
          <Trash2 />
        </Button>
      ) : null}
    </div>
  );
}
