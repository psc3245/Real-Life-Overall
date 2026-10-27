import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { authClient } from "../../api/auth";
import { Button } from "../../components/Button";
import { fieldClass } from "../../components/form";
import { ErrorNote } from "../onboarding/ErrorNote";
import { MIN_PASSWORD } from "./AuthPage";

/** Step 1: ask for a reset link. Same answer whether or not the email has an account. */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (result.error) setError(new Error(result.error.message ?? "Something went wrong"));
    else setSent(true);
  };

  return (
    <div className="mx-auto max-w-sm space-y-6 pt-10">
      <h1 className="font-display text-4xl font-bold uppercase">Reset password</h1>
      {sent ? (
        <p className="text-court-300">
          If <span className="text-court-100">{email}</span> has an account, a reset link is on its
          way. It expires in an hour.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <p className="text-court-300">We'll email you a link to pick a new password.</p>
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
          <ErrorNote error={error} />
          <Button type="submit" variant="primary" className="w-full py-3" disabled={busy}>
            {busy ? "One moment…" : "Send reset link"}
          </Button>
        </form>
      )}
      <p className="text-center text-sm text-court-300">
        <Link to="/signin" className="text-neon hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

/** Step 2: the emailed link lands here with `?token=` (or `?error=INVALID_TOKEN`). */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  if (!token || params.get("error")) {
    return (
      <div className="mx-auto max-w-sm space-y-6 pt-10">
        <h1 className="font-display text-4xl font-bold uppercase">Link expired</h1>
        <p className="text-court-300">
          That reset link is invalid or has expired. Links work once, for an hour.
        </p>
        <Link to="/forgot-password" className="text-neon hover:underline">
          Send a new link
        </Link>
      </div>
    );
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await authClient.resetPassword({ newPassword: password, token });
    setBusy(false);
    if (result.error) {
      setError(new Error(result.error.message ?? "Something went wrong"));
      return;
    }
    navigate("/signin?reset=1", { replace: true });
  };

  return (
    <div className="mx-auto max-w-sm space-y-6 pt-10">
      <h1 className="font-display text-4xl font-bold uppercase">New password</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-xs uppercase tracking-wider text-court-300">New password</span>
          <input
            type="password"
            value={password}
            required
            minLength={MIN_PASSWORD}
            autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)}
            className={fieldClass}
          />
          <span className="text-xs text-court-500">
            At least {MIN_PASSWORD} characters. This signs you out everywhere else.
          </span>
        </label>
        <ErrorNote error={error} />
        <Button type="submit" variant="primary" className="w-full py-3" disabled={busy}>
          {busy ? "One moment…" : "Set password"}
        </Button>
      </form>
    </div>
  );
}
