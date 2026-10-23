import { addDays, dayOfWeek, MAX_HISTORY_DAYS } from "@rlo/shared";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useActivity } from "../api/ratings";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const monthStart = (date: string) => `${date.slice(0, 7)}-01`;
const shiftMonth = (start: string, by: number) => {
  const [y, m] = start.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 10);
};
const monthLabel = (start: string) =>
  new Date(`${start}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * A calendar button that opens a month view; picking a day opens its log. Days you logged are
 * marked, recapped ones filled.
 */
export function DayPicker({ today, selected }: { today: string; selected?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(monthStart(selected ?? today));
  const activity = useActivity(MAX_HISTORY_DAYS);
  const navigate = useNavigate();

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal?.();
    if (!open && el.open) el.close?.();
  }, [open]);

  const byDate = new Map((activity.data ?? []).map((a) => [a.date, a]));
  const firstLogged = activity.data?.[0]?.date;
  const lead = dayOfWeek(month);
  const nextMonth = shiftMonth(month, 1);
  const days: string[] = [];
  for (let d = month; d < nextMonth; d = addDays(d, 1)) days.push(d);

  const pick = (date: string) => {
    setOpen(false);
    navigate(date === today ? "/log" : `/log?date=${date}`);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMonth(monthStart(selected ?? today));
          setOpen(true);
        }}
        aria-haspopup="dialog"
        className="flex h-10 items-center gap-2 rounded-lg border border-court-700 px-3 text-sm text-court-100 hover:border-neon"
      >
        <span aria-hidden>📅</span> Pick a day
      </button>
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === dialog.current && setOpen(false)}
        aria-label="Pick a day"
        className="m-auto w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-court-700 bg-court-900 p-4 text-court-100 shadow-2xl backdrop:bg-black/60"
      >
        {open && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setMonth(shiftMonth(month, -1))}
                className="h-9 w-9 rounded-lg border border-court-700 hover:border-neon"
              >
                ‹
              </button>
              <p className="font-display text-lg uppercase tracking-wider">{monthLabel(month)}</p>
              <button
                type="button"
                aria-label="Next month"
                disabled={nextMonth > today}
                onClick={() => setMonth(nextMonth)}
                className="h-9 w-9 rounded-lg border border-court-700 hover:border-neon disabled:opacity-30"
              >
                ›
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase text-court-500">
              {WEEKDAYS.map((w, i) => (
                <span key={i}>{w}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: lead }, (_, i) => (
                <span key={`pad-${i}`} />
              ))}
              {days.map((d) => {
                const a = byDate.get(d);
                const future = d > today;
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={future}
                    onClick={() => pick(d)}
                    aria-label={`${d}${a?.recapped ? ", recapped" : a?.logged ? ", logged" : ""}`}
                    aria-current={d === today ? "date" : undefined}
                    className={`relative flex h-10 flex-col items-center justify-center rounded-lg text-sm tabular-nums transition disabled:opacity-25 ${d === selected ? "bg-neon text-court-950" : "hover:bg-court-800"} ${d === today && d !== selected ? "ring-1 ring-neon" : ""} ${firstLogged && d < firstLogged ? "text-court-500" : ""}`}
                  >
                    {Number(d.slice(8))}
                    {a?.logged && (
                      <span
                        aria-hidden
                        className={`mt-0.5 h-1 w-1 rounded-full ${a.recapped ? "bg-current" : "border border-current"} ${d === selected ? "" : "text-neon"}`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between border-t border-court-800 pt-3 text-sm">
              <span className="flex items-center gap-3 text-xs text-court-500">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full border border-neon" /> logged
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-neon" /> recapped
                </span>
              </span>
              <span className="flex gap-2">
                <button
                  type="button"
                  onClick={() => pick(today)}
                  className="rounded-lg border border-court-700 px-3 py-1.5 hover:border-neon"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-court-300 hover:text-neon"
                >
                  Close
                </button>
              </span>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
