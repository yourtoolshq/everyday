"use client";

import { ExternalLink, Pencil, Trash2 } from "lucide-react";

import { Button } from "@yourtoolshq/ui/button";

import { FilePreview } from "./file-preview";

interface DocumentActionButtonsProps {
  fileId: string;
  title: string;
  mimeType: string;
  onEdit?: () => void;
  onDelete?: () => void;
  size?: "icon" | "icon-sm";
}

export function DocumentActionButtons({
  fileId,
  title,
  mimeType,
  onEdit,
  onDelete,
  size = "icon-sm",
}: DocumentActionButtonsProps) {
  return (
    <div className="flex shrink-0 gap-1">
      <Button variant="ghost" size={size} asChild>
        <FilePreview
          file={{ id: fileId, mimeType }}
          aria-label={`Open ${title}`}
        >
          <ExternalLink />
        </FilePreview>
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
