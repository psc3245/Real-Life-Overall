import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScoreProvider, scaleFor } from "./score";
import { StatBar } from "./StatBar";

describe("StatBar", () => {
  it("shows the value to one decimal with an accessible meter", () => {
    render(<StatBar label="Cardio" value={72.44} />);
    expect(screen.getByText("72.4")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Cardio" })).toHaveAttribute("aria-valuenow", "72.44");
  });

  it("colors by rating tier", () => {
    render(<StatBar label="Skills" value={91} />);
    expect(screen.getByText("91.0")).toHaveStyle({ color: "var(--color-tier-purple)" });
  });

  it("shows growth as points gained on its own scale", () => {
    render(
      <ScoreProvider mode="growth" values={[3.4, 12]}>
        <StatBar label="Cardio" value={3.4} />
      </ScoreProvider>,
    );
    expect(screen.getByText("+3.4")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Cardio" })).toHaveAttribute("aria-valuemax", "15");
  });
});

describe("scaleFor", () => {
  it("keeps ratings out of 100 and fits growth to a tidy ceiling", () => {
    expect(scaleFor("rating", [140])).toBe(100);
    expect(scaleFor("growth", [2])).toBe(10);
    expect(scaleFor("growth", [12, null])).toBe(15);
    expect(scaleFor("growth", [37])).toBe(40);
  });
});
