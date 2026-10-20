import { Link } from "react-router";

export function NotFound() {
  return (
    <div className="pt-20 text-center">
      <p className="font-display text-7xl font-bold text-flare">404</p>
      <p className="mt-2 text-court-300">Out of bounds.</p>
      <Link to="/" className="mt-6 inline-block text-neon underline-offset-4 hover:underline">
        Back to home
      </Link>
    </div>
  );
}
