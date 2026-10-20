import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary:
    "bg-neon text-court-950 font-display uppercase tracking-wider font-semibold hover:brightness-110",
  secondary: "border border-court-500 text-court-100 hover:border-neon hover:text-neon",
  ghost: "text-court-300 hover:text-neon",
  danger: "text-court-500 hover:text-flare",
};

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`rounded-lg px-4 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
