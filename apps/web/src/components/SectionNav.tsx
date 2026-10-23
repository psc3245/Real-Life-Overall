import { useEffect, useState } from "react";

export interface Section {
  id: string;
  label: string;
}

/**
 * Sticky jump links for long pages, highlighting the section in view, plus a back-to-top button
 * once you've scrolled. Sections need matching element ids (give them `scroll-mt-16`).
 */
export function SectionNav({ sections }: { sections: Section[] }) {
  const [active, setActive] = useState(sections[0]?.id);
  const [scrolled, setScrolled] = useState(false);
  const ids = sections.map((s) => s.id).join(",");

  useEffect(() => {
    const elements = ids
      .split(",")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!elements.length || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // A band near the top of the viewport decides which section is "current".
      { rootMargin: "-64px 0px -60% 0px" },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids]);

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
      <nav
        aria-label="On this page"
        className="sticky top-0 z-20 -mx-4 overflow-x-auto border-b border-court-800 bg-court-950/90 px-4 py-2 backdrop-blur"
      >
        <ul className="flex gap-2">
          {sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={active === s.id ? "location" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  jump(s.id);
                }}
                className={`block whitespace-nowrap rounded-full border px-3 py-1 text-sm ${active === s.id ? "border-neon bg-neon/10 text-neon" : "border-court-700 text-court-300 hover:border-court-500"}`}
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
