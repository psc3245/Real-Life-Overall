import type { RatedNodeDto } from "@rlo/shared";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { GRID_COLOR, OVERALL_COLOR } from "./palette";
import { useScore } from "../score";

/** The player's "shape": one series, every category on a 0-100 axis (growth: its own scale). */
export function ShapeRadar({ nodes }: { nodes: RatedNodeDto[] }) {
  const { max } = useScore();
  const root = nodes.find((n) => n.parentId === null);
  const data = nodes
    .filter((n) => n.parentId === root?.id)
    .map((c) => ({ name: c.name, value: c.value ?? 0 }));
  if (data.length < 3) {
    return <p className="text-sm text-court-500">The radar needs at least three categories.</p>;
  }
  return (
    <div
      className="h-72 w-full"
      role="img"
      aria-label={`Category ratings: ${data.map((d) => `${d.name} ${d.value.toFixed(1)}`).join(", ")}`}
    >
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke={GRID_COLOR} />
          <PolarAngleAxis dataKey="name" tick={{ fill: "var(--color-court-300)", fontSize: 12 }} />
          {/* Rings mark 20-point steps; exact values are in the tooltip, so no tick labels. */}
          <PolarRadiusAxis domain={[0, max]} tick={false} tickCount={6} axisLine={false} />
          <Tooltip
            formatter={(v) => (typeof v === "number" ? v.toFixed(1) : v)}
            contentStyle={{
              background: "var(--color-court-900)",
              border: "1px solid var(--color-court-700)",
              borderRadius: 8,
              color: "var(--color-court-100)",
            }}
          />
          <Radar
            dataKey="value"
            name="Rating"
            stroke={OVERALL_COLOR}
            strokeWidth={2}
            fill={OVERALL_COLOR}
            fillOpacity={0.15}
            isAnimationActive={false}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
