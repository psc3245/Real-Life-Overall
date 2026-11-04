import { useEffect, useState } from "react";

export interface Section {
  id: string;
  label: string;
}

/**
 * The section in view, by element id: the last one whose top has passed a line near the top of
 * the viewport, or the last section once the page is scrolled to the bottom (short last
 * sections never reach the line). `setActive` marks a jump right away.
 */
export function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  const key = ids.join(",");

  useEffect(() => {
    const list = key.split(",");
    const update = () => {
      const elements = list
        .map((id) => document.getElementById(id))
        .filter((el): el is HTMLElement => Boolean(el));
      if (!elements.length) return;
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom && window.scrollY > 0) {
        setActive(elements.at(-1)!.id);
        return;
      }
      let current = elements[0]!.id;
      for (const el of elements) if (el.getBoundingClientRect().top <= 120) current = el.id;
      setActive(current);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [key]);

  return [active, setActive] as const;
}

/**
 * Sticky jump links for long pages, highlighting the section in view, plus a back-to-top button
 * once you've scrolled. Sections need matching element ids (give them `scroll-mt-16`).
 */
export function SectionNav({ sections }: { sections: Section[] }) {
  const [active, setActive] = useActiveSection(sections.map((s) => s.id));
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
    setActive(id);
  };

  return (
    <>
      {/* No bar behind the chips; each chip blurs what scrolls under it so it stays readable. */}
      <nav aria-label="On this page" className="sticky top-0 z-20 -mx-4 py-2">
        <ul className="flex gap-2 overflow-x-auto px-4">
          {sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={active === s.id ? "location" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  jump(s.id);
                }}
                className={`block whitespace-nowrap rounded-full border px-3 py-1 text-sm backdrop-blur-md ${active === s.id ? "border-neon bg-neon/15 text-neon" : "border-court-700 bg-court-950/40 text-court-300 hover:border-court-500"}`}
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {scrolled && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
          className="fixed bottom-5 right-5 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-court-500 bg-court-900 text-lg text-court-100 shadow-lg hover:border-neon hover:text-neon"
        >
          ↑
        </button>
      )}
    </>
  );
}
