import type { CoachStateDto } from "@rlo/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { CoachPage } from "./CoachPage";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  api: vi.fn(),
}));
const mockedApi = vi.mocked(api);

const thread = {
  id: "t1",
  title: "What should I work on?",
  createdAt: "2026-10-26T10:00:00Z",
  updatedAt: "2026-10-26T10:00:01Z",
};

const chat: CoachStateDto = {
  thread,
  remaining: 3,
  messages: [
    {
      id: "u1",
      role: "user",
      content: "What should I work on?",
      suggestions: [],
      actions: [],
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
      actions: [],
      createdAt: "2026-10-26T10:00:01Z",
    },
  ],
};

function setup(state: CoachStateDto, url = "/coach") {
  mockedApi.mockImplementation(async (path: string) => {
    if (path === "/coach" || path.startsWith("/coach?thread=")) return state;
    if (path === "/coach/threads") return state.thread ? [state.thread] : [];
    if (path === "/ratings") return { nodes: [{ id: "x", name: "Cardio" }] };
    if (path === "/days/today") return { today: "2026-11-12" };
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
    expect(await screen.findByText("Time spent · Tue, Thu · goal 20 min")).toBeInTheDocument();
    expect(await screen.findByText("Builds Cardio")).toBeInTheDocument();
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
    setup({ thread: null, messages: [], remaining: 30 });
    fireEvent.click(await screen.findByRole("button", { name: "How am I doing overall?" }));
    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith("/coach/messages", {
        method: "POST",
        body: JSON.stringify({ content: "How am I doing overall?", threadId: null }),
      }),
    );
  });

  it("sends a question passed from Today once", async () => {
    setup({ thread: null, messages: [], remaining: 30 }, "/coach?ask=Plan%20my%20week");
    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith("/coach/messages", {
        method: "POST",
        body: JSON.stringify({ content: "Plan my week", threadId: null }),
      }),
    );
    expect(mockedApi.mock.calls.filter(([p]) => p === "/coach/messages")).toHaveLength(1);
  });

  it("shows what the coach logged, with undo", async () => {
    const logged: CoachStateDto = {
      thread,
      remaining: 30,
      messages: [
        {
          id: "a2",
          role: "assistant",
          content: "Logged your leg day.",
          suggestions: [],
          actions: [
            {
              index: 0,
              kind: "workout",
              workoutId: "w1",
              date: "2026-11-12",
              title: "Leg Day",
              detail: "Squat (Barbell): 3 × 225 lb × 5",
              undone: false,
            },
            {
              index: 1,
              kind: "habit",
              habitId: "h1",
              previous: null,
              date: "2026-11-12",
              title: "Stretch",
              detail: "Done",
              undone: true,
            },
          ],
          createdAt: "2026-11-12T20:00:00Z",
        },
      ],
    };
    setup(logged);
    expect(await screen.findByRole("link", { name: "Leg Day" })).toHaveAttribute(
      "href",
      "/workouts/w1",
    );
    expect(screen.getByText("Squat (Barbell): 3 × 225 lb × 5")).toBeInTheDocument();
    expect(screen.getByText(/✓ Workout logged/)).toBeInTheDocument();
    expect(screen.getByText(/Undone/)).toBeInTheDocument();
    // Only the live receipt can be undone.
    const undo = screen.getAllByRole("button", { name: "Undo" });
    expect(undo).toHaveLength(1);
    fireEvent.click(undo[0]!);
    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith("/coach/messages/a2/actions/0/undo", {
        method: "POST",
      }),
    );
  });

  it("lists conversations, continues the open one, and starts new chats", async () => {
    setup(chat);
    const list = await screen.findByRole("navigation", { name: "Conversations" });
    expect(
      await within(list).findByRole("button", { name: /What should I work on\?/ }),
    ).toHaveAttribute("aria-current", "page");
    fireEvent.change(screen.getByRole("textbox", { name: "Message the coach" }), {
      target: { value: "And next week?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith("/coach/messages", {
        method: "POST",
        body: JSON.stringify({ content: "And next week?", threadId: "t1" }),
      }),
    );

    fireEvent.click(within(list).getByRole("button", { name: "+ New chat" }));
    expect(await screen.findByText("What are we working on?")).toBeInTheDocument();
    expect(screen.queryByText("Cardio is your biggest gap.")).not.toBeInTheDocument();
  });

  it("opens a draft to tweak it, and saves the player's version", async () => {
    setup(chat);
    fireEvent.click(await screen.findByRole("button", { name: "Review and tweak" }));
    const dialog = await screen.findByRole("dialog", { name: "Review habit" });
    const name = within(dialog).getByDisplayValue("Short run");
    fireEvent.change(name, { target: { value: "Easy run" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add habit" }));
    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith("/coach/messages/a1/suggestions/0/accept", {
        method: "POST",
        body: expect.stringContaining('"name":"Easy run"'),
      }),
    );
    const call = mockedApi.mock.calls.find(
      ([p]) => p === "/coach/messages/a1/suggestions/0/accept",
    )!;
    const { edits } = JSON.parse((call[1] as { body: string }).body) as {
      edits: { type: string; days: number[]; links: string[] };
    };
    expect(edits).toMatchObject({ type: "duration", days: [2, 4], links: ["x"] });
  });
});
