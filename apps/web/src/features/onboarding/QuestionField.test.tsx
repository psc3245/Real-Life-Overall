import type { QuestionDto } from "@rlo/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuestionField } from "./QuestionField";

const base: QuestionDto = {
  id: "q1",
  nodeIds: ["n"],
  type: "single_choice",
  prompt: "How often do you run?",
  options: ["Never", "Weekly", "Daily"],
  min: null,
  max: null,
  minLabel: null,
  maxLabel: null,
  unit: null,
};

describe("QuestionField", () => {
  it("single choice reports the picked option", () => {
    const onChange = vi.fn();
    render(<QuestionField question={base} value="Weekly" onChange={onChange} />);
    expect(screen.getByRole("radio", { name: "Weekly" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "Daily" }));
    expect(onChange).toHaveBeenCalledWith("Daily");
  });

  it("multi choice toggles options and offers 'none of these'", () => {
    const onChange = vi.fn();
    const q = { ...base, type: "multi_choice" as const };
    const { rerender } = render(
      <QuestionField question={q} value={undefined} onChange={onChange} />,
    );
    fireEvent.click(screen.getByText("None of these"));
    expect(onChange).toHaveBeenLastCalledWith([]);

    rerender(<QuestionField question={q} value={["Never"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Daily" }));
    expect(onChange).toHaveBeenLastCalledWith(["Never", "Daily"]);
    fireEvent.click(screen.getByRole("checkbox", { name: "Never" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("number clears to null when emptied and shows its unit", () => {
    const onChange = vi.fn();
    const q = { ...base, type: "number" as const, options: [], unit: "km/week" };
    render(<QuestionField question={q} value={12} onChange={onChange} />);
    expect(screen.getByText("km/week")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("slider shows a dash until answered, then its value", () => {
    const q = { ...base, type: "slider" as const, options: [], min: 0, max: 10, minLabel: "Low" };
    const { rerender } = render(
      <QuestionField question={q} value={undefined} onChange={() => {}} />,
    );
    expect(screen.getByText("–")).toBeInTheDocument();
    expect(screen.getByText("Low")).toBeInTheDocument();
    rerender(<QuestionField question={q} value={7} onChange={() => {}} />);
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("marks text questions optional", () => {
    const q = { ...base, type: "short_text" as const, options: [] };
    render(<QuestionField question={q} value={undefined} onChange={() => {}} />);
    expect(screen.getByText("optional")).toBeInTheDocument();
  });
});
