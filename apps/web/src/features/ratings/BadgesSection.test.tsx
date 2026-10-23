import type { BadgesDto } from "@rlo/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { BadgesSection } from "./BadgesSection";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  api: vi.fn(),
}));

const badges: BadgesDto = {
  progress: [
    {
      key: "logged-in",
      name: "Logged In",
      description: "Log something several days in a row.",
      unit: "day streak",
      value: 20,
      tier: "silver",
      next: 30,
      hint: "Log anything every day.",
      thresholds: [3, 7, 30, 90],
      earned: [
        { tier: "bronze", earnedAt: "2026-10-03T12:00:00Z" },
        { tier: "silver", earnedAt: "2026-10-07T12:00:00Z" },
      ],
    },
  ],
  personal: [],
  recent: [],
};

describe("BadgesSection", () => {
  it("opens a badge's tier ladder with what's left to the next tier", async () => {
    vi.mocked(api).mockResolvedValue(badges);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <BadgesSection />
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: /Logged In/ }));
    const dialog = screen.getByRole("dialog", { name: "Logged In" });
    const tiers = within(dialog).getAllByRole("listitem");
    expect(tiers[0]).toHaveTextContent(/Earned Oct 3/);
    expect(tiers[2]).toHaveTextContent("10 to go");
    expect(tiers[3]).toHaveTextContent("Locked");
    expect(dialog).toHaveTextContent("Log anything every day.");
  });
});
