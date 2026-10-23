import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { authClient, useAuthConfig, useAuthState } from "../../api/auth";
import { Button } from "../../components/Button";
import { ErrorNote } from "../onboarding/ErrorNote";
import { fieldClass } from "../../components/form";

const MIN_PASSWORD = 8;

/** Sign in and sign up share one form; `mode` picks which. */
export function AuthPage({ mode }: { mode: "signin" | "signup" }) {
  const auth = useAuthState();
  const config = useAuthConfig();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);

  const signup = mode === "signup";
  // New accounts go straight to building their rating.
  if (auth.signedIn) return <Navigate to={signup ? "/onboarding" : "/"} replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = signup
      ? await authClient.signUp.email({ email, password, name: name.trim() })
      : await authClient.signIn.email({ email, password });
    setBusy(false);
    if (result.error) {
      setError(new Error(result.error.message ?? "Something went wrong"));
      return;
    }
    queryClient.clear();
    navigate(signup ? "/onboarding" : "/", { replace: true });
  };

  const google = () =>
    authClient.signIn.social({
      provider: "google",
      callbackURL: `${window.location.origin}/`,
    });

  return (
    <div className="mx-auto max-w-sm space-y-6 pt-10">
      <h1 className="font-display text-4xl font-bold uppercase">
        {signup ? "Create your player" : "Welcome back"}
      </h1>
      {config.data?.google && (
        <>
          <Button className="w-full py-3" onClick={google}>
            Continue with Google
          </Button>
          <p className="text-center text-xs uppercase tracking-wider text-court-500">or</p>
        </>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        {signup && (
          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-wider text-court-300">Name</span>
            <input
              value={name}
              required
              maxLength={40}
              autoComplete="name"
              onChange={(e) => setName(e.target.value)}
              className={fieldClass}
            />
          </label>
        )}
        <label className="block space-y-1">
          <span className="text-xs uppercase tracking-wider text-court-300">Email</span>
          <input
            type="email"
            value={email}
            required
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs uppercase tracking-wider text-court-300">Password</span>
          <input
            type="password"
            value={password}
            required
            minLength={signup ? MIN_PASSWORD : undefined}
            autoComplete={signup ? "new-password" : "current-password"}
            onChange={(e) => setPassword(e.target.value)}
            className={fieldClass}
          />
          {signup && (
            <span className="text-xs text-court-500">At least {MIN_PASSWORD} characters.</span>
          )}
        </label>
        <ErrorNote error={error} />
        <Button type="submit" variant="primary" className="w-full py-3" disabled={busy}>
          {busy ? "One moment…" : signup ? "Create account" : "Sign in"}
        </Button>
      </form>
      <p className="text-center text-sm text-court-300">
        {signup ? "Already have an account? " : "New here? "}
        <Link to={signup ? "/signin" : "/signup"} className="text-neon hover:underline">
          {signup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}

/** Wraps private pages: sends signed-out visitors to sign in. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const auth = useAuthState();
  if (auth.loading) return <p className="pt-10 text-court-500">Loading…</p>;
  if (!auth.signedIn) return <Navigate to="/signin" replace />;
  return children;
}
