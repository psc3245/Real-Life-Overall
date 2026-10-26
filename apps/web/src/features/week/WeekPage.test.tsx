import type { WeeklyReviewDto, WeeklyStateDto } from "@rlo/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { WeekPage } from "./WeekPage";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  api: vi.fn(),
}));
const mockedApi = vi.mocked(api);

const review: WeeklyReviewDto = {
  id: "w1",
  weekStart: "2026-10-12",
  weekEnd: "2026-10-18",
  narrative: "A steady week.",
  mode: "rating",
  overallStart: 60,
  overallEnd: 61.2,
  corrections: [
    {
      nodeId: "c",
      nodeName: "Career",
      delta: 1,
      growth: 1.0,
      reason: "Shipped all week.",
      evidence: null,
      valueAfter: 81,
    },
  ],
  decayRevisions: [
    {
      nodeId: "x",
      nodeName: "Cardio",
      graceDays: 2,
      perDay: 0.4,
      floor: 50,
      reason: "Fades fast.",
    },
  ],
  focusGoals: [{ title: "Run twice", detail: "Two 30-minute runs.", nodeIds: ["x"] }],
  habitProposals: [
    {
      index: 0,
      name: "Evening walk",
      type: "duration",
      days: [1, 3, 5],
      target: 20,
      unit: null,
      nodeIds: ["x"],
      reason: "Builds a cardio base.",
      status: "pending",
    },
  ],
  archetypeChange: { from: "Desk Athlete", to: "Two-Way Grinder", description: "More balanced." },
  badges: [],
  weightShifts: [
    {
      id: "s1",
      nodeId: "c",
      nodeName: "Career",
      fromShare: 50,
      toShare: 54.2,
      reason: "Career fills every journal.",
      recapId: "w1",
      createdAt: "2026-10-19T09:00:00Z",
      revertedAt: null,
    },
  ],
  treeProposal: {
    id: "p1",
    reason: "Family is a core priority the tree doesn't measure.",
    changes: [
      {
        kind: "add_category",
        name: "Family",
        description: "",
        attributes: [{ name: "Presence", description: "" }],
      },
      { kind: "remove", nodeId: "s", nodeName: "Strength" },
    ],
    status: "pending",
    recapId: "w1",
    createdAt: "2026-10-19T09:00:00Z",
    resolvedAt: null,
  },
  createdAt: "2026-10-19T09:00:00Z",
};

function setup(state: WeeklyStateDto) {
  mockedApi.mockImplementation(async (path: string) => {
    if (path === "/weekly") return state;
    if (path === "/ratings") return { nodes: [{ id: "x", name: "Cardio" }] };
    if (path === "/me") return { weekStart: 1 };
    return new Promise(() => {});
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <WeekPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const week = { start: "2026-10-12", end: "2026-10-18" };

describe("WeekPage", () => {
  beforeEach(() => {
    mockedApi.mockReset();
  });

  it("runs the review when the week is ready", async () => {
    setup({ week, review: null, ready: true, history: [] });
    fireEvent.click(await screen.findByRole("button", { name: "Run weekly review" }));
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith("/weekly/run", { method: "POST" }));
  });

  it("shows the review and resolves habit proposals", async () => {
    setup({ week, review, ready: false, history: [] });
    expect(await screen.findByText("A steady week.")).toBeInTheDocument();
    expect(screen.getByText("Run twice")).toBeInTheDocument();
    expect(screen.getByText("Two-Way Grinder")).toBeInTheDocument();
    expect(screen.getByText(/fades 0.4\/day after 2 idle days/)).toBeInTheDocument();
    expect(
      screen.getByText(/Time spent · Mon, Wed, Fri · goal 20 min · Cardio/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add habit" }));
    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith("/weekly/w1/proposals/0/accept", { method: "POST" }),
    );
  });

  it("shows weight shifts and a tree proposal, each actionable", async () => {
    setup({ week, review, ready: false, history: [] });
    expect(await screen.findByText("Career fills every journal.")).toBeInTheDocument();
    expect(screen.getByText("54.2%")).toBeInTheDocument();
    expect(screen.getByText(/Family is a core priority/)).toBeInTheDocument();
    expect(screen.getByText("Presence")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith("/weights/changes/s1/undo", { method: "POST" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply change" }));
    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith("/tree-proposals/p1/accept", { method: "POST" }),
    );
  });

  it("explains when no week has finished yet", async () => {
    setup({ week: null, review: null, ready: false, history: [] });
    expect(
      await screen.findByText(/first weekly review arrives after your first full week/),
    ).toBeInTheDocument();
  });
});
