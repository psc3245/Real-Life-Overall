import type { PauseDto } from "@rlo/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { DecayCard } from "./DecayCard";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  api: vi.fn(),
}));
const mockedApi = vi.mocked(api);

function setup(pauses: PauseDto[]) {
  mockedApi.mockImplementation(async (path: string) => {
    if (path === "/days/today") return { today: "2026-10-20" };
    if (path === "/pauses") return pauses;
    return {};
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DecayCard />
    </QueryClientProvider>,
  );
}

describe("DecayCard", () => {
  beforeEach(() => {
    mockedApi.mockReset();
  });

  it("starts a pause from today by default", async () => {
    setup([]);
    fireEvent.change(await screen.findByLabelText("Pause reason"), {
      target: { value: "Vacation" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Pause decay" }));
    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith("/pauses", {
        method: "POST",
        body: JSON.stringify({ startsOn: "2026-10-20", endsOn: null, reason: "Vacation" }),
      }),
    );
  });

  it("ends an active pause as of yesterday", async () => {
    setup([{ id: "p1", startsOn: "2026-10-15", endsOn: null, reason: "Flu" }]);
    expect(await screen.findByText(/Decay paused/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "End pause" }));
    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith("/pauses/p1/end", {
        method: "POST",
        body: JSON.stringify({ endsOn: "2026-10-19" }),
      }),
    );
  });

  it("cancels an upcoming pause", async () => {
    setup([{ id: "p2", startsOn: "2026-10-25", endsOn: "2026-10-30", reason: "" }]);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith("/pauses/p2/end", {
        method: "POST",
        body: JSON.stringify({ endsOn: "2026-10-24" }),
      }),
    );
  });
});
