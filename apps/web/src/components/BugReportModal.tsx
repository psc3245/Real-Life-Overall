import { MAX_BUG_REPORT } from "@rlo/shared";
import { useState, type FormEvent } from "react";
import { useLocation } from "react-router";
import { useSendBugReport } from "../api/bugReports";
import { ErrorNote } from "../features/onboarding/ErrorNote";
import { Button } from "./Button";
import { fieldClass } from "./form";
import { Modal } from "./Modal";

/** "Report a bug" for dev and admin accounts; sends the page and browser along (DESIGN.md §8.9). */
export function BugReportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} label="Report a bug">
      <BugReportForm onClose={onClose} />
    </Modal>
  );
}

function BugReportForm({ onClose }: { onClose: () => void }) {
  const location = useLocation();
  const send = useSendBugReport();
  const [message, setMessage] = useState("");
  const page = `${location.pathname}${location.search}`;

  if (send.isSuccess) {
    return (
      <div className="space-y-4">
        <h2 className="font-display text-2xl uppercase">Thanks, got it</h2>
        <p className="text-court-300">It's in the queue for the team.</p>
        <div className="flex justify-end">
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        send.mutate({
          message,
          page,
          platform: "web",
          appVersion: import.meta.env.MODE,
          device: `${navigator.userAgent} · ${window.innerWidth}×${window.innerHeight}`,
        });
      }}
    >
      <div>
        <h2 className="font-display text-2xl uppercase">Report a bug</h2>
        <p className="text-sm text-court-300">
          What happened, and what did you expect? This page ({page}) and your browser are sent
          along.
        </p>
      </div>
      <textarea
        aria-label="What went wrong"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={MAX_BUG_REPORT}
        rows={5}
        autoFocus
        spellCheck
        placeholder="I tapped End my day and…"
        className={`${fieldClass} resize-y`}
      />
      <ErrorNote error={send.error} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={!message.trim() || send.isPending}>
          {send.isPending ? "Sending…" : "Send report"}
        </Button>
      </div>
    </form>
  );
}
