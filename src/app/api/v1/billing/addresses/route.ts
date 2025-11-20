// Billing Addresses Management API
import { z } from 'zod';

import { prisma } from '@app/database';

import { logger } from '../../../lib/utils/logger';
import { createApiHandler } from '../../../lib/handlers/base';
import { rateLimitConfigs } from '../../../lib/middleware/rate-limit';
import { createErrorResponse, createSuccessResponse } from '../../../lib/utils/response';

// Validation schemas
const listAddressesSchema = z.object({
  billingAccountId: z.string().optional(),
  userId: z.string().optional(),
});

const createAddressSchema = z.object({
  billingAccountId: z.string().optional(),
  userId: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  line1: z.string().min(1, 'Address line 1 is required'),
  line2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().optional(),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().min(2, 'Country is required'),
  phoneNumber: z.string().optional(),
  isDefault: z.boolean().default(false),
});

// API handler
const handler = createApiHandler(
  {
    auth: {
      required: true,
    },
    rateLimit: rateLimitConfigs.standard,
    allowedMethods: ['GET', 'POST'],
  },
  {
    // List addresses
    GET: async ({ request, context, auth }) => {
      try {
        // Extract query parameters from URL
        const url = new URL(request.url);
        const queryParams = Object.fromEntries(url.searchParams.entries());

        const validation = listAddressesSchema.safeParse(queryParams);
        if (!validation.success) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            {
              message: 'Invalid query parameters',
              errors: validation.error.issues,
            },
            context.requestId
          );
        }

        const { billingAccountId, userId } = validation.data;
        const currentUserId = auth.user?.id || '';

        // Build where clause based on access
        const where: any = {};

        if (billingAccountId) {
          // Check if user has access to this billing account
          const billingAccount = await prisma.billingAccount.findUnique({
            where: { id: billingAccountId },
          });

          if (!billingAccount) {
            return createErrorResponse(
              'RESOURCE_NOT_FOUND',
              { message: 'Billing account not found' },
              context.requestId
            );
          }

          const isMember = await prisma.organizationMember.findFirst({
            where: {
              userId: currentUserId,
              organizationId: billingAccount.organizationId,
              isActive: true,
            },
          });

          if (!isMember) {
            return createErrorResponse(
              'FORBIDDEN',
              { message: 'Access denied to billing account' },
              context.requestId
            );
          }

          where.billingAccountId = billingAccountId;
        } else if (userId) {
          // Only allow access to own addresses
          if (userId !== currentUserId) {
            return createErrorResponse(
              'FORBIDDEN',
              { message: 'Access denied' },
              context.requestId
            );
          }
          where.userId = userId;
        } else {
          // Default to current user's addresses
          where.userId = currentUserId;
        }

        const addresses = await prisma.billingAddress.findMany({
          where,
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        });

        logger.info('Billing addresses listed', {
          count: addresses.length,
          userId: currentUserId,
          billingAccountId,
          requestId: context.requestId,
        });

        return createSuccessResponse(
          {
            addresses,
            total: addresses.length,
          },
          200,
          context.requestId
        );
      } catch (error) {
        logger.error('Failed to list billing addresses', error as Error, {
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to list billing addresses' },
          context.requestId
        );
      }
    },

    // Create address
    POST: async ({ body, context, auth }) => {
      try {
        const validation = createAddressSchema.safeParse(body);
        if (!validation.success) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            {
              message: 'Invalid request data',
              errors: validation.error.issues,
            },
            context.requestId
          );
        }

        const { billingAccountId, userId, isDefault, ...addressData } = validation.data;
        const currentUserId = auth.user?.id || '';

        // Verify access
        if (billingAccountId) {
          const billingAccount = await prisma.billingAccount.findUnique({
            where: { id: billingAccountId },
          });

          if (!billingAccount) {
            return createErrorResponse(
              'RESOURCE_NOT_FOUND',
              { message: 'Billing account not found' },
              context.requestId
            );
          }

          const isMember = await prisma.organizationMember.findFirst({
            where: {
              userId: currentUserId,
              organizationId: billingAccount.organizationId,
              isActive: true,
            },
          });

          if (!isMember) {
            return createErrorResponse(
              'FORBIDDEN',
              { message: 'Access denied to billing account' },
              context.requestId
            );
          }
        } else if (userId && userId !== currentUserId) {
          return createErrorResponse('FORBIDDEN', { message: 'Access denied' }, context.requestId);
        }

        // If setting as default, unset other defaults
        if (isDefault) {
          const where: any = {};
          if (billingAccountId) {
            where.billingAccountId = billingAccountId;
          } else {
            where.userId = userId || currentUserId;
          }

          await prisma.billingAddress.updateMany({
            where,
            data: { isDefault: false },
          });
        }

        // Create address
        const address = await prisma.billingAddress.create({
          data: {
            ...addressData,
            billingAccountId,
            userId: userId || currentUserId,
            isDefault,
          },
        });

        logger.info('Billing address created', {
          addressId: address.id,
          billingAccountId,
          userId: currentUserId,
          requestId: context.requestId,
        });

        return createSuccessResponse(
          {
            address,
          },
          201,
          context.requestId
        );
      } catch (error) {
        logger.error('Failed to create billing address', error as Error, {
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to create billing address' },
          context.requestId
        );
      }
    },
  }
);

export const GET = handler;
export const POST = handler;
