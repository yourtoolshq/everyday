"use client";

import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import { RichTextEditor } from "~/components/ui/rich-text-editor";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { api, type RouterOutputs } from "~/trpc/react";

type Discussion = RouterOutputs["discussions"]["listByEmployment"][number];

type DiscussionFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employmentId: string;
  mode: "create" | "edit";
  discussion?: Discussion;
};

export function DiscussionFormSheet({
  open,
  onOpenChange,
  employmentId,
  mode,
  discussion,
}: DiscussionFormSheetProps) {
  const utils = api.useUtils();
  const [title, setTitle] = useState("");
  const [discussionDate, setDiscussionDate] = useState("");
  const [participants, setParticipants] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && discussion) {
      setTitle(discussion.title);
      setDiscussionDate(discussion.discussionDate ?? "");
      setParticipants(discussion.participants ?? "");
      setBody(discussion.body ?? "");
      return;
    }
    setTitle("");
    setDiscussionDate("");
    setParticipants("");
    setBody("");
  }, [discussion, mode, open]);

  const createDiscussion = api.discussions.create.useMutation({
    onSuccess: async () => {
      await utils.discussions.listByEmployment.invalidate({ employmentId });
      toast.success("Discussion saved.");
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const updateDiscussion = api.discussions.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.discussions.listByEmployment.invalidate({ employmentId }),
        utils.documents.listByEmployment.invalidate({ employmentId }),
      ]);
      toast.success("Discussion updated.");
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      title,
      discussionDate: discussionDate || null,
      participants: participants || null,
      body: body || null,
    };

    if (mode === "edit" && discussion) {
      updateDiscussion.mutate({ id: discussion.id, ...payload });
      return;
    }

    createDiscussion.mutate({ employmentId, ...payload });
  }

  const pending = createDiscussion.isPending || updateDiscussion.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <form className="flex min-h-full flex-col" onSubmit={submit}>
          <SheetHeader>
            <SheetTitle>{mode === "edit" ? "Edit discussion" : "Add discussion"}</SheetTitle>
            <SheetDescription>
              Capture meeting notes, email context, or other employment conversations.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-6 px-4 py-6">
            <div className="space-y-2">
              <Label htmlFor="discussion-title">Title</Label>
              <Input
                id="discussion-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Salary review with HR"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="discussion-date">Date</Label>
              <Input
                id="discussion-date"
                type="date"
                value={discussionDate}
                onChange={(event) => setDiscussionDate(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="discussion-participants">Participants</Label>
              <Input
                id="discussion-participants"
                value={participants}
                onChange={(event) => setParticipants(event.target.value)}
                placeholder="Jane (HR), Alex (manager)"
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <RichTextEditor
                value={body}
                onChange={setBody}
                placeholder="What was discussed, agreed, or explained?"
              />
            </div>
          </div>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Save discussion"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
