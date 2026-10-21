import { Link } from "react-router";
import { useFocus } from "../../api/weekly";

/** This week's focus goals from the latest weekly review. */
export function FocusCard() {
  const focus = useFocus();
  if (!focus.data?.length) return null;
  return (
    <section className="rounded-xl border border-neon/30 bg-neon/5 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg uppercase tracking-wider text-neon">
          This week's focus
        </h2>
        <Link to="/week" className="text-sm text-court-300 hover:text-neon">
          Weekly review →
        </Link>
      </div>
      <ul className="mt-2 space-y-1 text-sm">
        {focus.data.map((g) => (
          <li key={g.title}>
            <span className="font-medium">{g.title}</span>{" "}
            <span className="text-court-300">{g.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
