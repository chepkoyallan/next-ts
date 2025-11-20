/**
 * Email Manager
 * High-level email sending utilities that use Mailgun service and templates
 */

import { logger } from '../../utils/logger';
import { mailgunService } from './mailgun-service';
import {
  welcomeEmail,
  usageAlertEmail,
  passwordResetEmail,
  paymentFailedEmail,
  securityAlertEmail,
  paymentSuccessEmail,
  emailVerificationEmail,
  organizationInvitationEmail,
  workflowExecutionFailedEmail,
} from './templates';

/**
 * Base URL for the application (used in email links)
 */
const getBaseUrl = (): string => {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:8082';
};

/**
 * Send welcome email to new users
 */
export async function sendWelcomeEmail(
  to: string,
  data: {
    name: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const loginUrl = `${getBaseUrl()}/auth/login`;
    const template = welcomeEmail({ name: data.name, loginUrl });

    const result = await mailgunService.sendEmail({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
      tags: ['welcome', 'onboarding'],
    });

    if (result.success) {
      logger.info('Welcome email sent', { to, name: data.name });
    }

    return result;
  } catch (error) {
    logger.error('Failed to send welcome email', error as Error, { to });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send email verification link
 */
export async function sendEmailVerification(
  to: string,
  data: {
    name: string;
    verificationToken: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const verificationUrl = `${getBaseUrl()}/auth/verify-email?token=${data.verificationToken}`;
    const template = emailVerificationEmail({ name: data.name, verificationUrl });

    const result = await mailgunService.sendEmail({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
      tags: ['verification', 'security'],
    });

    if (result.success) {
      logger.info('Email verification sent', { to, name: data.name });
    }

    return result;
  } catch (error) {
    logger.error('Failed to send email verification', error as Error, { to });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send password reset link
 */
export async function sendPasswordReset(
  to: string,
  data: {
    name: string;
    resetToken: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const resetUrl = `${getBaseUrl()}/auth/reset-password?token=${data.resetToken}`;
    const template = passwordResetEmail({ name: data.name, resetUrl });

    const result = await mailgunService.sendEmail({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
      tags: ['password-reset', 'security'],
    });

    if (result.success) {
      logger.info('Password reset email sent', { to, name: data.name });
    }

    return result;
  } catch (error) {
    logger.error('Failed to send password reset', error as Error, { to });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send organization invitation
 */
export async function sendOrganizationInvitation(
  to: string,
  data: {
    inviterName: string;
    organizationName: string;
    invitationToken: string;
    role: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const acceptUrl = `${getBaseUrl()}/organization/accept-invitation?token=${
      data.invitationToken
    }`;
    const template = organizationInvitationEmail({
      inviterName: data.inviterName,
      organizationName: data.organizationName,
      acceptUrl,
      role: data.role,
    });

    const result = await mailgunService.sendEmail({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
      tags: ['invitation', 'organization'],
    });

    if (result.success) {
      logger.info('Organization invitation sent', {
        to,
        organizationName: data.organizationName,
        role: data.role,
      });
    }

    return result;
  } catch (error) {
    logger.error('Failed to send organization invitation', error as Error, { to });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send payment success confirmation
 */
export async function sendPaymentSuccess(
  to: string,
  data: {
    name: string;
    amount: string;
    plan: string;
    invoiceId: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const receiptUrl = `${getBaseUrl()}/billing/invoices/${data.invoiceId}`;
    const template = paymentSuccessEmail({
      name: data.name,
      amount: data.amount,
      plan: data.plan,
      receiptUrl,
    });

    const result = await mailgunService.sendEmail({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
      tags: ['payment', 'billing', 'success'],
    });

    if (result.success) {
      logger.info('Payment success email sent', { to, amount: data.amount, plan: data.plan });
    }

    return result;
  } catch (error) {
    logger.error('Failed to send payment success email', error as Error, { to });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send payment failure alert
 */
export async function sendPaymentFailed(
  to: string,
  data: {
    name: string;
    amount: string;
    plan: string;
    retryDate: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const updateUrl = `${getBaseUrl()}/billing/payment-methods`;
    const template = paymentFailedEmail({
      name: data.name,
      amount: data.amount,
      plan: data.plan,
      updateUrl,
      retryDate: data.retryDate,
    });

    const result = await mailgunService.sendEmail({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
      tags: ['payment', 'billing', 'failure'],
    });

    if (result.success) {
      logger.info('Payment failed email sent', { to, amount: data.amount, plan: data.plan });
    }

    return result;
  } catch (error) {
    logger.error('Failed to send payment failed email', error as Error, { to });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send usage alert when approaching limits
 */
export async function sendUsageAlert(
  to: string,
  data: {
    name: string;
    resource: string;
    current: number;
    limit: number;
    percentage: number;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const upgradeUrl = `${getBaseUrl()}/billing/plans`;
    const template = usageAlertEmail({
      name: data.name,
      resource: data.resource,
      current: data.current,
      limit: data.limit,
      percentage: data.percentage,
      upgradeUrl,
    });

    const result = await mailgunService.sendEmail({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
      tags: ['usage', 'alert', 'limits'],
    });

    if (result.success) {
      logger.info('Usage alert email sent', {
        to,
        resource: data.resource,
        percentage: data.percentage,
      });
    }

    return result;
  } catch (error) {
    logger.error('Failed to send usage alert email', error as Error, { to });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send workflow execution failure notification
 */
export async function sendWorkflowExecutionFailed(
  to: string,
  data: {
    name: string;
    workflowName: string;
    executionId: string;
    error: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const detailsUrl = `${getBaseUrl()}/workflows/executions/${data.executionId}`;
    const template = workflowExecutionFailedEmail({
      name: data.name,
      workflowName: data.workflowName,
      executionId: data.executionId,
      error: data.error,
      detailsUrl,
    });

    const result = await mailgunService.sendEmail({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
      tags: ['workflow', 'execution', 'failure'],
    });

    if (result.success) {
      logger.info('Workflow execution failed email sent', {
        to,
        workflowName: data.workflowName,
        executionId: data.executionId,
      });
    }

    return result;
  } catch (error) {
    logger.error('Failed to send workflow execution failed email', error as Error, { to });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send security alert for suspicious activity
 */
export async function sendSecurityAlert(
  to: string,
  data: {
    name: string;
    event: string;
    timestamp: string;
    ip?: string;
    location?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const template = securityAlertEmail({
      name: data.name,
      event: data.event,
      timestamp: data.timestamp,
      ip: data.ip,
      location: data.location,
    });

    const result = await mailgunService.sendEmail({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
      tags: ['security', 'alert'],
    });

    if (result.success) {
      logger.logSecurity('Security alert email sent', 'medium', {
        to,
        event: data.event,
        ip: data.ip,
      });
    }

    return result;
  } catch (error) {
    logger.error('Failed to send security alert email', error as Error, { to });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Batch send emails (useful for notifications to multiple users)
 */
export async function sendBulkEmails(
  emails: Array<{
    to: string;
    type:
      | 'welcome'
      | 'verification'
      | 'password-reset'
      | 'invitation'
      | 'payment-success'
      | 'payment-failed'
      | 'usage-alert'
      | 'workflow-failed'
      | 'security-alert';
    data: any;
  }>
): Promise<{
  success: number;
  failed: number;
  results: Array<{ to: string; success: boolean; error?: string }>;
}> {
  const results = await Promise.allSettled(
    emails.map(async (email) => {
      let result: { success: boolean; error?: string };

      switch (email.type) {
        case 'welcome':
          result = await sendWelcomeEmail(email.to, email.data);
          break;
        case 'verification':
          result = await sendEmailVerification(email.to, email.data);
          break;
        case 'password-reset':
          result = await sendPasswordReset(email.to, email.data);
          break;
        case 'invitation':
          result = await sendOrganizationInvitation(email.to, email.data);
          break;
        case 'payment-success':
          result = await sendPaymentSuccess(email.to, email.data);
          break;
        case 'payment-failed':
          result = await sendPaymentFailed(email.to, email.data);
          break;
        case 'usage-alert':
          result = await sendUsageAlert(email.to, email.data);
          break;
        case 'workflow-failed':
          result = await sendWorkflowExecutionFailed(email.to, email.data);
          break;
        case 'security-alert':
          result = await sendSecurityAlert(email.to, email.data);
          break;
        default:
          result = { success: false, error: 'Unknown email type' };
      }

      return { to: email.to, ...result };
    })
  );

  const processedResults = results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return {
      to: emails[index].to,
      success: false,
      error: result.reason?.message || 'Unknown error',
    };
  });

  const success = processedResults.filter((r) => r.success).length;
  const failed = processedResults.filter((r) => !r.success).length;

  logger.info('Bulk email send completed', { total: emails.length, success, failed });

  return {
    success,
    failed,
    results: processedResults,
  };
}
