import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Link, NavLink, useLocation } from "react-router";

/**
 * A dropdown menu: a trigger button and a panel of links or actions. The panel is fixed-positioned
 * under the trigger, so it isn't clipped by scrolling rows (the phone nav). Closes on Escape, an
 * outside click, picking an item, navigation, scroll or resize. Arrow keys move between items.
 */
export function Menu({
  trigger,
  label,
  align = "start",
  triggerClassName = "",
  children,
}: {
  /** What the trigger shows; a ▾ is added after it. */
  trigger: ReactNode;
  /** Accessible name for the trigger when `trigger` isn't plain text. */
  label?: string;
  align?: "start" | "end";
  triggerClassName?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const location = useLocation();

  const close = useCallback((refocus = false) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  }, []);

  // Close when the route changes (an item was followed).
  useEffect(() => close(), [location.pathname, location.search, close]);

  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const rect = button.current.getBoundingClientRect();
    const top = rect.bottom + 6;
    setStyle(
      align === "end"
        ? { top, right: Math.max(8, window.innerWidth - rect.right) }
        : { top, left: Math.max(8, Math.min(rect.left, window.innerWidth - 232)) },
    );
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panel.current?.contains(target) && !button.current?.contains(target)) close();
    };
    const onScroll = (e: Event) => {
      if (!panel.current?.contains(e.target as Node)) close();
    };
    const onResize = () => close();
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, close]);

  const items = () =>
    Array.from(panel.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);
  const focusItem = (index: number) => {
    const all = items();
    all[(index + all.length) % all.length]?.focus();
  };

  // Focus the first item when opened from the keyboard.
  const openWithKeyboard = useRef(false);
  useEffect(() => {
    if (open && openWithKeyboard.current) focusItem(0);
    openWithKeyboard.current = false;
  }, [open]);

  const onTriggerKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      openWithKeyboard.current = true;
      setOpen(true);
      if (open) focusItem(0);
    }
  };
  const onPanelKey = (e: KeyboardEvent) => {
    const all = items();
    const i = all.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      focusItem(i + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusItem(i - 1);
    } else if (e.key === "Tab") {
      close();
    }
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKey}
        className={`inline-flex items-center gap-1 ${triggerClassName}`}
      >
        {trigger}
        <span aria-hidden className={`text-[0.7em] transition ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {open && (
        <div
          ref={panel}
          id={id}
          role="menu"
          style={style}
          onKeyDown={onPanelKey}
          // Picking an item closes the menu; links also close via the route change.
          onClick={(e) => (e.target as HTMLElement).closest("[role=menuitem]") && close()}
          className="fixed z-50 min-w-56 overflow-hidden rounded-xl border border-court-700 bg-court-900 py-1.5 shadow-2xl shadow-black/50"
        >
          {children}
        </div>
      )}
    </>
  );
}

const itemClass =
  "flex w-full items-center gap-3 px-3.5 py-2 text-left text-sm text-court-100 outline-none hover:bg-court-800 focus-visible:bg-court-800";

/** A menu link. `detail` adds a muted second line; `badge` a count pill. */
export function MenuLink({
  to,
  children,
  detail,
  badge,
}: {
  to: string | { search: string };
  children: ReactNode;
  detail?: ReactNode;
  badge?: number;
}) {
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block">{children}</span>
        {detail && <span className="block text-xs text-court-500">{detail}</span>}
      </span>
      {badge ? (
        <span className="rounded-full bg-neon px-1.5 text-[10px] font-semibold text-court-950">
          {badge}
        </span>
      ) : null}
    </>
  );
  // Path links show which page you're on; search-only links (open a modal) don't.
  if (typeof to !== "string") {
    return (
      <Link role="menuitem" to={to} className={itemClass}>
        {body}
      </Link>
    );
  }
  return (
    <NavLink
      role="menuitem"
      to={to}
      className={({ isActive }) => `${itemClass} ${isActive ? "text-neon" : ""}`}
    >
      {body}
    </NavLink>
  );
}

export function MenuButton({
  onSelect,
  children,
  danger,
}: {
  onSelect: () => void;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={`${itemClass} ${danger ? "text-flare" : ""}`}
    >
      {children}
    </button>
  );
}

export function MenuDivider() {
  return <div role="separator" className="my-1.5 border-t border-court-800" />;
}

/** A small caption above a group of items. */
export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-3.5 pt-1.5 pb-1 text-[10px] uppercase tracking-[0.2em] text-court-500">
      {children}
    </div>
  );
}
