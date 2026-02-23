const { mockSendMail } = vi.hoisted(() => ({
  mockSendMail: vi.fn().mockResolvedValue({ messageId: 'test-id' }),
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn().mockReturnValue({ sendMail: mockSendMail }),
  },
}));

import nodemailer from 'nodemailer';
import { createEmailTransport, type SmtpConfig } from './email';

const smtpConfig: SmtpConfig = {
  host: 'smtp.example.com',
  port: 587,
  secure: false,
  auth: { user: 'user', pass: 'pass' },
  from: 'noreply@example.com',
};

describe('createEmailTransport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a nodemailer transport with the correct config', () => {
    createEmailTransport(smtpConfig);

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: { user: 'user', pass: 'pass' },
    });
  });

  it('should send an email with correct parameters', async () => {
    const sender = createEmailTransport(smtpConfig);

    await sender.sendEmail({
      to: 'recipient@example.com',
      subject: 'Test Subject',
      html: '<p>Test body</p>',
    });

    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'noreply@example.com',
      to: 'recipient@example.com',
      subject: 'Test Subject',
      html: '<p>Test body</p>',
    });
  });

  it('should propagate transport errors', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP failure'));

    const sender = createEmailTransport(smtpConfig);

    await expect(
      sender.sendEmail({
        to: 'recipient@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      }),
    ).rejects.toThrow('SMTP failure');
  });
});
