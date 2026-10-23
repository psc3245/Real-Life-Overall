import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import { DayPicker } from "./DayPicker";

vi.mock("../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/client")>()),
  api: vi.fn(),
}));
const mockedApi = vi.mocked(api);

function Where() {
  const loc = useLocation();
  return <p>at {loc.pathname + loc.search}</p>;
}

describe("DayPicker", () => {
  beforeEach(() => {
    mockedApi.mockReset();
    mockedApi.mockResolvedValue([
      { date: "2026-10-05", logged: true, recapped: true, summary: null, gain: 1, loss: 0 },
    ]);
  });

  it("marks logged days and opens the picked day's log", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/today"]}>
          <Routes>
            <Route path="/today" element={<DayPicker today="2026-10-22" />} />
            <Route path="/log" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Pick a day/ }));
    expect(await screen.findByRole("button", { name: "2026-10-05, recapped" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "2026-10-23" })).toBeDisabled(); // future
    expect(screen.getByRole("button", { name: "Next month" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "2026-10-05, recapped" }));
    expect(await screen.findByText("at /log?date=2026-10-05")).toBeInTheDocument();
  });
});
