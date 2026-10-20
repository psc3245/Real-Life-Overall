export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : "Something went wrong";
  return (
    <p
      role="alert"
      className="rounded-lg border border-flare/40 bg-flare/10 px-3 py-2 text-sm text-flare"
    >
      {message}
    </p>
  );
}
