import { NavLink } from "react-router";
import { useMe } from "../../api/hooks";

const tab = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap border-b-2 px-1 pb-2 font-display text-sm uppercase tracking-wider ${isActive ? "border-neon text-neon" : "border-transparent text-court-300 hover:text-court-100"}`;

/** Tabs across the training pages. */
export function WorkoutsNav() {
  return (
    <nav aria-label="Training" className="flex gap-5 overflow-x-auto border-b border-court-800">
      <NavLink to="/workouts" end className={tab}>
        Start
      </NavLink>
      <NavLink to="/workouts/history" className={tab}>
        History
      </NavLink>
      <NavLink to="/workouts/exercises" className={tab}>
        Exercises
      </NavLink>
      <NavLink to="/body" className={tab}>
        Body
      </NavLink>
    </nav>
  );
}

export function useUnits() {
  return useMe().data?.unitSystem ?? "imperial";
}
