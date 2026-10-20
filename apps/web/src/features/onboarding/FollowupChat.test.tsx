import type { OnboardingStateDto } from "@rlo/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { FollowupChat } from "./FollowupChat";

vi.mock("../../api/client", () => ({ api: vi.fn() }));
const mockedApi = vi.mocked(api);

const state = {
  stage: "followup",
  chat: [{ role: "assistant", content: "What kind of cardio do you do?" }],
} as OnboardingStateDto;

function renderChat() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FollowupChat state={state} />
    </QueryClientProvider>,
  );
}

describe("FollowupChat", () => {
  beforeEach(() => {
    mockedApi.mockReset();
  });

  it("clears the input as soon as a reply is sent and shows it while waiting", async () => {
    mockedApi.mockReturnValue(new Promise(() => {})); // never resolves
    renderChat();
    const input = screen.getByRole("textbox", { name: "Your reply" });
    fireEvent.change(input, { target: { value: "Mostly running" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(input).toHaveValue("");
    expect(await screen.findByText("Mostly running")).toBeInTheDocument();
  });

  it("puts the reply back in the input if sending fails", async () => {
    mockedApi.mockRejectedValue(new Error("LLM down"));
    renderChat();
    const input = screen.getByRole("textbox", { name: "Your reply" });
    fireEvent.change(input, { target: { value: "Mostly running" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(input).toHaveValue("Mostly running"));
    expect(screen.getByRole("alert")).toHaveTextContent("LLM down");
  });
});
