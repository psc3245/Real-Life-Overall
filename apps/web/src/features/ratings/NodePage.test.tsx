import { habitStats, type HabitDto, type RatedNodeDto } from "@rlo/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { NodePage } from "./NodePage";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  api: vi.fn(),
}));
const mockedApi = vi.mocked(api);

const node = (over: Partial<RatedNodeDto>): RatedNodeDto => ({
  id: "x",
  parentId: null,
  name: "x",
  description: "",
  depth: 0,
  weight: 5,
  sortOrder: 0,
  templateKey: null,
  value: 60,
  rationale: null,
  confidence: null,
  decay: null,
  trend: null,
  goal: null,
  projection: null,
  ...over,
});
const nodes = [
  node({ id: "root", name: "Overall" }),
  node({ id: "fit", parentId: "root", depth: 1, name: "Fitness", value: 64.2 }),
  node({ id: "cardio", parentId: "fit", depth: 2, name: "Cardio", value: 70 }),
];
const run: HabitDto = {
  id: "run",
  name: "Morning run",
  type: "checkbox",
  config: { target: null, unit: null, min: null, max: null },
  days: [1, 3, 5],
  links: ["cardio"],
  sortOrder: 0,
  startsOn: "2026-10-01",
};
const period = { start: "2026-10-19", end: "2026-10-25" };

describe("NodePage", () => {
  beforeEach(() => {
    mockedApi.mockReset();
    mockedApi.mockImplementation(async (path: string) => {
      if (path === "/ratings") return { nodes, archetype: null, summary: null };
      if (path.startsWith("/ratings/history")) return { dates: [], series: [] };
      if (path.startsWith("/ratings/changes")) {
        return [
          {
            id: "e1",
            nodeId: "cardio",
            nodeName: "Cardio",
            delta: 0.4,
            reason: "Ran 5k.",
            source: "daily_recap",
            date: "2026-10-21",
            createdAt: "2026-10-22T00:00:00Z",
          },
        ];
      }
      if (path.startsWith("/habits/stats")) {
        return {
          range: "week",
          ...period,
          today: "2026-10-21",
          habits: [habitStats(run, new Map(), period, "2026-10-21")],
        };
      }
      return null;
    });
  });

  it("shows a category's attributes, the habits below it and its changes", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/ratings/node/fit"]}>
          <Routes>
            <Route path="/ratings/node/:id" element={<NodePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("heading", { name: "Fitness" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Cardio/ })).toHaveAttribute(
      "href",
      "/ratings/node/cardio",
    );
    expect(await screen.findByText("Morning run")).toBeInTheDocument(); // linked to Cardio
    expect(await screen.findByText("Ran 5k.")).toBeInTheDocument();
    expect(mockedApi).toHaveBeenCalledWith("/ratings/changes?limit=50&offset=0&nodeId=fit");
  });
});
