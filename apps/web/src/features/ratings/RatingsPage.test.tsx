import type { RatedNodeDto, RatingsDto } from "@rlo/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "../../api/client";
import { RatingsPage } from "./RatingsPage";

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
  value: null,
  rationale: null,
  confidence: null,
  decay: null,
  trend: null,
  goal: null,
  projection: null,
  ...over,
});

const ratings: RatingsDto = {
  season: {
    id: "s",
    label: "2026-Q4",
    startsOn: "2026-10-01",
    endsOn: "2026-12-31",
    status: "active",
  },
  projectedThrough: null,
  archetype: { name: "Desk Athlete", description: "Strong at work." },
  summary: "Career leads.",
  nodes: [
    node({ id: "root", name: "Overall", value: 65 }),
    node({ id: "fit", parentId: "root", depth: 1, name: "Fitness", value: 60 }),
    node({
      id: "cardio",
      parentId: "fit",
      depth: 2,
      name: "Cardio",
      value: 70,
      rationale: "You run three times a week.",
      confidence: "high",
      decay: { graceDays: 3, perDay: 0.3, floor: 50, notes: "" },
    }),
  ],
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <RatingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("RatingsPage", () => {
  beforeEach(() => {
    mockedApi.mockReset();
  });

  it("shows the card and expands an attribute's rationale", async () => {
    mockedApi.mockImplementation(async (path: string) => {
      if (path === "/ratings") return ratings;
      if (path.startsWith("/ratings/changes")) {
        return [
          {
            id: "e1",
            nodeId: "cardio",
            nodeName: "Cardio",
            delta: 0.6,
            reason: "You ran 6k.",
            source: "daily_recap",
            date: "2026-10-20",
            createdAt: "2026-10-20T22:00:00Z",
          },
        ];
      }
      if (path === "/pauses") return [];
      if (path.startsWith("/ratings/history")) return { dates: [], series: [] };
      if (path.startsWith("/ratings/activity")) return [];
      if (path === "/badges") {
        return {
          progress: [
            {
              key: "closer",
              name: "Closer",
              description: "Finish your days with a recap.",
              unit: "days recapped",
              value: 7,
              tier: "bronze",
              next: 20,
            },
          ],
          personal: [],
          recent: [],
        };
      }
      if (path === "/days/today") return { today: "2026-10-20" };
      return { displayName: "Peter" };
    });
    renderPage();
    expect(await screen.findByText("Peter")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Pause decay" })).toBeInTheDocument();
    expect(screen.getAllByText(/Desk Athlete/).length).toBeGreaterThan(0);
    expect(screen.queryByText("You run three times a week.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Cardio/ }));
    expect(screen.getByText("You run three times a week.")).toBeInTheDocument();
    expect(screen.getByText("High confidence")).toBeInTheDocument();
    expect(screen.getByText(/Fades 0.3\/day after 3 idle days · floor 50/)).toBeInTheDocument();
    expect(await screen.findByText("You ran 6k.")).toBeInTheDocument();
    expect(await screen.findByText("7 / 20 days recapped")).toBeInTheDocument();
    expect(screen.getByText("+0.6")).toBeInTheDocument();
  });

  it("points to onboarding when there are no ratings", async () => {
    mockedApi.mockImplementation(async (path: string) => {
      if (path === "/ratings") throw new ApiError(404, "No ratings yet", null);
      if (path.startsWith("/ratings/changes")) return [];
      return { displayName: "Peter" };
    });
    renderPage();
    expect(await screen.findByText("No rating yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Build your rating/ })).toHaveAttribute(
      "href",
      "/onboarding",
    );
  });
});

describe("GoalEditor", () => {
  it("sets a goal on an attribute", async () => {
    const { GoalEditor } = await import("./GoalEditor");
    mockedApi.mockResolvedValue(null);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <GoalEditor node={node({ id: "cardio", name: "Cardio", projection: 72.5 })} />
      </QueryClientProvider>,
    );
    expect(screen.getByText("Projected 72.5 by season end")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "+ Set goal" }));
    fireEvent.change(screen.getByLabelText("Goal for Cardio"), { target: { value: "80" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith("/goals/cardio", {
        method: "PUT",
        body: JSON.stringify({ target: 80 }),
      }),
    );
  });
});
