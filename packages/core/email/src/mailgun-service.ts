/**
 * Mailgun Email Service
 * Production-ready email service using Mailgun API
 */

import FormData from 'form-data';
import Mailgun from 'mailgun.js';

import { logger } from '@app/utils/logger';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    data: Buffer | string;
    contentType?: string;
  }>;
  tags?: string[];
  headers?: Record<string, string>;
}

export interface TemplateEmailOptions {
  to: string | string[];
  template: string;
  variables: Record<string, any>;
  from?: string;
  subject?: string;
  tags?: string[];
}

export class MailgunService {
  private client: any;

  private domain!: string;

  private fromEmail!: string;

  private fromName!: string;

  private initialized: boolean = false;

  constructor() {
    const apiKey = process.env.MAILGUN_API_KEY;
    const domain = process.env.MAILGUN_DOMAIN;
    const fromEmail = process.env.MAILGUN_FROM_EMAIL || process.env.EMAIL_FROM;
    const fromName = process.env.MAILGUN_FROM_NAME || 'iCodeAI';

    if (!apiKey) {
      logger.warn('MAILGUN_API_KEY not configured. Email service will not work.');
      return;
    }

    if (!domain) {
      logger.warn('MAILGUN_DOMAIN not configured. Email service will not work.');
      return;
    }

    if (!fromEmail) {
      logger.warn('MAILGUN_FROM_EMAIL or EMAIL_FROM not configured. Using default.');
    }

    this.domain = domain;
    this.fromEmail = fromEmail || 'noreply@yourdomain.com';
    this.fromName = fromName;

    // Initialize Mailgun client
    const mailgun = new Mailgun(FormData);
    this.client = mailgun.client({
      username: 'api',
      key: apiKey,
      url: process.env.MAILGUN_API_URL || 'https://api.mailgun.net',
    });

    this.initialized = true;

    logger.info('Mailgun service initialized', {
      domain: this.domain,
      fromEmail: this.fromEmail,
    });
  }

  /**
   * Check if service is properly configured
   */
  isConfigured(): boolean {
    return this.initialized && !!this.client;
  }

  /**
   * Send a simple email
   */
  async sendEmail(options: EmailOptions): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      if (!this.isConfigured()) {
        logger.error('Mailgun service not configured', null, { requestId });
        return {
          success: false,
          error: 'Email service not configured',
        };
      }

      // Validate required fields
      if (!options.to) {
        return {
          success: false,
          error: 'Recipient email address is required',
        };
      }

      if (!options.subject) {
        return {
          success: false,
          error: 'Email subject is required',
        };
      }

      if (!options.html && !options.text) {
        return {
          success: false,
          error: 'Email body (html or text) is required',
        };
      }

      // Prepare email data
      const from = options.from || `${this.fromName} <${this.fromEmail}>`;
      const to = Array.isArray(options.to) ? options.to.join(',') : options.to;

      const messageData: any = {
        from,
        to,
        subject: options.subject,
      };

      if (options.html) {
        messageData.html = options.html;
      }

      if (options.text) {
        messageData.text = options.text;
      }

      if (options.cc) {
        messageData.cc = Array.isArray(options.cc) ? options.cc.join(',') : options.cc;
      }

      if (options.bcc) {
        messageData.bcc = Array.isArray(options.bcc) ? options.bcc.join(',') : options.bcc;
      }

      if (options.replyTo) {
        messageData['h:Reply-To'] = options.replyTo;
      }

      if (options.tags && options.tags.length > 0) {
        messageData['o:tag'] = options.tags;
      }

      if (options.headers) {
        Object.entries(options.headers).forEach(([key, value]) => {
          messageData[`h:${key}`] = value;
        });
      }

      if (options.attachments && options.attachments.length > 0) {
        messageData.attachment = options.attachments.map((att) => ({
          filename: att.filename,
          data: att.data,
          contentType: att.contentType,
        }));
      }

      logger.info('Sending email', {
        requestId,
        to: options.to,
        subject: options.subject,
        tags: options.tags,
      });

