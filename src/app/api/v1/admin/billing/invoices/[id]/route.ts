/**
 * Admin API - Single Invoice Management
 * Get and manage individual invoices
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from 'src/app/api/lib/auth/admin-middleware';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: {
    id: string;
  };
}

const InvoiceUpdateSchema = z.object({
  status: z.enum(['DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE']).optional(),
  paidAt: z
    .string()
    .transform((v) => new Date(v))
    .optional(),
  notes: z.string().optional(),
});

/**
 * GET /api/v1/admin/billing/invoices/:id
 * Get detailed invoice information
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const adminContext = await requireAdmin(request, {
      requiredRole: 'system-admin',
      auditLog: true,
    });

    if (adminContext instanceof NextResponse) {
      return adminContext;
    }

    const { prisma } = await import('src/lib/prisma');
    const invoiceId = params.id;

    // Get invoice with full details
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        subscription: {
          include: {
            plan: {
              select: {
                id: true,
                name: true,
                tier: true,
                pricing: true,
              },
            },
            billingAccount: {
              include: {
                organization: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
        // invoiceItems: {  // Relation doesn't exist in Prisma schema
        //   orderBy: { createdAt: 'asc' },
        // },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invoice not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        invoice: {
          ...invoice,
          organization: (invoice as any).subscription?.billingAccount?.organization,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch invoice',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/admin/billing/invoices/:id
 * Update invoice details (status, notes, etc.)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const adminContext = await requireAdmin(request, {
      requiredRole: 'super-admin',
      auditLog: true,
    });

    if (adminContext instanceof NextResponse) {
      return adminContext;
    }

    const { prisma } = await import('src/lib/prisma');
    const invoiceId = params.id;

    // Validate request body
    const body = await request.json();
    const validatedData = InvoiceUpdateSchema.parse(body);

    // Check if invoice exists
    const existing = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        subscription: {
          include: {
            billingAccount: {
              include: {
                organization: true,
              },
            },
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invoice not found',
        },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};

    if (validatedData.status) {
      updateData.status = validatedData.status;

      // Auto-set paidAt when marking as paid
      if (validatedData.status === 'PAID' && !existing.paidAt) {
        updateData.paidAt = new Date();
      }
    }

    if (validatedData.paidAt) {
      updateData.paidAt = validatedData.paidAt;
    }

    if (validatedData.notes !== undefined) {
      updateData.metadata = {
        ...(existing.metadata as any),
        notes: validatedData.notes,
        lastModifiedBy: adminContext.userId,
        lastModifiedAt: new Date().toISOString(),
      };
    }

    // Update invoice
    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: updateData,
      include: {
        subscription: {
          include: {
            plan: true,
            billingAccount: {
              include: {
                organization: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: { invoice: updated },
      message: 'Invoice updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    console.error('Error updating invoice:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update invoice',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/admin/billing/invoices/:id
 * Void an invoice (soft delete - mark as VOID)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const adminContext = await requireAdmin(request, {
      requiredRole: 'super-admin',
      auditLog: true,
    });

    if (adminContext instanceof NextResponse) {
      return adminContext;
    }

    const { prisma } = await import('src/lib/prisma');
    const invoiceId = params.id;

    // Check if invoice exists
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        subscription: {
          include: {
            billingAccount: {
              include: {
                organization: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invoice not found',
        },
        { status: 404 }
      );
    }

    // Don't void already paid invoices
    if (invoice.status === 'PAID') {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot void a paid invoice. Please issue a refund instead.',
        },
        { status: 400 }
      );
    }

    // Mark as void
    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'VOID',
        metadata: {
          ...(invoice.metadata as any),
          voidedBy: adminContext.userId,
          voidedByEmail: adminContext.email,
          voidedAt: new Date().toISOString(),
        },
      },
      include: {
        subscription: {
          include: {
            billingAccount: {
              include: {
                organization: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: { invoice: updated },
      message: 'Invoice voided successfully',
    });
  } catch (error) {
    console.error('Error voiding invoice:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to void invoice',
      },
      { status: 500 }
    );
  }
}
