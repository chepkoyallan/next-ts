/**
 * Email Templates
 * HTML email templates for common notifications
 */

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// Base template wrapper
const emailWrapper = (content: string, preheader?: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>iCodeAI</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      color: #333333;
      background-color: #f4f4f4;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px 20px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 28px;
      font-weight: 600;
    }
    .content {
      padding: 40px 30px;
    }
    .button {
      display: inline-block;
      padding: 14px 28px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 30px;
      text-align: center;
      font-size: 14px;
      color: #6c757d;
    }
    .preheader {
      display: none;
      max-height: 0;
      max-width: 0;
      opacity: 0;
      overflow: hidden;
    }
    @media only screen and (max-width: 600px) {
      .content {
        padding: 30px 20px !important;
      }
    }
  </style>
</head>
<body>
  ${preheader ? `<div class="preheader">${preheader}</div>` : ''}
  <div class="container">
    <div class="header">
      <h1>iCodeAI</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} iCodeAI. All rights reserved.</p>
      <p>
        <a href="{{unsubscribe_url}}" style="color: #667eea;">Unsubscribe</a> |
        <a href="https://icodeai.com/privacy" style="color: #667eea;">Privacy Policy</a>
      </p>
    </div>
  </div>
</body>
</html>
`;

// Welcome Email
export const welcomeEmail = (data: { name: string; loginUrl: string }): EmailTemplate => ({
  subject: 'Welcome to iCodeAI! 🎉',
  html: emailWrapper(
    `
    <h2>Welcome, ${data.name}!</h2>
    <p>Thank you for joining iCodeAI. We're excited to have you on board!</p>
    <p>With iCodeAI, you can:</p>
    <ul>
      <li>Build powerful workflow automations</li>
      <li>Execute complex data pipelines</li>
      <li>Manage projects and teams</li>
      <li>Monitor and analyze your workflows</li>
    </ul>
    <p>Get started by logging in to your account:</p>
    <a href="${data.loginUrl}" class="button">Go to Dashboard</a>
    <p>If you have any questions, our team is here to help!</p>
    <p>Best regards,<br>The iCodeAI Team</p>
  `,
    `Welcome to iCodeAI, ${data.name}!`
  ),
  text: `
Welcome, ${data.name}!

Thank you for joining iCodeAI. We're excited to have you on board!

With iCodeAI, you can:
- Build powerful workflow automations
- Execute complex data pipelines
- Manage projects and teams
- Monitor and analyze your workflows

Get started by logging in to your account: ${data.loginUrl}

If you have any questions, our team is here to help!

Best regards,
The iCodeAI Team
  `,
});

// Email Verification
export const emailVerificationEmail = (data: {
  name: string;
  verificationUrl: string;
}): EmailTemplate => ({
  subject: 'Verify your email address',
  html: emailWrapper(
    `
    <h2>Verify Your Email</h2>
    <p>Hi ${data.name},</p>
    <p>Thanks for signing up! Please verify your email address to get started with iCodeAI.</p>
    <a href="${data.verificationUrl}" class="button">Verify Email</a>
    <p>This link will expire in 24 hours.</p>
    <p>If you didn't create an account with iCodeAI, you can safely ignore this email.</p>
    <p>Best regards,<br>The iCodeAI Team</p>
  `,
    'Verify your iCodeAI account'
  ),
  text: `
Hi ${data.name},

Thanks for signing up! Please verify your email address to get started with iCodeAI.

Verify your email: ${data.verificationUrl}

This link will expire in 24 hours.

If you didn't create an account with iCodeAI, you can safely ignore this email.

