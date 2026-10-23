import { useEffect, useRef, type ReactNode } from "react";

/** A native modal dialog: Escape and a backdrop click close it. Renders children only while open. */
export function Modal({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      aria-label={label}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && onClose()}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-court-700 bg-court-900 p-5 text-court-100 shadow-2xl backdrop:bg-black/60"
    >
      {open && children}
    </dialog>
  );
}
