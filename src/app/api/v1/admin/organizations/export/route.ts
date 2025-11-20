/**
 * Admin API - Organizations Export
 * Export organizations data in various formats
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from 'src/app/api/lib/auth/admin-middleware';

const ExportQuerySchema = z.object({
  format: z.enum(['csv', 'json']).default('csv'),
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']).optional(),
});

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/admin/organizations/export
 * Export organizations data
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

    // Parse query parameters
    const { searchParams } = request.nextUrl;
    const queryParams = Object.fromEntries(searchParams.entries());
    const validatedQuery = ExportQuerySchema.parse(queryParams);

    // Build where clause
    const where: any = {};

    if (validatedQuery.search) {
      where.OR = [
        { name: { contains: validatedQuery.search, mode: 'insensitive' } },
        { domain: { contains: validatedQuery.search, mode: 'insensitive' } },
        { email: { contains: validatedQuery.search, mode: 'insensitive' } },
      ];
    }

    if (validatedQuery.status) {
      where.status = validatedQuery.status;
    }

    // ⚡ Performance: Use streaming export to prevent memory issues
    const BATCH_SIZE = 100;

    // Helper function to format CSV row
    const formatCsvRow = (row: string[]) =>
      row
        .map((cell) => {
          const cellStr = String(cell);
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        })
        .join(',');

    // Helper function to convert organization to CSV row
    const orgToCsvRow = (org: any) => [
      org.id,
      org.name,
      org.slug || '',
      org.domain || '',
      org.email || '',
      org.status,
      org.size || '',
      org.industry || '',
      org._count?.users?.toString() || '0',
      org._count?.projects?.toString() || '0',
      org.subscriptions?.length?.toString() || '0',
      org.subscriptions?.[0]?.plan?.name || 'None',
      new Date(org.createdAt).toISOString(),
    ];

    if (validatedQuery.format === 'json') {
      // ⚡ JSON streaming export
      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        async start(controller) {
          // Recursive function to process batches
          const processBatch = async (
            skip: number,
            totalCount: number,
            first: boolean
          ): Promise<number> => {
            const batch = await prisma.organization.findMany({
              where,
              include: {
                _count: {
                  select: {
                    projects: true,
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
              take: BATCH_SIZE,
              skip,
            });

            if (batch.length === 0) {
              return totalCount;
            }

            let isFirst = first;
            let count = totalCount;

            for (let i = 0; i < batch.length; i += 1) {
              const org = batch[i];
              if (!isFirst) {
                controller.enqueue(encoder.encode(','));
              }
              isFirst = false;
              controller.enqueue(encoder.encode(JSON.stringify(org)));
              count += 1;
            }

            if (batch.length < BATCH_SIZE) {
              return count;
            }

            return processBatch(skip + BATCH_SIZE, count, isFirst);
          };

          try {
            // Start JSON array
            controller.enqueue(encoder.encode('{"success":true,"data":['));

            const totalCount = await processBatch(0, 0, true);

            // End JSON with metadata
            controller.enqueue(
              encoder.encode(`],"exportedAt":"${new Date().toISOString()}","total":${totalCount}}`)
            );
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });

      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="organizations-${
            new Date().toISOString().split('T')[0]
          }.json"`,
        },
      });
    }

    // ⚡ CSV streaming export
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        // Recursive function to process CSV batches
        const processCsvBatch = async (skip: number): Promise<void> => {
          const batch = await prisma.organization.findMany({
            where,
            include: {
              _count: {
                select: {
                  projects: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: BATCH_SIZE,
            skip,
          });

          if (batch.length === 0) {
            return undefined;
          }

          for (let i = 0; i < batch.length; i += 1) {
            const org = batch[i];
            const row = orgToCsvRow(org);
            controller.enqueue(encoder.encode(`${formatCsvRow(row)}\n`));
          }

          if (batch.length < BATCH_SIZE) {
            return undefined;
          }

          return processCsvBatch(skip + BATCH_SIZE);
        };

        try {
          // Send CSV header
          const headerRow = [
            'ID',
            'Name',
            'Slug',
            'Domain',
            'Email',
            'Status',
            'Size',
            'Industry',
            'Users',
            'Projects',
            'Subscriptions',
            'Current Plan',
            'Created At',
          ];
          controller.enqueue(encoder.encode(`${formatCsvRow(headerRow)}\n`));

          await processCsvBatch(0);

          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="organizations-${
          new Date().toISOString().split('T')[0]
        }.csv"`,
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

    console.error('Error exporting organizations:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export organizations',
      },
      { status: 500 }
    );
  }
}