Best regards,
The iCodeAI Team
  `,
});

// Password Reset
export const passwordResetEmail = (data: { name: string; resetUrl: string }): EmailTemplate => ({
  subject: 'Reset your password',
  html: emailWrapper(
    `
    <h2>Reset Your Password</h2>
    <p>Hi ${data.name},</p>
    <p>We received a request to reset your password. Click the button below to choose a new password:</p>
    <a href="${data.resetUrl}" class="button">Reset Password</a>
    <p>This link will expire in 1 hour.</p>
    <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
    <p>Best regards,<br>The iCodeAI Team</p>
  `,
    'Reset your iCodeAI password'
  ),
  text: `
Hi ${data.name},

We received a request to reset your password. Use the link below to choose a new password:

${data.resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

Best regards,
The iCodeAI Team
  `,
});

// Organization Invitation
export const organizationInvitationEmail = (data: {
  inviterName: string;
  organizationName: string;
  acceptUrl: string;
  role: string;
}): EmailTemplate => ({
  subject: `You've been invited to join ${data.organizationName}`,
  html: emailWrapper(
    `
    <h2>Organization Invitation</h2>
    <p>${data.inviterName} has invited you to join <strong>${data.organizationName}</strong> on iCodeAI.</p>
    <p>You'll join as a <strong>${data.role}</strong> and have access to the team's workflows and projects.</p>
    <a href="${data.acceptUrl}" class="button">Accept Invitation</a>
    <p>This invitation will expire in 7 days.</p>
    <p>If you don't want to join this organization, you can safely ignore this email.</p>
    <p>Best regards,<br>The iCodeAI Team</p>
  `,
    `Join ${data.organizationName} on iCodeAI`
  ),
  text: `
${data.inviterName} has invited you to join ${data.organizationName} on iCodeAI.

You'll join as a ${data.role} and have access to the team's workflows and projects.

Accept invitation: ${data.acceptUrl}

This invitation will expire in 7 days.

If you don't want to join this organization, you can safely ignore this email.

Best regards,
The iCodeAI Team
  `,
});

// Payment Success
export const paymentSuccessEmail = (data: {
  name: string;
  amount: string;
  plan: string;
  receiptUrl: string;
}): EmailTemplate => ({
  subject: 'Payment received - Thank you!',
  html: emailWrapper(
    `
    <h2>Payment Received</h2>
    <p>Hi ${data.name},</p>
    <p>Thank you for your payment! We've successfully received your payment of <strong>${data.amount}</strong> for the <strong>${data.plan}</strong> plan.</p>
    <p>Your subscription is now active and you have access to all features.</p>
    <a href="${data.receiptUrl}" class="button">View Receipt</a>
    <p>If you have any questions about your subscription, please don't hesitate to contact us.</p>
    <p>Best regards,<br>The iCodeAI Team</p>
  `,
    `Payment received - ${data.amount}`
  ),
  text: `
Hi ${data.name},

Thank you for your payment! We've successfully received your payment of ${data.amount} for the ${data.plan} plan.

Your subscription is now active and you have access to all features.

View receipt: ${data.receiptUrl}

If you have any questions about your subscription, please don't hesitate to contact us.

Best regards,
The iCodeAI Team
  `,
});

// Payment Failed
export const paymentFailedEmail = (data: {
  name: string;
  amount: string;
  plan: string;
  updateUrl: string;
  retryDate: string;
}): EmailTemplate => ({
  subject: 'Payment failed - Action required',
  html: emailWrapper(
    `
    <h2>Payment Failed</h2>
    <p>Hi ${data.name},</p>
    <p>We weren't able to process your payment of <strong>${data.amount}</strong> for the <strong>${data.plan}</strong> plan.</p>
    <p>To avoid any interruption to your service, please update your payment method:</p>
    <a href="${data.updateUrl}" class="button">Update Payment Method</a>
    <p>We'll automatically retry the payment on <strong>${data.retryDate}</strong>.</p>
    <p>If you have any questions, please contact our support team.</p>
    <p>Best regards,<br>The iCodeAI Team</p>
  `,
    'Payment failed - Update your payment method'
  ),
  text: `
Hi ${data.name},

We weren't able to process your payment of ${data.amount} for the ${data.plan} plan.

To avoid any interruption to your service, please update your payment method: ${data.updateUrl}

We'll automatically retry the payment on ${data.retryDate}.

If you have any questions, please contact our support team.

Best regards,
The iCodeAI Team
  `,
});

