import { env } from "../config.ts";

interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

/**
 * Provider-independent email sender. The "console" provider (default in
 * dev/sandbox) just logs the message — swap EMAIL_PROVIDER to "resend" or
 * "smtp" and fill in the matching env vars for real delivery. Routes never
 * call a provider SDK directly, so switching providers never touches
 * business logic.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  switch (env.EMAIL_PROVIDER) {
    case "console":
    default:
      // eslint-disable-next-line no-console
      console.log(
        `[email:console] to=${message.to} subject="${message.subject}"\n${message.html}`,
      );
      return;
    // case "resend": call Resend's API here using env.RESEND_API_KEY
    // case "smtp": use nodemailer with env.SMTP_* here
  }
}

export function verificationEmail(link: string) {
  return {
    subject: "Verify your KryptonIX account",
    html: `<p>Welcome to KryptonIX. Verify your email to continue:</p><p><a href="${link}">${link}</a></p><p>This link expires in 24 hours.</p>`,
  };
}

export function passwordResetEmail(link: string) {
  return {
    subject: "Reset your KryptonIX password",
    html: `<p>We received a request to reset your password.</p><p><a href="${link}">${link}</a></p><p>If you didn't request this, you can ignore this email. This link expires in 1 hour.</p>`,
  };
}

export function invitationEmail(orgName: string, link: string) {
  return {
    subject: `You've been invited to join ${orgName} on KryptonIX`,
    html: `<p>You've been invited to join <b>${orgName}</b> on the KryptonIX Client app.</p><p><a href="${link}">${link}</a></p><p>This invitation expires in 7 days.</p>`,
  };
}

export function accountApprovedEmail() {
  return {
    subject: "Your KryptonIX account is approved",
    html: `<p>Your account has been approved. You can now sign in and explore services.</p>`,
  };
}
