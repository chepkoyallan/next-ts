/**
 * Admin API - Invoice Management
 * View and manage invoices across all organizations
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from 'src/app/api/lib/auth/admin-middleware';

const InvoiceQuerySchema = z.object({
  organizationId: z.string().optional(),
  status: z.enum(['DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE']).optional(),
  limit: z.string().transform(Number).optional(),
  offset: z.string().transform(Number).optional(),
});

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/admin/billing/invoices
 * List all invoices with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const adminContext = await requireAdmin(request, {
      requiredRole: 'system-admin',
      auditLog: true,
    });

    if (adminContext instanceof NextResponse) {
      return adminContext;
    }

    const { prisma } = await import('src/lib/prisma');

    // Parse and validate query parameters
    const { searchParams } = request.nextUrl;
    const queryParams = Object.fromEntries(searchParams.entries());
    const validatedQuery = InvoiceQuerySchema.parse(queryParams);

    // Build where clause
    const where: any = {};

    if (validatedQuery.organizationId) {
      where.subscription = {
        organizationId: validatedQuery.organizationId,
      };
    }

    if (validatedQuery.status) {
      where.status = validatedQuery.status;
    }

    // Get total count
    const total = await prisma.invoice.count({ where });

    // Get invoices with related data
    const invoices = await prisma.invoice.findMany({
      where,
      take: validatedQuery.limit || 50,
      skip: validatedQuery.offset || 0,
      orderBy: { createdAt: 'desc' },
      include: {
        subscription: {
          include: {
            // organization: {  // Relation doesn't exist in Subscription
            //   select: {
            //     id: true,
            //     name: true,
            //   },
            // },
            plan: {
              select: {
                name: true,
                tier: true,
              },
            },
          },
        },
      },
    });

    // Calculate revenue metrics
    // @ts-ignore - amountPaid may not exist in Prisma schema
    const totalRevenue = invoices
      .filter((inv) => inv.status === 'PAID')
      .reduce((sum, inv: any) => sum + (inv.amountPaid || 0), 0);

    // @ts-ignore - amountDue/amountPaid may not exist in Prisma schema
    const pendingRevenue = invoices
      .filter((inv) => inv.status === 'OPEN')
      .reduce((sum, inv: any) => sum + ((inv.amountDue || 0) - (inv.amountPaid || 0)), 0);

    return NextResponse.json({
      success: true,
      data: {
        invoices,
        pagination: {
          total,
          limit: validatedQuery.limit || 50,
          offset: validatedQuery.offset || 0,
        },
        metrics: {
          totalRevenue,
          pendingRevenue,
          totalInvoices: total,
        },
      },
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

    console.error('Error listing invoices:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list invoices',
      },
      { status: 500 }
    );
  }
}
