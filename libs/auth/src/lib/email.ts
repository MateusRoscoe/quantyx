import nodemailer from 'nodemailer';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export interface EmailSender {
  sendEmail(options: {
    to: string;
    subject: string;
    html: string;
  }): Promise<void>;
}

export function createEmailTransport(config: SmtpConfig): EmailSender {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });

  return {
    async sendEmail({ to, subject, html }) {
      await transporter.sendMail({
        from: config.from,
        to,
        subject,
        html,
      });
    },
  };
}
