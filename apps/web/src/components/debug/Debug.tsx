import { useState, type ReactNode } from "react";
import { useDebug } from "./debugMode";

function copy(text: string) {
  void navigator.clipboard?.writeText(text).catch(() => undefined);
}

/** Collapsible raw data for admins. Renders nothing for everyone else. */
export function DebugJson({
  label,
  data,
  open = false,
  children,
}: {
  label: string;
  data?: unknown;
  open?: boolean;
  /** Extra admin-only content above the JSON. */
  children?: ReactNode;
}) {
  const debug = useDebug();
  if (!debug) return null;
  const json = data === undefined ? null : JSON.stringify(data, null, 2);
  return (
    <details
      open={open}
      className="rounded-lg border border-dashed border-tier-orange/50 bg-tier-orange/5 text-xs"
    >
      <summary className="cursor-pointer select-none px-3 py-1.5 font-mono uppercase tracking-wider text-tier-orange">
        debug · {label}
        {json && (
          <span className="ml-2 text-court-500 normal-case">
            {json.length.toLocaleString()} chars
          </span>
        )}
      </summary>
      <div className="space-y-2 border-t border-dashed border-tier-orange/30 p-3">
        {children}
        {json && (
          <div className="relative">
            <button
              type="button"
              onClick={() => copy(json)}
              className="absolute top-1 right-1 rounded bg-court-800 px-2 py-0.5 text-court-300 hover:text-neon"
            >
              Copy
            </button>
            <pre className="max-h-96 overflow-auto rounded bg-court-950 p-2 font-mono text-[11px] leading-snug text-court-300">
              {json}
            </pre>
          </div>
        )}
      </div>
    </details>
  );
}

/** A small id chip (click to copy) for admins. */
export function DebugId({ id, label }: { id: string; label?: string }) {
  const debug = useDebug();
  const [copied, setCopied] = useState(false);
  if (!debug) return null;
  return (
    <button
      type="button"
      title={`Copy ${id}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        copy(id);
        setCopied(true);
        setTimeout(() => setCopied(false), 1000);
      }}
      className="ml-2 inline-flex items-center rounded border border-dashed border-tier-orange/50 px-1.5 align-middle font-mono text-[10px] font-normal normal-case tracking-normal text-tier-orange hover:bg-tier-orange/10"
    >
      {copied
        ? "copied"
        : `${label ? `${label}:` : ""}${id.length > 12 ? `${id.slice(0, 8)}…` : id}`}
    </button>
  );
}

/** Admin-only key/value facts, for numbers worth seeing inline. */
export function DebugFacts({ facts }: { facts: Record<string, ReactNode> }) {
  const debug = useDebug();
  if (!debug) return null;
  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1 rounded border border-dashed border-tier-orange/40 px-2 py-1 font-mono text-[11px] text-tier-orange">
      {Object.entries(facts).map(([k, v]) => (
        <div key={k} className="flex gap-1">
          <dt className="text-court-500">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
