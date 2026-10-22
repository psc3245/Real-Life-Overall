import type { OnboardingStateDto } from "@rlo/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { DiscoveryChat } from "./DiscoveryChat";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  api: vi.fn(),
}));
const mockedApi = vi.mocked(api);

const withMessages = (answers: number, done = false) =>
  ({
    stage: "discovery",
    discovery: {
      done,
      messages: [
        { role: "assistant", content: "What matters most?" },
        ...Array.from({ length: answers }, (_, i) => [
          { role: "user" as const, content: `Answer ${i}` },
          { role: "assistant" as const, content: `Question ${i}?` },
        ]).flat(),
      ],
    },
  }) as unknown as OnboardingStateDto;

function renderChat(state: OnboardingStateDto) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DiscoveryChat state={state} />
    </QueryClientProvider>,
  );
}

describe("DiscoveryChat", () => {
  beforeEach(() => {
    mockedApi.mockReset();
    mockedApi.mockReturnValue(new Promise(() => {}));
  });

  it("needs two answers before drafting a template", () => {
    renderChat(withMessages(1));
    expect(screen.getByRole("button", { name: "Build my template" })).toBeDisabled();
    expect(screen.getByText("Answer 1 more to draft your tree.")).toBeInTheDocument();
  });

  it("sends replies, drafts the template and offers a manual path", async () => {
    renderChat(withMessages(2));
    const input = screen.getByRole("textbox", { name: "Your reply" });
    fireEvent.change(input, { target: { value: "Running and my career" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(input).toHaveValue("");
    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith("/onboarding/discovery", {
        method: "POST",
        body: JSON.stringify({ message: "Running and my career" }),
      }),
    );
  });

  it("hides the input once the scout is done and drafts on click", async () => {
    renderChat(withMessages(3, true));
    expect(screen.queryByRole("textbox", { name: "Your reply" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Build my template" }));
    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith("/onboarding/template", { method: "POST" }),
    );
  });

  it("skips to building by hand", async () => {
    renderChat(withMessages(0));
    fireEvent.click(screen.getByRole("button", { name: "Skip, I'll build it myself" }));
    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith("/onboarding/discovery/skip", { method: "POST" }),
    );
  });
});
