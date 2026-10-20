/** A signed rating change: green up, red down. */
export function Delta({ value, className = "" }: { value: number; className?: string }) {
  const up = value > 0;
  return (
    <span
      className={`font-display tabular-nums ${up ? "text-tier-green" : "text-tier-red"} ${className}`}
    >
      {up ? "+" : "−"}
      {Math.abs(value).toFixed(Math.abs(value) < 0.1 ? 2 : 1)}
    </span>
  );
}
