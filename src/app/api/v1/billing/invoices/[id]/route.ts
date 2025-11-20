// Individual invoice management and PDF generation
import { z } from 'zod';
import { NextResponse } from 'next/server';

import { prisma } from '@app/database';

import { logger } from '../../../../lib/utils/logger';
import { createApiHandler } from '../../../../lib/handlers/base';
import { commonSchemas } from '../../../../lib/utils/validation';
import { rateLimitConfigs } from '../../../../lib/middleware/rate-limit';
import { createErrorResponse, createSuccessResponse } from '../../../../lib/utils/response';

// Validation schemas
const paramsSchema = z.object({
  id: commonSchemas.id,
});

// API handler
const handler = createApiHandler(
  {
    auth: {
      required: true,
    },
    rateLimit: rateLimitConfigs.standard,
    allowedMethods: ['GET'],
    validation: {
      params: paramsSchema,
    },
  },
  {
    // Get invoice details (including PDF download)
    GET: async ({ routeParams, context, auth, request }) => {
      try {
        const invoiceId = routeParams.id;

        const invoice = await prisma.invoice.findUnique({
          where: { id: invoiceId },
          include: {
            billingAccount: {
              select: {
                id: true,
                name: true,
                email: true,
                organizationId: true,
                billingAddress: true,
              },
            },
            subscription: {
              select: {
                id: true,
                projectId: true,
                plan: {
                  select: {
                    name: true,
                    tier: true,
                  },
                },
              },
            },
            paymentHistory: {
              orderBy: {
                processedAt: 'desc',
              },
              take: 1,
            },
          },
        });

        if (!invoice) {
          return createErrorResponse(
            'RESOURCE_NOT_FOUND',
            { message: 'Invoice not found' },
            context.requestId
          );
        }

        // Check permissions - user must be member of the organization
        const userId = auth.user?.id || '';
        const isMember = await prisma.organizationMember.findFirst({
          where: {
            userId,
            organizationId: invoice.billingAccount.organizationId,
            isActive: true,
          },
        });

        const isAdmin =
          auth.user?.roles?.includes('system-admin') ||
          auth.user?.roles?.includes('super-admin') ||
          auth.user?.roles?.includes('admin');

        if (!isAdmin && !isMember) {
          return createErrorResponse(
            'FORBIDDEN',
            { message: 'You do not have access to this invoice' },
            context.requestId
          );
        }

        // Check if PDF is requested via query param
        const url = new URL(request.url);
        const format = url.searchParams.get('format');

        if (format === 'pdf') {
          // Generate PDF (simplified version - in production use a PDF library like pdfkit or puppeteer)
          const pdfData = generateInvoicePDF(invoice);

          return new NextResponse(new Uint8Array(pdfData), {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
            },
          });
        }

        logger.info('Invoice retrieved', {
          invoiceId,
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createSuccessResponse({ invoice }, 200, context.requestId);
      } catch (error) {
        logger.error('Failed to get invoice', error as Error, {
          invoiceId: routeParams.id,
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to get invoice' },
          context.requestId
        );
      }
    },
  }
);

// Simple PDF generation function (placeholder - replace with actual PDF library in production)
function generateInvoicePDF(invoice: any): Buffer {
  // This is a placeholder - in production, use a library like:
  // - @react-pdf/renderer
  // - pdfkit
  // - puppeteer (for HTML to PDF)

  const pdfContent = `
Invoice: ${invoice.invoiceNumber}
Date: ${invoice.createdAt}
Status: ${invoice.status}

Bill To:
${invoice.billingAccount.name}
${invoice.billingAccount.email}

Amount Due: $${invoice.total}
Subtotal: $${invoice.subtotal}
Tax: $${invoice.tax}
Total: $${invoice.total}

Payment Status: ${invoice.status}
${invoice.paidAt ? `Paid on: ${invoice.paidAt}` : 'Not paid'}

Thank you for your business!
  `;

  // Return as buffer (in production, this would be actual PDF binary data)
  return Buffer.from(pdfContent, 'utf-8');
}

export const GET = handler;