// Usage Alert
export const usageAlertEmail = (data: {
  name: string;
  resource: string;
  current: number;
  limit: number;
  percentage: number;
  upgradeUrl: string;
}): EmailTemplate => ({
  subject: `Usage Alert: ${data.percentage}% of ${data.resource} limit reached`,
  html: emailWrapper(
    `
    <h2>Usage Alert</h2>
    <p>Hi ${data.name},</p>
    <p>You've used <strong>${data.current}</strong> of your <strong>${data.limit}</strong> ${data.resource} (${data.percentage}%).</p>
    <p>To avoid any service interruption, consider upgrading your plan:</p>
    <a href="${data.upgradeUrl}" class="button">Upgrade Plan</a>
    <p>You can view your current usage and limits in your dashboard.</p>
    <p>Best regards,<br>The iCodeAI Team</p>
  `,
    `${data.percentage}% of ${data.resource} limit reached`
  ),
  text: `
Hi ${data.name},

You've used ${data.current} of your ${data.limit} ${data.resource} (${data.percentage}%).

To avoid any service interruption, consider upgrading your plan: ${data.upgradeUrl}

You can view your current usage and limits in your dashboard.

Best regards,
The iCodeAI Team
  `,
});

// Workflow Execution Failed
export const workflowExecutionFailedEmail = (data: {
  name: string;
  workflowName: string;
  executionId: string;
  error: string;
  detailsUrl: string;
}): EmailTemplate => ({
  subject: `Workflow execution failed: ${data.workflowName}`,
  html: emailWrapper(
    `
    <h2>Workflow Execution Failed</h2>
    <p>Hi ${data.name},</p>
    <p>Your workflow <strong>${data.workflowName}</strong> (${data.executionId}) has failed with the following error:</p>
    <p style="background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0; color: #721c24;">
      ${data.error}
    </p>
    <a href="${data.detailsUrl}" class="button">View Details</a>
    <p>You can review the execution logs and retry the workflow from your dashboard.</p>
    <p>Best regards,<br>The iCodeAI Team</p>
  `,
    `Workflow ${data.workflowName} failed`
  ),
  text: `
Hi ${data.name},

Your workflow "${data.workflowName}" (${data.executionId}) has failed with the following error:

${data.error}

View details: ${data.detailsUrl}

You can review the execution logs and retry the workflow from your dashboard.

Best regards,
The iCodeAI Team
  `,
});

// Security Alert
export const securityAlertEmail = (data: {
  name: string;
  event: string;
  timestamp: string;
  ip?: string;
  location?: string;
}): EmailTemplate => ({
  subject: 'Security Alert - New sign-in detected',
  html: emailWrapper(
    `
    <h2>Security Alert</h2>
    <p>Hi ${data.name},</p>
    <p>We detected a new sign-in to your iCodeAI account:</p>
    <ul>
      <li><strong>Event:</strong> ${data.event}</li>
      <li><strong>Time:</strong> ${data.timestamp}</li>
      ${data.ip ? `<li><strong>IP Address:</strong> ${data.ip}</li>` : ''}
      ${data.location ? `<li><strong>Location:</strong> ${data.location}</li>` : ''}
    </ul>
    <p>If this was you, you can safely ignore this email.</p>
    <p>If you don't recognize this activity, please secure your account immediately by changing your password.</p>
    <p>Best regards,<br>The iCodeAI Team</p>
  `,
    'New sign-in detected on your account'
  ),
  text: `
Hi ${data.name},

We detected a new sign-in to your iCodeAI account:

Event: ${data.event}
Time: ${data.timestamp}
${data.ip ? `IP Address: ${data.ip}` : ''}
${data.location ? `Location: ${data.location}` : ''}

If this was you, you can safely ignore this email.

If you don't recognize this activity, please secure your account immediately by changing your password.

Best regards,
The iCodeAI Team
  `,
});

