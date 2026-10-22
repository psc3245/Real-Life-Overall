import type { HistoryDto, RatedNodeDto } from "@rlo/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActivityHeatmap } from "./ActivityHeatmap";
import { HistoryChart } from "./HistoryChart";

const node = (id: string, parentId: string | null, name: string): RatedNodeDto => ({
  id,
  parentId,
  name,
  description: "",
  depth: parentId ? 1 : 0,
  weight: 5,
  sortOrder: 0,
  templateKey: null,
  value: 60,
  rationale: null,
  confidence: null,
  decay: null,
  trend: null,
});

describe("ActivityHeatmap", () => {
  it("labels every day and summarizes logging", () => {
    const { container } = render(
      <ActivityHeatmap
        days={[
          { date: "2026-10-18", logged: true, recapped: true, gain: 1.4, loss: -0.2 },
          { date: "2026-10-19", logged: false, recapped: false, gain: 0, loss: -0.5 },
        ]}
      />,
    );
    expect(screen.getByText("Logged 1 of 2 days.")).toBeInTheDocument();
    const titles = [...container.querySelectorAll("title")].map((t) => t.textContent);
    expect(titles).toEqual([
      "2026-10-18 · logged · recapped · +1.4 gained · -0.2 lost",
      "2026-10-19 · nothing logged · -0.5 lost",
    ]);
  });
});

describe("HistoryChart", () => {
  const nodes = [node("r", null, "Overall"), node("a", "r", "Fitness"), node("b", "r", "Career")];
  const history: HistoryDto = {
    dates: ["2026-10-18", "2026-10-19"],
    series: [
      { nodeId: "r", values: [60, 61] },
      { nodeId: "a", values: [55, 56.5] },
      { nodeId: "b", values: [65, 65.5] },
    ],
  };

  it("switches between overall and categories, with a table view", () => {
    render(<HistoryChart history={history} nodes={nodes} />);
    fireEvent.click(screen.getByRole("button", { name: "Show table" }));
    expect(screen.getByRole("columnheader", { name: "Overall" })).toBeInTheDocument();
    expect(screen.getByText("61.0")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "categories" }));
    expect(screen.getByRole("columnheader", { name: "Fitness" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Career" })).toBeInTheDocument();
    expect(screen.getByText("56.5")).toBeInTheDocument();
  });

  it("waits for a second day before drawing", () => {
    render(<HistoryChart history={{ dates: ["2026-10-19"], series: [] }} nodes={nodes} />);
    expect(screen.getByText(/after your first full day/)).toBeInTheDocument();
  });
});
