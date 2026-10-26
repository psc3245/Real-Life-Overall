import { useEffect, useRef, type ReactNode } from "react";

/** A native modal dialog: Escape and a backdrop click close it. Renders children only while open. */
export function Modal({
  open,
  onClose,
  label,
  size = "md",
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  size?: "sm" | "md" | "lg";
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
      className={`m-auto rounded-2xl border border-court-700 bg-court-900 text-court-100 shadow-2xl backdrop:bg-black/60 ${size === "sm" ? "w-[min(22rem,calc(100vw-2rem))] p-4" : size === "lg" ? "w-[min(40rem,calc(100vw-2rem))] p-5" : "w-[min(28rem,calc(100vw-2rem))] p-5"}`}
    >
      {open && children}
    </dialog>
  );
}
