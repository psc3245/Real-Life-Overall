import type { GamePlanDto, RatedNodeDto } from "@rlo/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { GamePlans } from "./GamePlans";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  api: vi.fn(),
}));
const mockedApi = vi.mocked(api);

const plan: GamePlanDto = {
  id: "p1",
  name: "Build strength",
  note: "Lifting first.",
  startsOn: "2026-11-01",
  endsOn: "2026-12-31",
  links: [],
  status: "active",
};

function renderPlans(plans: GamePlanDto[]) {
  mockedApi.mockImplementation(async (path, init) =>
    init?.method === "POST" ? { ...plan, id: "p2", name: "Sleep reset" } : plans,
  );
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <GamePlans nodes={[] as RatedNodeDto[]} today="2026-11-25" seasonEndsOn="2026-11-30" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("GamePlans", () => {
  beforeEach(() => mockedApi.mockReset());

  it("lists running Game Plans with their note", async () => {
    renderPlans([plan, { ...plan, id: "old", name: "Old focus", status: "ended" }]);
    expect(await screen.findByText("Build strength")).toBeInTheDocument();
    expect(screen.getByText("Lifting first.")).toBeInTheDocument();
    expect(screen.queryByText("Old focus")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Ended \(1\)/ }));
    expect(screen.getByText("Old focus")).toBeInTheDocument();
  });

  it("adds one through the end of the month by default", async () => {
    renderPlans([]);
    fireEvent.click(await screen.findByRole("button", { name: /\+ New/ }));
    fireEvent.change(screen.getByPlaceholderText("e.g. Build strength"), {
      target: { value: "Sleep reset" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Add / }));
    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith(
        "/game-plans",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const sent = JSON.parse(
      mockedApi.mock.calls.find(([, init]) => init?.method === "POST")![1]!.body as string,
    );
    expect(sent).toEqual({
      name: "Sleep reset",
      note: "",
      startsOn: "2026-11-25",
      endsOn: "2026-11-30",
      links: [],
    });
  });
});
