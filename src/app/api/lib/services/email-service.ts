/**
 * Email Service
 * Handles all email sending through Mailgun
 */

import FormData from 'form-data';

import { logger } from '../utils/logger';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export class EmailService {
  private mailgunApiKey: string;

  private mailgunDomain: string;

  private mailgunFromEmail: string;

  private mailgunFromName: string;

  private mailgunApiUrl: string;

  constructor() {
    this.mailgunApiKey = process.env.MAILGUN_API_KEY || '';
    this.mailgunDomain = process.env.MAILGUN_DOMAIN || '';
    this.mailgunFromEmail = process.env.MAILGUN_FROM_EMAIL || 'noreply@yourdomain.com';
    this.mailgunFromName = process.env.MAILGUN_FROM_NAME || 'iCodeAI';
    this.mailgunApiUrl = process.env.MAILGUN_API_URL || 'https://api.mailgun.net';
  }

  /**
   * Send an email
   */
  async send(options: EmailOptions): Promise<boolean> {
    if (!this.mailgunApiKey || !this.mailgunDomain) {
      logger.warn('Mailgun not configured, skipping email send', {
        to: options.to,
        subject: options.subject,
      });
      return false;
    }

    try {
      const formData = new FormData();

      formData.append('from', options.from || `${this.mailgunFromName} <${this.mailgunFromEmail}>`);
      formData.append('to', Array.isArray(options.to) ? options.to.join(',') : options.to);
      formData.append('subject', options.subject);
      formData.append('html', options.html);

      if (options.text) {
        formData.append('text', options.text);
      }

      if (options.replyTo) {
        formData.append('h:Reply-To', options.replyTo);
      }

      if (options.attachments) {
        options.attachments.forEach((attachment) => {
          formData.append('attachment', attachment.content, {
            filename: attachment.filename,
            contentType: attachment.contentType,
          });
        });
      }

      const response = await fetch(`${this.mailgunApiUrl}/v3/${this.mailgunDomain}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`api:${this.mailgunApiKey}`).toString('base64')}`,
          ...formData.getHeaders(),
        },
        body: formData as any,
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error('Mailgun API error', new Error(error), {
          status: response.status,
          to: options.to,
          subject: options.subject,
        });
        return false;
      }

      const result = await response.json();
      logger.info('Email sent successfully', {
        to: options.to,
        subject: options.subject,
        messageId: result.id,
      });

      return true;
    } catch (error) {
      logger.error('Failed to send email', error as Error, {
        to: options.to,
        subject: options.subject,
      });
      return false;
    }
  }

  /**
   * Send email verification email
   */
  async sendVerificationEmail(email: string, token: string, userName?: string): Promise<void> {
    const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${token}`;

    await this.send({
      to: email,
      subject: 'Verify your email address',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verify Your Email</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
              <h1 style="color: #007bff; margin: 0;">Welcome ${userName ? ` ${userName}` : ''}!</h1>
            </div>

            <p>Thank you for signing up. Please verify your email address by clicking the button below:</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${verifyUrl}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Verify Email Address
              </a>
            </div>

            <p>Or copy and paste this link into your browser:</p>
            <p style="background-color: #f8f9fa; padding: 10px; border-radius: 3px; word-break: break-all;">
              ${verifyUrl}
            </p>

            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
            </p>

            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

            <p style="color: #999; font-size: 12px; text-align: center;">
              © ${new Date().getFullYear()} iCodeAI. All rights reserved.
            </p>
          </body>
        </html>
      `,
      text: `Welcome${
        userName ? ` ${userName}` : ''
      }!\n\nPlease verify your email address by visiting: ${verifyUrl}\n\nThis link will expire in 24 hours.`,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, token: string, userName?: string): Promise<void> {
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;

    await this.send({
      to: email,
      subject: 'Reset your password',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset Your Password</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
              <h1 style="color: #007bff; margin: 0;">Password Reset Request</h1>
            </div>

            <p>Hello${userName ? ` ${userName}` : ''},</p>

            <p>We received a request to reset your password. Click the button below to create a new password:</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Reset Password
              </a>
            </div>

            <p>Or copy and paste this link into your browser:</p>
            <p style="background-color: #f8f9fa; padding: 10px; border-radius: 3px; word-break: break-all;">
              ${resetUrl}
            </p>

            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
            </p>

            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

            <p style="color: #999; font-size: 12px; text-align: center;">
              © ${new Date().getFullYear()} iCodeAI. All rights reserved.
            </p>
          </body>
        </html>
      `,
      text: `Hello${
        userName ? ` ${userName}` : ''
      },\n\nWe received a request to reset your password. Visit this link to create a new password: ${resetUrl}\n\nThis link will expire in 1 hour.`,
    });
  }

  /**
   * Send welcome email with temporary password
   */
  async sendWelcomeEmail(
    email: string,
    temporaryPassword: string,
    userName?: string
  ): Promise<void> {
    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL}/login`;

    await this.send({
      to: email,
      subject: 'Welcome to iCodeAI',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to iCodeAI</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
              <h1 style="color: #007bff; margin: 0;">Welcome to iCodeAI!</h1>
            </div>

            <p>Hello${userName ? ` ${userName}` : ''},</p>

            <p>Your account has been created successfully. Here are your login credentials:</p>

            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
              <p style="margin: 5px 0;"><strong>Temporary Password:</strong> <code style="background-color: #fff; padding: 2px 6px; border-radius: 3px;">${temporaryPassword}</code></p>
            </div>

            <p style="color: #dc3545; font-weight: bold;">
              ⚠️ Please change your password after logging in for the first time.
            </p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Log In Now
              </a>
            </div>

            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

            <p style="color: #999; font-size: 12px; text-align: center;">
              © ${new Date().getFullYear()} iCodeAI. All rights reserved.
            </p>
          </body>
        </html>
      `,
      text: `Welcome to iCodeAI${
        userName ? `, ${userName}` : ''
      }!\n\nYour account has been created.\n\nEmail: ${email}\nTemporary Password: ${temporaryPassword}\n\n⚠️ Please change your password after logging in.\n\nLog in at: ${loginUrl}`,
    });
  }

  /**
   * Send 2FA code email
   */
  async send2FACode(email: string, code: string, userName?: string): Promise<void> {
    await this.send({
      to: email,
      subject: 'Your verification code',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Your Verification Code</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
              <h1 style="color: #007bff; margin: 0;">Verification Code</h1>
            </div>

            <p>Hello${userName ? ` ${userName}` : ''},</p>

            <p>Your verification code is:</p>

            <div style="text-align: center; margin: 30px 0;">
              <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #007bff; background-color: #f8f9fa; padding: 20px; border-radius: 5px; display: inline-block;">
                ${code}
              </div>
            </div>

            <p style="color: #666; font-size: 14px;">
              This code will expire in 10 minutes.
            </p>

            <p style="color: #dc3545; font-size: 14px;">
              If you didn't request this code, please ignore this email and ensure your account is secure.
            </p>

            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

            <p style="color: #999; font-size: 12px; text-align: center;">
              © ${new Date().getFullYear()} iCodeAI. All rights reserved.
            </p>
          </body>
        </html>
      `,
      text: `Hello${
        userName ? ` ${userName}` : ''
      },\n\nYour verification code is: ${code}\n\nThis code will expire in 10 minutes.`,
    });
  }
}

// Export singleton
export const emailService = new EmailService();
