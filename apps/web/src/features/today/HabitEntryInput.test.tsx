import { normalizeHabitConfig, type HabitDto, type HabitType } from "@rlo/shared";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HabitEntryInput } from "./HabitEntryInput";

const habit = (type: HabitType, config = {}): HabitDto => ({
  id: "h",
  name: "Habit",
  type,
  config: normalizeHabitConfig(type, config),
  days: [0, 1, 2, 3, 4, 5, 6],
  links: [],
  sortOrder: 0,
  createdOn: "2026-10-01",
});

describe("HabitEntryInput", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("toggles a checkbox habit and saves immediately", () => {
    const onSave = vi.fn();
    render(
      <HabitEntryInput habit={habit("checkbox")} entry={null} disabled={false} onSave={onSave} />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Habit done" }));
    expect(onSave).toHaveBeenCalledWith({ num: 1, text: null });
    fireEvent.click(screen.getByRole("checkbox", { name: "Habit done" }));
    expect(onSave).toHaveBeenLastCalledWith({ num: null, text: null });
  });

  it("debounces counter taps into one save", () => {
    const onSave = vi.fn();
    render(
      <HabitEntryInput
        habit={habit("counter", { target: 10, unit: "pages" })}
        entry={{ num: 2, text: null }}
        disabled={false}
        onSave={onSave}
      />,
    );
    expect(screen.getByText("/ 10 pages")).toBeInTheDocument();
    const plus = screen.getByRole("button", { name: "Increase" });
    fireEvent.click(plus);
    fireEvent.click(plus);
    fireEvent.click(plus);
    expect(onSave).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ num: 5, text: null });
  });

  it("steps duration by 15 minutes", () => {
    const onSave = vi.fn();
    render(
      <HabitEntryInput habit={habit("duration")} entry={null} disabled={false} onSave={onSave} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Increase" }));
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(onSave).toHaveBeenCalledWith({ num: 15, text: null });
  });

  it("rates with stars and clears by tapping the same star", () => {
    const onSave = vi.fn();
    render(
      <HabitEntryInput
        habit={habit("rating")}
        entry={{ num: 3, text: null }}
        disabled={false}
        onSave={onSave}
      />,
    );
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    fireEvent.click(screen.getByRole("radio", { name: "3 stars" }));
    expect(onSave).toHaveBeenCalledWith({ num: null, text: null });
  });

  it("saves text on blur only when it changed", () => {
    const onSave = vi.fn();
    render(
      <HabitEntryInput habit={habit("shorttext")} entry={null} disabled={false} onSave={onSave} />,
    );
    const input = screen.getByRole("textbox", { name: "Habit" });
    fireEvent.blur(input);
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "Chapter 3" } });
    fireEvent.blur(input);
    expect(onSave).toHaveBeenCalledWith({ num: null, text: "Chapter 3" });
  });
});
