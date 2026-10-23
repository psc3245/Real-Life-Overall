import type { LeaderboardDto } from "@rlo/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { LeaderboardsPage } from "./LeaderboardsPage";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  api: vi.fn(),
}));
const mockedApi = vi.mocked(api);

const entry = (username: string, rank: number, value: number, extra = {}) => ({
  rank,
  username,
  displayName: username.toUpperCase(),
  archetype: null,
  value,
  recappedDays: 10,
  provisional: false,
  isMe: false,
  ...extra,
});

const status = {
  optedIn: false,
  visibility: "friends" as const,
  hasCard: true,
  reasons: ["few-recaps" as const],
  recappedDays: 3,
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/leaderboards"]}>
        <LeaderboardsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("LeaderboardsPage", () => {
  beforeEach(() => {
    mockedApi.mockReset();
    mockedApi.mockImplementation(async (path: string) => {
      const global = path.includes("scope=global");
      const data: LeaderboardDto = {
        scope: global ? "global" : "friends",
        board: "overall",
        seasonLabel: "2026-Q4",
        entries: global
          ? [entry("devon", 1, 71)]
          : [entry("maya", 1, 69.3, { provisional: true }), entry("me", 2, 57.5, { isMe: true })],
        me: global ? null : entry("me", 2, 57.5, { isMe: true }),
        globalStatus: status,
      };
      return data;
    });
  });

  it("ranks friends and marks provisional players and you", async () => {
    renderPage();
    const rows = within(await screen.findByRole("list", { name: "Rankings" })).getAllByRole(
      "listitem",
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("MAYA");
    expect(rows[0]).toHaveTextContent("Provisional");
    expect(rows[1]).toHaveTextContent("You");
    expect(mockedApi).toHaveBeenCalledWith("/leaderboards?scope=friends&board=overall");
  });

  it("explains what keeps you off the global board", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("tab", { name: "Global" }));
    expect(await screen.findByText("You're not on this board")).toBeInTheDocument();
    expect(screen.getByText("Make your profile public.")).toBeInTheDocument();
    expect(
      screen.getByText(/Recap at least 7 days this season \(you have 3\)/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fitness" }));
    expect(mockedApi).toHaveBeenLastCalledWith("/leaderboards?scope=global&board=fitness");
  });
});
