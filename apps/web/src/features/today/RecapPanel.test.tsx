import type { DayDto, RecapDto } from "@rlo/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { RecapPanel } from "./RecapPanel";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  api: vi.fn(),
}));
const mockedApi = vi.mocked(api);

const recap: RecapDto = {
  id: "r",
  date: "2026-10-20",
  narrative: "A solid day.",
  flags: ["The 40 km claim seems high."],
  changes: [
    {
      nodeId: "c",
      nodeName: "Cardio",
      delta: 0.6,
      reason: "You ran.",
      evidence: null,
      valueAfter: 70.6,
    },
    {
      nodeId: "s",
      nodeName: "Strength",
      delta: -0.2,
      reason: "Skipped lifting.",
      evidence: null,
      valueAfter: 49.8,
    },
  ],
  overallBefore: 70,
  overallAfter: 70.1,
  badges: [
    {
      key: "logged-in",
      kind: "catalog",
      name: "Logged In · Bronze",
      description: "Log something several days in a row.",
      tier: "bronze",
      earnedAt: "2026-10-20T22:00:00Z",
    },
  ],
  createdAt: "2026-10-20T22:00:00Z",
};

const day = (over: Partial<DayDto>): DayDto => ({
  date: "2026-10-20",
  today: "2026-10-20",
  editable: true,
  status: "open",
  journal: "",
  habits: [],
  objectives: [],
  prompts: [],
  recap: null,
  ...over,
});

function renderPanel(d: DayDto) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <RecapPanel day={d} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("RecapPanel", () => {
  beforeEach(() => {
    mockedApi.mockReset();
  });

  it("disables End my day until something is logged", () => {
    renderPanel(day({}));
    expect(screen.getByRole("button", { name: "End my day" })).toBeDisabled();
    expect(screen.getByText("Log something first.")).toBeInTheDocument();
  });

  it("ends the day when there is content", async () => {
    mockedApi.mockReturnValue(new Promise(() => {}));
    renderPanel(day({ journal: "Ran." }));
    fireEvent.click(screen.getByRole("button", { name: "End my day" }));
    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith("/days/2026-10-20/recap", { method: "POST" }),
    );
    expect(await screen.findByRole("button", { name: /Reading your day/ })).toBeDisabled();
  });

  it("shows the recap with itemized changes and scout notes", () => {
    renderPanel(day({ journal: "Ran.", status: "recapped", recap }));
    expect(screen.getByText("A solid day.")).toBeInTheDocument();
    expect(screen.getByText("You ran.")).toBeInTheDocument();
    expect(screen.getByText("−0.2")).toBeInTheDocument();
    expect(screen.getByText("The 40 km claim seems high.")).toBeInTheDocument();
    expect(screen.getByText("Logged In · Bronze")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update recap" })).not.toBeInTheDocument();
  });

  it("offers an update when the day changed after its recap", () => {
    renderPanel(day({ journal: "Ran. Also lifted.", status: "stale", recap }));
    expect(screen.getByRole("button", { name: "Update recap" })).toBeEnabled();
  });
});
