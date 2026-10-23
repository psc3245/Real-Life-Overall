import { habitStats, type HabitDto, type HabitStatsResponseDto } from "@rlo/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { HabitsGlancePage } from "./HabitsGlancePage";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  api: vi.fn(),
}));
const mockedApi = vi.mocked(api);

const water: HabitDto = {
  id: "water",
  name: "Water",
  type: "counter",
  config: { target: 8, unit: "glasses", min: null, max: null },
  days: [0, 1, 2, 3, 4, 5, 6],
  links: [],
  sortOrder: 0,
  startsOn: "2026-10-01",
};
const period = { start: "2026-10-19", end: "2026-10-25" };
const stats: HabitStatsResponseDto = {
  range: "week",
  ...period,
  today: "2026-10-21",
  habits: [
    habitStats(
      water,
      new Map([
        ["2026-10-19", { num: 8, text: null }],
        ["2026-10-20", { num: 4, text: null }],
      ]),
      period,
      "2026-10-21",
    ),
  ],
};

describe("HabitsGlancePage", () => {
  beforeEach(() => {
    mockedApi.mockReset();
    mockedApi.mockImplementation(async (path: string) =>
      path.startsWith("/habits") ? stats : null,
    );
  });

  it("shows completion, averages and recent entries, and switches periods", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/habits"]}>
          <HabitsGlancePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText("1/2 done")).toBeInTheDocument();
    expect(screen.getByText("6 / 8")).toBeInTheDocument(); // average vs target
    expect(screen.getAllByText("50%").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Recent entries/ }));
    expect(screen.getByText("4/8 glasses")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Month" }));
    expect(mockedApi).toHaveBeenLastCalledWith("/habits/stats?range=month");
  });
});
