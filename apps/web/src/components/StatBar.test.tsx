import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
});
