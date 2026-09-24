"use client";

import { ExternalLink, Mail, Pencil, Trash2 } from "lucide-react";

import { fileUrl } from "@yourtoolshq/data-ui";

import { Button } from "~/components/ui/button";

type DocumentActionButtonsProps = {
  fileId: string;
  title: string;
  mimeType?: string;
  onPreview?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  size?: "icon" | "icon-sm";
};

export function DocumentActionButtons({
  fileId,
  title,
  onPreview,
  onEdit,
  onDelete,
  size = "icon-sm",
}: DocumentActionButtonsProps) {
  return (
    <div className="flex shrink-0 gap-1">
      {onPreview ? (
        <Button
          variant="ghost"
          size={size}
          aria-label={`Preview ${title}`}
          onClick={onPreview}
        >
          <Mail />
        </Button>
      ) : null}
      <Button variant="ghost" size={size} asChild>
        <a
          href={fileUrl(fileId)}
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
