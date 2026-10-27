import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { authClient, useAuthConfig, useAuthState } from "../../api/auth";
import { Button } from "../../components/Button";
import { ErrorNote } from "../onboarding/ErrorNote";
import { fieldClass } from "../../components/form";

export const MIN_PASSWORD = 8;

/** Messages for the `?error=` Better Auth adds when an email link fails. */
const LINK_ERRORS: Record<string, string> = {
  TOKEN_EXPIRED: "That confirmation link expired. Sign in and we'll send a new one.",
  INVALID_TOKEN: "That confirmation link isn't valid. Sign in and we'll send a new one.",
};

/** Only same-site paths, so `?next=` can't send people elsewhere. */
function safeNext(next: string | null): string | null {
  return next?.startsWith("/") && !next.startsWith("//") ? next : null;
}

/** Sign in and sign up share one form; `mode` picks which. */
export function AuthPage({ mode }: { mode: "signin" | "signup" }) {
  const auth = useAuthState();
  const config = useAuthConfig();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  /** Set once a confirmation email is on its way; swaps the form for "check your email". */
  const [sentTo, setSentTo] = useState<{ email: string; unconfirmed: boolean } | null>(null);

  const signup = mode === "signup";
  const next = safeNext(params.get("next"));
  const linkError = LINK_ERRORS[params.get("error") ?? ""];
  // New accounts go straight to building their rating (their confirmation link brings them back
  // here signed in, with next=/onboarding).
  if (auth.signedIn) return <Navigate to={next ?? (signup ? "/onboarding" : "/")} replace />;

  // Where the confirmation link lands: here, which forwards a signed-in player on.
  const callbackURL = `${window.location.origin}/signin?next=${signup ? "/onboarding" : (next ?? "/")}`;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = signup
      ? await authClient.signUp.email({ email, password, name: name.trim(), callbackURL })
      : await authClient.signIn.email({ email, password, callbackURL });
    setBusy(false);
    if (result.error) {
      // Signing in before confirming re-sends the link.
      if (result.error.code === "EMAIL_NOT_VERIFIED") setSentTo({ email, unconfirmed: true });
      else setError(new Error(result.error.message ?? "Something went wrong"));
      return;
    }
    if (signup) {
      setSentTo({ email, unconfirmed: false });
      return;
    }
    queryClient.clear();
    navigate(next ?? "/", { replace: true });
  };

  if (sentTo) {
    return (
      <CheckEmail
        email={sentTo.email}
        unconfirmed={sentTo.unconfirmed}
        callbackURL={callbackURL}
        onBack={() => setSentTo(null)}
      />
    );
  }

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
      {!signup && <ErrorNote error={linkError ? new Error(linkError) : null} />}
      {!signup && params.get("reset") && (
        <p className="rounded-lg border border-neon/40 bg-neon/10 px-3 py-2 text-sm text-neon">
          Password updated. Sign in with your new one.
        </p>
      )}
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
        {!signup && (
          <Link
            to="/forgot-password"
            className="-mt-2 block text-right text-xs text-court-300 hover:text-neon"
          >
            Forgot password?
          </Link>
        )}
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

/** After sign-up (or an unconfirmed sign-in): the link is in their inbox. */
function CheckEmail({
  email,
  unconfirmed,
  callbackURL,
  onBack,
}: {
  email: string;
  unconfirmed: boolean;
  callbackURL: string;
  onBack: () => void;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<Error | null>(null);
  const resend = async () => {
    setState("sending");
    setError(null);
    const result = await authClient.sendVerificationEmail({ email, callbackURL });
    if (result.error) {
      setError(new Error(result.error.message ?? "Couldn't send the email"));
      setState("idle");
    } else setState("sent");
  };
  return (
    <div className="mx-auto max-w-sm space-y-6 pt-10">
      <h1 className="font-display text-4xl font-bold uppercase">Check your email</h1>
      <p className="text-court-300">
        {unconfirmed ? "Confirm your email before signing in. " : ""}
        We sent a link to <span className="text-court-100">{email}</span>. Open it to{" "}
        {unconfirmed ? "finish signing in" : "finish creating your player"}.
      </p>
      <ErrorNote error={error} />
      <div className="flex flex-wrap gap-3">
        <Button onClick={resend} disabled={state !== "idle"}>
          {state === "sending" ? "Sending…" : state === "sent" ? "Sent again" : "Resend link"}
        </Button>
        <Button variant="ghost" onClick={onBack}>
          Use a different email
        </Button>
      </div>
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
