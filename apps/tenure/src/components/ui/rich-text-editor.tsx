"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, ListOrdered } from "lucide-react";
import { useEffect } from "react";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "min-h-32 px-3 py-2 text-sm focus:outline-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value || "";
    if (current !== next) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [editor, value]);

  return (
    <div className={cn("overflow-hidden rounded-md border bg-background", className)}>
      <div className="flex flex-wrap gap-1 border-b bg-muted/40 p-1">
        <Button
          type="button"
          variant={editor?.isActive("bold") ? "secondary" : "ghost"}
          size="icon-sm"
          aria-label="Bold"
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold />
        </Button>
        <Button
          type="button"
          variant={editor?.isActive("italic") ? "secondary" : "ghost"}
          size="icon-sm"
          aria-label="Italic"
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic />
        </Button>
        <Button
          type="button"
          variant={editor?.isActive("bulletList") ? "secondary" : "ghost"}
          size="icon-sm"
          aria-label="Bullet list"
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List />
        </Button>
        <Button
          type="button"
          variant={editor?.isActive("orderedList") ? "secondary" : "ghost"}
          size="icon-sm"
          aria-label="Numbered list"
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered />
        </Button>
      </div>
      <EditorContent editor={editor} />
      {!value && placeholder ? (
        <p className="pointer-events-none -mt-24 px-3 py-2 text-sm text-muted-foreground">
          {placeholder}
        </p>
      ) : null}
    </div>
  );
}

export function RichTextContent({ html }: { html: string | null | undefined }) {
  if (!html?.trim()) {
    return <p className="text-sm text-muted-foreground">No notes yet.</p>;
  }

  return (
    <div
      className="prose prose-sm max-w-none text-sm [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
