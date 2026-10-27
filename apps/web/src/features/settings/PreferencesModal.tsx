import { Link, useSearchParams } from "react-router";
import { Modal } from "../../components/Modal";
import { ConfigurationSection } from "./ConfigurationSection";
import { PersonalizationSection } from "./PersonalizationSection";
import { TodaySettings } from "./TodaySettings";

const TABS = [
  { id: "look", label: "Look" },
  { id: "today", label: "Today page" },
  { id: "configuration", label: "Features" },
] as const;
export type PreferencesTab = (typeof TABS)[number]["id"];

/** Opens the preferences modal on a tab from any page, keeping the current path. */
export const preferencesLink = (tab: PreferencesTab = "look") => ({ search: `?prefs=${tab}` });

/**
 * Personalization, the Today page and configuration in one modal, mounted once in the root
 * layout. `?prefs=<tab>` opens it, so any link (profile page, Today, switched-off pages) can.
 */
export function PreferencesModal() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("prefs");
  const tab = TABS.find((t) => t.id === raw)?.id ?? (raw === null ? null : "look");

  const close = () =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("prefs");
        return next;
      },
      { replace: true },
    );

  return (
    <Modal open={tab !== null} onClose={close} label="Personalize" size="xl">
      <div className="sticky -top-5 z-10 -mx-5 -mt-5 mb-5 border-b border-court-700 bg-court-900 px-5 pt-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl font-bold uppercase">Personalize</h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="text-2xl leading-none text-court-300 hover:text-neon"
          >
            ×
          </button>
        </div>
        <nav aria-label="Preference sections" className="mt-3 flex gap-5">
          {TABS.map((t) => (
            <Link
              key={t.id}
              to={preferencesLink(t.id)}
              replace
              aria-current={tab === t.id ? "page" : undefined}
              className={`-mb-px border-b-2 pb-2 font-display text-sm uppercase tracking-wider ${tab === t.id ? "border-neon text-neon" : "border-transparent text-court-300 hover:text-court-100"}`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
      {tab === "look" && <PersonalizationSection />}
      {tab === "today" && <TodaySettings />}
      {tab === "configuration" && <ConfigurationSection />}
    </Modal>
  );
}
