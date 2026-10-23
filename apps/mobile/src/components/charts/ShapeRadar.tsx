import type { RatedNodeDto } from "@rlo/shared";
import { useState } from "react";
import { View } from "react-native";
import Svg, { Circle, G, Line, Polygon, Text as SvgText } from "react-native-svg";
import { colors } from "@/lib/theme";
import { Muted } from "../ui";
import { GRID_COLOR, OVERALL_COLOR } from "./palette";

/** The player's "shape": every category on a 0–100 axis, with values at the points. */
export function ShapeRadar({ nodes }: { nodes: RatedNodeDto[] }) {
  const [width, setWidth] = useState(0);
  const root = nodes.find((n) => n.parentId === null);
  const data = nodes
    .filter((n) => n.parentId === root?.id)
    .map((c) => ({ name: c.name, value: c.value ?? 0 }));
  if (data.length < 3) return <Muted>The radar needs at least three categories.</Muted>;

  // Full width so side labels have room; the radar itself stays a comfortable size.
  const height = Math.min(width, 300);
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(height * 0.34, width * 0.26);
  const point = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / data.length - Math.PI / 2;
    return [cx + Math.cos(a) * r * (v / 100), cy + Math.sin(a) * r * (v / 100)] as const;
  };
  const ring = (v: number) => data.map((_, i) => point(i, v).join(",")).join(" ");

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}

      accessible
      accessibilityLabel={`Category ratings: ${data.map((d) => `${d.name} ${d.value.toFixed(1)}`).join(", ")}`}
    >
      {width > 0 && (
        <Svg width={width} height={height}>
          {[20, 40, 60, 80, 100].map((v) => (
            <Polygon key={v} points={ring(v)} fill="none" stroke={GRID_COLOR} />
          ))}
          {data.map((_, i) => {
            const [x, y] = point(i, 100);
            return <Line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={GRID_COLOR} />;
          })}
          <Polygon
            points={data.map((d, i) => point(i, d.value).join(",")).join(" ")}
            fill={OVERALL_COLOR}
            fillOpacity={0.15}
            stroke={OVERALL_COLOR}
            strokeWidth={2}
          />
          {data.map((d, i) => {
            const [x, y] = point(i, d.value);
            const [lx, ly0] = point(i, 118);
            const anchor = Math.abs(lx - cx) < 4 ? "middle" : lx > cx ? "start" : "end";
            // Labels above the top point and below the bottom one sit clear of the polygon.
            const ly = ly0 < cy - 4 ? ly0 - 10 : ly0 > cy + 4 ? ly0 + 4 : ly0 - 4;
            return (
              <G key={d.name}>
                <Circle cx={x} cy={y} r={3} fill={OVERALL_COLOR} />
                <SvgText x={lx} y={ly} fontSize={12} fill={colors.court300} textAnchor={anchor}>
                  {d.name}
                </SvgText>
                <SvgText
                  x={lx}
                  y={ly + 14}
                  fontSize={11}
                  fontWeight="bold"
                  fill={colors.court100}
                  textAnchor={anchor}
                >
                  {d.value.toFixed(1)}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      )}
    </View>
  );
}
