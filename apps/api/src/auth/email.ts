import type { Env } from "../env";

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Sends one transactional email (verification, password reset). */
export type Mailer = (email: Email) => Promise<void>;

/**
 * Resend when RESEND_API_KEY is set; otherwise the email is printed to the wrangler console so
 * local sign-ups can still click their links. Production refuses to boot without a key (env.ts).
 */
export function createMailer(env: Env): Mailer {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    return async ({ to, subject, text }) => {
      console.log(`[email] to=${to} subject="${subject}"\n${text}`);
    };
  }
  return async ({ to, subject, text, html }) => {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, text, html }),
    });
    if (!res.ok) throw new Error(`Resend failed (${res.status}): ${await res.text()}`);
  };
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

/** A plain one-button email; the link is also printed in full for clients that strip buttons. */
function linkEmail(opts: {
  to: string;
  subject: string;
  greeting: string;
  body: string;
  button: string;
  url: string;
  footer: string;
}): Email {
  const { to, subject, greeting, body, button, url, footer } = opts;
  const text = `${greeting}\n\n${body}\n\n${url}\n\n${footer}`;
  const href = escapeHtml(url);
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;color:#111">
<p>${escapeHtml(greeting)}</p>
<p>${escapeHtml(body)}</p>
<p><a href="${href}" style="display:inline-block;background:#c6ff3d;color:#111;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:8px;text-transform:uppercase">${escapeHtml(button)}</a></p>
<p style="font-size:13px;color:#555">Or paste this link into your browser:<br><a href="${href}">${href}</a></p>
<p style="font-size:13px;color:#555">${escapeHtml(footer)}</p>
</div>`;
  return { to, subject, text, html };
}

export function verificationEmail(user: { name: string; email: string }, url: string): Email {
  return linkEmail({
    to: user.email,
    subject: "Confirm your email for Real Life Overall",
    greeting: `Hey ${user.name},`,
    body: "Confirm your email to finish signing up and start building your rating.",
    button: "Confirm email",
    url,
    footer: "This link expires in 24 hours. If you didn't sign up, you can ignore this email.",
  });
}

export function passwordResetEmail(user: { name: string; email: string }, url: string): Email {
  return linkEmail({
    to: user.email,
    subject: "Reset your Real Life Overall password",
    greeting: `Hey ${user.name},`,
    body: "Someone (hopefully you) asked to reset your password. Pick a new one here.",
    button: "Reset password",
    url,
    footer:
      "This link expires in 1 hour. If you didn't ask for this, ignore this email and your password stays the same.",
  });
}
