import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { DebugId, DebugJson } from "./Debug";
import { setDebugMode } from "./debugMode";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  api: vi.fn(),
}));
const mockedApi = vi.mocked(api);

function renderAs(role: "user" | "admin") {
  mockedApi.mockImplementation(async (path: string) => {
    if (path === "/auth-config") return { mode: "dev", google: false };
    if (path === "/me") return { id: "u1", username: "pc", role };
    return null;
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DebugJson label="day" data={{ secret: 42 }} />
      <DebugId id="1234567890abcdef" />
    </QueryClientProvider>,
  );
}

describe("debug info", () => {
  beforeEach(() => {
    mockedApi.mockReset();
    setDebugMode(true);
  });

  it("shows raw data and ids to admins", async () => {
    renderAs("admin");
    expect(await screen.findByText(/debug · day/)).toBeInTheDocument();
    expect(screen.getByText("12345678…")).toBeInTheDocument();
  });

  it("renders nothing for regular users", async () => {
    renderAs("user");
    await vi.waitFor(() => expect(mockedApi).toHaveBeenCalledWith("/me"));
    expect(screen.queryByText(/debug · day/)).toBeNull();
  });

  it("hides when an admin switches debug mode off", async () => {
    setDebugMode(false);
    renderAs("admin");
    await vi.waitFor(() => expect(mockedApi).toHaveBeenCalledWith("/me"));
    expect(screen.queryByText(/debug · day/)).toBeNull();
  });
});
