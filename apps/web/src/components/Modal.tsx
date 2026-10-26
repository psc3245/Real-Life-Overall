import { useEffect, useRef, type ReactNode } from "react";

const SIZES = {
  sm: "w-[min(22rem,calc(100vw-2rem))] p-4",
  md: "w-[min(28rem,calc(100vw-2rem))] p-5",
  lg: "w-[min(40rem,calc(100vw-2rem))] p-5",
  xl: "w-[min(48rem,calc(100vw-2rem))] p-5",
};

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
  size?: "sm" | "md" | "lg" | "xl";
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
      className={`m-auto rounded-2xl border border-court-700 bg-court-900 text-court-100 shadow-2xl backdrop:bg-black/60 ${SIZES[size]}`}
    >
      {open && children}
    </dialog>
  );
}
