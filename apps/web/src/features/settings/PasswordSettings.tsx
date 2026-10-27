import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { authClient } from "../../api/auth";
import { Button } from "../../components/Button";
import { fieldClass } from "../../components/form";
import { MIN_PASSWORD } from "../auth/AuthPage";
import { ErrorNote } from "../onboarding/ErrorNote";
import { SettingBlock, SettingRow, SettingsCard } from "./controls";

/** Email, password and signed-in devices. Only for real sign-in (not AUTH_MODE=dev). */
export function SignInSettings({ id }: { id?: string }) {
  const session = authClient.useSession();
  const email = session.data?.user.email;
  // Google-only players have no password yet; they can set one by email.
  const accounts = useQuery({
    queryKey: ["auth-accounts"],
    queryFn: async () => {
      const result = await authClient.listAccounts();
      if (result.error) throw new Error(result.error.message ?? "Couldn't load sign-in methods");
      return result.data;
    },
  });
  const hasPassword = accounts.data?.some((a) => a.providerId === "credential");
  const hasGoogle = accounts.data?.some((a) => a.providerId === "google");

  return (
    <SettingsCard id={id} title="Sign-in & security">
      <SettingRow
        label="Email"
        detail={
          hasGoogle
            ? hasPassword
              ? "Sign in with Google or your password."
              : "You sign in with Google."
            : "You sign in with your email and password."
        }
      >
        <span className="text-sm text-court-300">{email}</span>
      </SettingRow>
      {accounts.isSuccess &&
        (hasPassword ? <ChangePassword /> : email && <SetPasswordByEmail email={email} />)}
      <SignOutOthers />
    </SettingsCard>
  );
}

function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [done, setDone] = useState(false);
  const mismatch = confirm.length > 0 && confirm !== next;

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (next !== confirm) return;
    setBusy(true);
    setError(null);
    const result = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    });
    setBusy(false);
    if (result.error) {
      setError(
        new Error(
          result.error.code === "INVALID_PASSWORD"
            ? "That current password isn't right."
            : (result.error.message ?? "Couldn't change your password"),
        ),
      );
      return;
    }
    reset();
    setOpen(false);
    setDone(true);
  };

  if (!open) {
    return (
      <SettingRow
        label="Password"
        detail={done ? "Password changed. Your other devices were signed out." : undefined}
      >
        <Button
          onClick={() => {
            setDone(false);
            setOpen(true);
          }}
        >
          Change password
        </Button>
      </SettingRow>
    );
  }

  return (
    <SettingBlock label="Change password">
      <form onSubmit={onSubmit} className="max-w-sm space-y-3" aria-label="Change password">
        <PasswordField
          label="Current password"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
        />
        <PasswordField
          label="New password"
          value={next}
          onChange={setNext}
          autoComplete="new-password"
          minLength={MIN_PASSWORD}
          hint={`At least ${MIN_PASSWORD} characters.`}
        />
        <PasswordField
          label="Confirm new password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          invalid={mismatch}
          hint={mismatch ? "Doesn't match the new password." : undefined}
        />
        <p className="text-xs text-court-500">Changing it signs you out on your other devices.</p>
        <ErrorNote error={error} />
        <div className="flex gap-3">
          <Button
            type="submit"
            variant="primary"
            disabled={busy || !current || next.length < MIN_PASSWORD || next !== confirm}
          >
            {busy ? "Saving…" : "Update password"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              reset();
              setOpen(false);
            }}
          >
            Cancel
          </Button>
        </div>
      </form>
    </SettingBlock>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  minLength,
  hint,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  minLength?: number;
  hint?: string;
  invalid?: boolean;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs uppercase tracking-wider text-court-300">{label}</span>
      <input
        type="password"
        value={value}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        aria-invalid={invalid}
        onChange={(e) => onChange(e.target.value)}
        className={fieldClass}
      />
      {hint && (
        <span className={`text-xs ${invalid ? "text-flare" : "text-court-500"}`}>{hint}</span>
      )}
    </label>
  );
}

/** Google-only players add a password through the reset email. */
function SetPasswordByEmail({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<Error | null>(null);
  const send = async () => {
    setState("sending");
    setError(null);
    const result = await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (result.error) {
      setError(new Error(result.error.message ?? "Couldn't send the email"));
      setState("idle");
    } else setState("sent");
  };
  return (
    <SettingRow
      label="Password"
      detail={
        state === "sent" ? (
          `Check ${email} for a link to set your password.`
        ) : error ? (
          <span className="text-flare">{error.message}</span>
        ) : (
          "Add one to sign in without Google. We'll email you a link."
        )
      }
    >
      <Button onClick={send} disabled={state !== "idle"}>
        {state === "sending" ? "Sending…" : state === "sent" ? "Sent" : "Set a password"}
      </Button>
    </SettingRow>
  );
}

function SignOutOthers() {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setState("busy");
    setError(null);
    const result = await authClient.revokeOtherSessions();
    if (result.error) {
      setError(result.error.message ?? "Couldn't sign out other devices");
      setState("idle");
    } else setState("done");
  };
  return (
    <SettingRow
      label="Other devices"
      detail={
        error ? (
          <span className="text-flare">{error}</span>
        ) : state === "done" ? (
          "Signed out everywhere else."
        ) : (
          "Signed in somewhere you shouldn't be? Sign out everywhere but here."
        )
      }
    >
      <Button variant="ghost" onClick={run} disabled={state !== "idle"}>
        {state === "busy" ? "Signing out…" : "Sign out others"}
      </Button>
    </SettingRow>
  );
}