// Subscription Canceled
export const subscriptionCanceledEmail = (data: {
  name: string;
  planName: string;
  accessEndDate: string;
  reactivateUrl: string;
}): EmailTemplate => ({
  subject: 'Subscription Canceled',
  html: emailWrapper(
    `
    <h2>Subscription Canceled</h2>
    <p>Hi ${data.name},</p>
    <p>We've processed your cancellation request for the <strong>${data.planName}</strong> plan.</p>
    <p style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
      <strong>Your access will continue until:</strong> ${data.accessEndDate}<br>
      After this date, your account will be downgraded to the FREE plan.
    </p>
    <p><strong>What happens next:</strong></p>
    <ul>
      <li>You'll retain full access to ${data.planName} features until ${data.accessEndDate}</li>
      <li>After this date, you'll be moved to the FREE plan with limited features</li>
      <li>Your data and projects will remain safe and accessible</li>
      <li>You can reactivate your subscription at any time</li>
    </ul>
    <p>Changed your mind? You can reactivate your subscription:</p>
    <a href="${data.reactivateUrl}" class="button">Reactivate Subscription</a>
    <p>We're sorry to see you go! If you have any feedback about why you canceled, we'd love to hear from you.</p>
    <p>Best regards,<br>The iCodeAI Team</p>
  `,
    `Your ${data.planName} subscription has been canceled`
  ),
  text: `
Hi ${data.name},

We've processed your cancellation request for the ${data.planName} plan.

Your access will continue until: ${data.accessEndDate}
After this date, your account will be downgraded to the FREE plan.

What happens next:
- You'll retain full access to ${data.planName} features until ${data.accessEndDate}
- After this date, you'll be moved to the FREE plan with limited features
- Your data and projects will remain safe and accessible
- You can reactivate your subscription at any time

Changed your mind? You can reactivate your subscription: ${data.reactivateUrl}

We're sorry to see you go! If you have any feedback about why you canceled, we'd love to hear from you.

Best regards,
The iCodeAI Team
  `,
});

// Usage Limit Reached
export const usageLimitReachedEmail = (data: {
  name: string;
  resource: string;
  limit: number;
  upgradeUrl: string;
  usageUrl: string;
}): EmailTemplate => ({
  subject: `Usage Limit Reached: ${data.resource}`,
  html: emailWrapper(
    `
    <h2>Usage Limit Reached</h2>
    <p>Hi ${data.name},</p>
    <p style="background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0; color: #721c24;">
      <strong>You've reached your limit of ${data.limit} ${data.resource}.</strong>
    </p>
    <p>To continue using ${data.resource}, you'll need to upgrade your plan.</p>
    <p><strong>What's blocked:</strong></p>
    <p>You won't be able to create new ${data.resource} until you upgrade or your usage resets at the start of your next billing period.</p>
    <a href="${data.upgradeUrl}" class="button">Upgrade Now</a>
    <p>You can view your detailed usage breakdown here:</p>
    <a href="${data.usageUrl}" style="color: #667eea; text-decoration: none;">View Usage Dashboard →</a>
    <p>Best regards,<br>The iCodeAI Team</p>
  `,
    `You've reached your ${data.resource} limit`
  ),
  text: `
Hi ${data.name},

You've reached your limit of ${data.limit} ${data.resource}.

To continue using ${data.resource}, you'll need to upgrade your plan.

What's blocked:
You won't be able to create new ${data.resource} until you upgrade or your usage resets at the start of your next billing period.

Upgrade now: ${data.upgradeUrl}

View your detailed usage breakdown: ${data.usageUrl}

Best regards,
The iCodeAI Team
  `,
});
