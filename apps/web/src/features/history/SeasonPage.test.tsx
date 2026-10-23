import type { SeasonDetailDto } from "@rlo/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { SeasonPage } from "./SeasonPage";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  api: vi.fn(),
}));

const detail: SeasonDetailDto = {
  id: "s1",
  label: "2026-Q3",
  startsOn: "2026-07-01",
  endsOn: "2026-09-30",
  current: false,
  through: "2026-09-30",
  archetype: "Steady Generalist",
  nodes: [
    { id: "r", parentId: null, name: "Overall", depth: 0, start: 52, end: 54.1 },
    { id: "f", parentId: "r", name: "Fitness", depth: 1, start: 47, end: 49.1 },
    { id: "c", parentId: "f", name: "Cardio", depth: 2, start: 50, end: 54 },
  ],
  history: { dates: [], series: [] },
  stats: {
    daysLogged: 61,
    daysRecapped: 58,
    bestLoggingStreak: 19,
    habitCompletions: 140,
    weeklyReviews: 12,
  },
  badges: [
    {
      key: "closer",
      kind: "catalog",
      name: "Closer · Silver",
      description: "Finish your days with a recap.",
      tier: "silver",
      earnedAt: "2026-08-01T00:00:00Z",
    },
  ],
  weeks: [{ id: "w1", weekStart: "2026-09-21", weekEnd: "2026-09-27", narrative: "Solid finish." }],
};

describe("SeasonPage", () => {
  it("shows a finished season's moves, stats, badges and weeks", async () => {
    vi.mocked(api).mockResolvedValue(detail);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/history/s1"]}>
          <Routes>
            <Route path="/history/:id" element={<SeasonPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("heading", { name: /2026-Q3/ })).toHaveTextContent("Final");
    expect(screen.getByText(/Started at 52.0/)).toBeInTheDocument();
    expect(screen.getByText("61")).toBeInTheDocument();
    expect(screen.getAllByText("Cardio").length).toBeGreaterThan(0); // attribute + biggest move
    expect(screen.getByText("Closer · Silver")).toBeInTheDocument();
    expect(screen.getByText("Solid finish.")).toBeInTheDocument();
    // Archived trees don't link to node pages (they belong to the current season).
    expect(screen.queryByRole("link", { name: "Cardio" })).not.toBeInTheDocument();
  });
});
