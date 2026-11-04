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

// Email clients ignore stylesheets and web fonts, so everything is inline on tables, with
// system fallbacks for the app's condensed display face. Colors match the 2K theme tokens.
const C = {
  page: "#07090d",
  card: "#0d1117",
  border: "#1f2833",
  text: "#e6edf5",
  muted: "#8b98a9",
  faint: "#5b6878",
  neon: "#3cf2c8",
};
const DISPLAY = `'Avenir Next Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif`;
const BODY = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;

/** A branded one-button email; the link is also printed in full for clients that strip buttons. */
function linkEmail(opts: {
  to: string;
  subject: string;
  /** Inbox preview text, hidden in the body. */
  preview: string;
  heading: string;
  greeting: string;
  body: string;
  button: string;
  url: string;
  footer: string;
}): Email {
  const { to, subject, preview, heading, greeting, body, button, url, footer } = opts;
  const text = `${greeting}\n\n${body}\n\n${url}\n\n${footer}`;
  const href = escapeHtml(url);
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.page}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page}">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px">
<tr><td style="padding:0 4px 16px;font-family:${DISPLAY};font-size:28px;font-weight:800;letter-spacing:2px;color:${C.neon}">OVR<span style="font-size:11px;font-weight:600;letter-spacing:4px;color:${C.muted};padding-left:10px;vertical-align:middle">REAL LIFE OVERALL</span></td></tr>
<tr><td style="background:${C.card};border:1px solid ${C.border};border-top:4px solid ${C.neon};border-radius:12px;padding:32px 28px">
<h1 style="margin:0 0 20px;font-family:${DISPLAY};font-size:30px;line-height:1.1;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:${C.text}">${escapeHtml(heading)}</h1>
<p style="margin:0 0 12px;font-family:${BODY};font-size:16px;line-height:1.5;color:${C.text}">${escapeHtml(greeting)}</p>
<p style="margin:0 0 28px;font-family:${BODY};font-size:16px;line-height:1.5;color:${C.muted}">${escapeHtml(body)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-radius:8px;background:${C.neon}">
<a href="${href}" style="display:inline-block;padding:14px 28px;font-family:${DISPLAY};font-size:17px;font-weight:800;letter-spacing:2px;text-transform:uppercase;text-decoration:none;color:${C.page};border-radius:8px">${escapeHtml(button)}</a>
</td></tr></table>
<p style="margin:28px 0 0;padding-top:20px;border-top:1px solid ${C.border};font-family:${BODY};font-size:13px;line-height:1.5;color:${C.muted}">Button not working? Paste this link into your browser:<br><a href="${href}" style="color:${C.neon};word-break:break-all">${href}</a></p>
</td></tr>
<tr><td style="padding:20px 4px 0;font-family:${BODY};font-size:12px;line-height:1.5;color:${C.faint}">${escapeHtml(footer)}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  return { to, subject, text, html };
}

export function verificationEmail(user: { name: string; email: string }, url: string): Email {
  return linkEmail({
    to: user.email,
    subject: "Confirm your email for Real Life Overall",
    preview: "One tap and you're on the court.",
    heading: "Confirm your email",
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
    preview: "Pick a new password. The link works for 1 hour.",
    heading: "Reset your password",
    greeting: `Hey ${user.name},`,
    body: "Someone (hopefully you) asked to reset your password. Pick a new one here.",
    button: "Reset password",
    url,
    footer:
      "This link expires in 1 hour. If you didn't ask for this, ignore this email and your password stays the same.",
  });
}
