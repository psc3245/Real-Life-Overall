import type { ProfileDto } from "@rlo/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "../../api/client";
import { ProfilePage } from "./ProfilePage";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  api: vi.fn(),
}));
const mockedApi = vi.mocked(api);

const profile: ProfileDto = {
  username: "jordan",
  displayName: "Jordan Reyes",
  memberSince: "2026-10-01T00:00:00Z",
  isSelf: false,
  friendship: "none",
  visibility: null,
  card: {
    mode: "rating",
    overall: 71.4,
    archetype: "Ambitious Builder",
    seasonLabel: "2026-Q4",
    categories: [
      { name: "Career", templateKey: "career", value: 80.2 },
      { name: "Fitness", templateKey: "fitness", value: 62.5 },
    ],
    growth: { overall: 0, categories: [] },
    recappedDays: 12,
    updatedAt: "2026-10-22T00:00:00Z",
  },
  badges: [{ key: "closer", name: "Closer", tier: "silver" }],
};

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/u/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ProfilePage", () => {
  beforeEach(() => {
    mockedApi.mockReset();
  });

  it("shows the shared card and badges", async () => {
    mockedApi.mockResolvedValue(profile);
    renderAt("/u/jordan");
    expect(await screen.findByText("Ambitious Builder · 2026-Q4")).toBeInTheDocument();
    expect(screen.getByText("12 recapped days this season")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Career" })).toBeInTheDocument();
    expect(screen.getByText("Closer")).toBeInTheDocument();
    expect(mockedApi).toHaveBeenCalledWith("/profiles/jordan");
    expect(screen.getByRole("button", { name: "Add friend" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Compare" })).toHaveAttribute(
      "href",
      "/compare/jordan",
    );
    // Visitors don't get the owner's sharing banner.
    expect(screen.queryByText(/how other players see your card/)).not.toBeInTheDocument();
  });

  it("treats hidden and missing profiles the same way", async () => {
    mockedApi.mockImplementation(async () => {
      throw new ApiError(404, "Profile not found", null);
    });
    renderAt("/u/someone");
    expect(await screen.findByText("Profile not available")).toBeInTheDocument();
  });
});
