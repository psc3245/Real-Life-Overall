import type { DayDto, HabitDto } from "@rlo/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { TodayPage } from "./TodayPage";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  api: vi.fn(),
}));
const mockedApi = vi.mocked(api);

const habit = (id: string, name: string, over: Partial<HabitDto> = {}): HabitDto => ({
  id,
  name,
  type: "checkbox",
  config: { target: null, unit: null, min: null, max: null },
  days: [0, 1, 2, 3, 4, 5, 6],
  links: [],
  sortOrder: 0,
  startsOn: "2026-10-01",
  ...over,
});

const day: DayDto = {
  date: "2026-10-22",
  today: "2026-10-22",
  editable: true,
  status: "open",
  journal: "Long day at work, shipped the migration.",
  prompts: [],
  recap: null,
  objectives: [],
  workouts: [],
  body: null,
  units: "imperial",
  habits: [
    { habit: habit("gym", "Gym"), scheduled: true, entry: { num: 1, text: null } },
    {
      habit: habit("water", "Water", {
        type: "counter",
        config: { target: 8, unit: "glasses", min: null, max: null },
      }),
      scheduled: true,
      entry: { num: 5, text: null },
    },
    { habit: habit("read", "Read"), scheduled: true, entry: null },
    {
      habit: habit("am", "Morning routine", {
        type: "group",
        config: { target: null, unit: null, min: null, max: null, rule: "all" },
      }),
      scheduled: true,
      entry: null,
      children: [
        { habit: habit("bed", "Make bed"), scheduled: true, entry: { num: 1, text: null } },
        { habit: habit("med", "Meditate"), scheduled: true, entry: null },
      ],
    },
  ],
};

describe("TodayPage", () => {
  beforeEach(() => {
    mockedApi.mockReset();
    mockedApi.mockImplementation(async (path: string) => {
      if (path === "/days/today") return day;
      if (path.startsWith("/days/")) return { ...day, date: "2026-10-21", recap: null };
      if (path === "/ratings") return { nodes: [], archetype: null, summary: null };
      return [];
    });
  });

  it("summarizes today's habits and journal and links into the log", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <TodayPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("meter", { name: "Habits done today" })).toHaveAttribute(
      "aria-valuenow",
      "1",
    );
    expect(screen.getByText("5/8 glasses")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument(); // group progress
    expect(screen.getByText(/Meditate/)).toBeInTheDocument();
    expect(screen.getByText("to do")).toBeInTheDocument();
    expect(screen.getByText(/shipped the migration/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log today →" })).toHaveAttribute("href", "/log");
    expect(screen.getByRole("link", { name: /Read/ })).toHaveAttribute("href", "/log#habit-read");
  });
});
