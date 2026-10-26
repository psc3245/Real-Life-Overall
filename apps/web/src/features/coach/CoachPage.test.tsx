import type { CoachStateDto } from "@rlo/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { CoachPage } from "./CoachPage";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  api: vi.fn(),
}));
const mockedApi = vi.mocked(api);

const chat: CoachStateDto = {
  remaining: 3,
  messages: [
    {
      id: "u1",
      role: "user",
      content: "What should I work on?",
      suggestions: [],
      createdAt: "2026-10-26T10:00:00Z",
    },
    {
      id: "a1",
      role: "assistant",
      content: "Cardio is your biggest gap.",
      suggestions: [
        {
          kind: "habit",
          index: 0,
          name: "Short run",
          habitType: "duration",
          days: [2, 4],
          target: 20,
          unit: null,
          nodeIds: ["x"],
          reason: "Builds a base.",
          status: "pending",
        },
        {
          kind: "report",
          index: 1,
          section: "priority",
          text: "Endurance",
          importance: 4,
          nodeId: "x",
          reason: "You keep mentioning it.",
          status: "accepted",
        },
      ],
      createdAt: "2026-10-26T10:00:01Z",
    },
  ],
};

function setup(state: CoachStateDto, url = "/coach") {
  mockedApi.mockImplementation(async (path: string) => {
    if (path === "/coach") return state;
    if (path === "/ratings") return { nodes: [{ id: "x", name: "Cardio" }] };
    if (path === "/coach/messages") return state;
    return new Promise(() => {});
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/coach" element={<CoachPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CoachPage", () => {
  beforeEach(() => {
    mockedApi.mockReset();
  });

  it("shows the conversation with actionable suggestions", async () => {
    setup(chat);
    expect(await screen.findByText("Cardio is your biggest gap.")).toBeInTheDocument();
    expect(screen.getByText("Short run")).toBeInTheDocument();
    expect(
      await screen.findByText(/Time spent · Tue, Thu · goal 20 min · Cardio/),
    ).toBeInTheDocument();
    expect(screen.getByText("✓ Added")).toBeInTheDocument();
    expect(screen.getByText(/3 messages left/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add habit" }));
    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith("/coach/messages/a1/suggestions/0/accept", {
        method: "POST",
      }),
    );
  });

  it("sends a starter question from an empty chat", async () => {
    setup({ messages: [], remaining: 30 });
    fireEvent.click(await screen.findByRole("button", { name: "How am I doing overall?" }));
    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith("/coach/messages", {
        method: "POST",
        body: JSON.stringify({ content: "How am I doing overall?" }),
      }),
    );
  });

  it("sends a question passed from Today once", async () => {
    setup({ messages: [], remaining: 30 }, "/coach?ask=Plan%20my%20week");
    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith("/coach/messages", {
        method: "POST",
        body: JSON.stringify({ content: "Plan my week" }),
      }),
    );
    expect(mockedApi.mock.calls.filter(([p]) => p === "/coach/messages")).toHaveLength(1);
  });
});
