import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '@quantyx/postgres';
import { createEmailTransport } from './email.js';
import { authEnvironment } from './env.js';

function emailLayout(
  greeting: string,
  body: string,
  actionUrl: string,
  actionLabel: string,
  footer: string,
): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:32px 32px 0;text-align:center;">
          <span style="font-size:20px;font-weight:700;color:#0d7377;">Quantyx</span>
        </td></tr>
        <tr><td style="padding:24px 32px;">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#1a1a1a;">${greeting}</h1>
          <div style="color:#374151;font-size:15px;line-height:1.6;">${body}</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
            <tr><td align="center">
              <a href="${actionUrl}" style="display:inline-block;padding:12px 32px;background-color:#0d7377;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">${actionLabel}</a>
            </td></tr>
          </table>
          ${footer}
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #e5e7eb;text-align:center;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">Quantyx — Event analytics platform</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
}

const emailTransport = createEmailTransport({
  host: authEnvironment.SMTP_HOST,
  port: authEnvironment.SMTP_PORT,
  secure: authEnvironment.SMTP_SECURE,
  auth: {
    user: authEnvironment.SMTP_USER,
    pass: authEnvironment.SMTP_PASS,
  },
  from: authEnvironment.SMTP_FROM,
});

export const auth = betterAuth({
  baseURL: authEnvironment.API_TENANT_MANAGER_EXTERNAL_URL,
  trustedOrigins: [authEnvironment.WEB_APP_URL],
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    async sendResetPassword({ user, url }) {
      await emailTransport.sendEmail({
        to: user.email,
        subject: 'Quantyx — reset your password',
        html: emailLayout(
          `Hi ${user.name || 'there'},`,
          `<p>We received a request to reset your password. Click the button below to choose a new one.</p>`,
          url,
          'Reset password',
          `<p style="color:#6b7280;font-size:13px;">If you didn't request this, you can safely ignore this email. The link expires in 1 hour.</p>`,
        ),
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      // Replace the default callbackURL=/ with the frontend app URL
      const verifyUrl = url.replace(
        /callbackURL=[^&]*/,
        `callbackURL=${encodeURIComponent(authEnvironment.WEB_APP_URL + '/app')}`,
      );
      await emailTransport.sendEmail({
        to: user.email,
        subject: 'Welcome to Quantyx — verify your email',
        html: emailLayout(
          `Welcome${user.name ? `, ${user.name}` : ''}!`,
          `<p>Thanks for signing up for Quantyx. To get started, please verify your email address.</p>`,
          verifyUrl,
          'Verify email',
          `<p style="color:#6b7280;font-size:13px;">If you didn't create an account, you can safely ignore this email.</p>`,
        ),
      });
    },
  },
  experimental: {
    joins: true,
  },
  advanced: {
    database: {
      generateId: false,
    },
  },
});