      // Send email
      const result = await this.client.messages.create(this.domain, messageData);

      const duration = Date.now() - startTime;
      logger.info('Email sent successfully', {
        requestId,
        messageId: result.id,
        duration,
      });

      return {
        success: true,
        messageId: result.id,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to send email', error as Error, {
        requestId,
        to: options.to,
        subject: options.subject,
        duration,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send email using Mailgun template
   */
  async sendTemplateEmail(options: TemplateEmailOptions): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      if (!this.isConfigured()) {
        logger.error('Mailgun service not configured', null, { requestId });
        return {
          success: false,
          error: 'Email service not configured',
        };
      }

      // Validate required fields
      if (!options.to) {
        return {
          success: false,
          error: 'Recipient email address is required',
        };
      }

      if (!options.template) {
        return {
          success: false,
          error: 'Template name is required',
        };
      }

      // Prepare email data
      const from = options.from || `${this.fromName} <${this.fromEmail}>`;
      const to = Array.isArray(options.to) ? options.to.join(',') : options.to;

      const messageData: any = {
        from,
        to,
        template: options.template,
        'h:X-Mailgun-Variables': JSON.stringify(options.variables),
      };

      if (options.subject) {
        messageData.subject = options.subject;
      }

      if (options.tags && options.tags.length > 0) {
        messageData['o:tag'] = options.tags;
      }

      logger.info('Sending template email', {
        requestId,
        to: options.to,
        template: options.template,
        tags: options.tags,
      });

      // Send email
      const result = await this.client.messages.create(this.domain, messageData);

      const duration = Date.now() - startTime;
      logger.info('Template email sent successfully', {
        requestId,
        messageId: result.id,
        template: options.template,
        duration,
      });

      return {
        success: true,
        messageId: result.id,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to send template email', error as Error, {
        requestId,
        to: options.to,
        template: options.template,
        duration,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Verify email domain configuration
   */
  async verifyDomain(): Promise<{
    success: boolean;
    verified?: boolean;
    details?: any;
    error?: string;
  }> {
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          error: 'Email service not configured',
        };
      }

      const domain = await this.client.domains.get(this.domain);

      logger.info('Domain verification checked', {
        domain: this.domain,
        state: domain.state,
      });

      return {
        success: true,
        verified: domain.state === 'active',
        details: {
          state: domain.state,
          created_at: domain.created_at,
          smtp_login: domain.smtp_login,
        },
      };
    } catch (error) {
      logger.error('Failed to verify domain', error as Error, {
        domain: this.domain,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get email statistics
   */
  async getStats(options?: { event?: string; start?: Date; end?: Date }): Promise<{
    success: boolean;
    stats?: any;
    error?: string;
  }> {
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          error: 'Email service not configured',
        };
      }

      const query: any = {
        event: options?.event || 'accepted',
      };

      if (options?.start) {
        query.begin = options.start.toISOString();
      }

      if (options?.end) {
        query.end = options.end.toISOString();
      }

      const stats = await this.client.stats.get(this.domain, query);

      logger.info('Email stats retrieved', {
        domain: this.domain,
        event: query.event,
      });

      return {
        success: true,
        stats,
      };
    } catch (error) {
      logger.error('Failed to get email stats', error as Error, {
        domain: this.domain,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Validate email address
   */
  async validateEmail(email: string): Promise<{
    success: boolean;
    valid?: boolean;
    details?: any;
    error?: string;
  }> {
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          error: 'Email service not configured',
        };
      }

      const validation = await this.client.validate.get(email);

      logger.info('Email validated', {
        email,
        valid: validation.is_valid,
      });

      return {
        success: true,
        valid: validation.is_valid,
        details: {
          is_disposable: validation.is_disposable_address,
          is_role: validation.is_role_address,
          reason: validation.reason,
          risk: validation.risk,
        },
      };
    } catch (error) {
      logger.error('Failed to validate email', error as Error, {
        email,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Export singleton instance
export const mailgunService = new MailgunService();
