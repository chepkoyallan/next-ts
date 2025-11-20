// Billing Address Detail API
import { z } from 'zod';

import { prisma } from '@app/database';

import { logger } from '../../../../lib/utils/logger';
import { createApiHandler } from '../../../../lib/handlers/base';
import { rateLimitConfigs } from '../../../../lib/middleware/rate-limit';
import { createErrorResponse, createSuccessResponse } from '../../../../lib/utils/response';

// Validation schemas
const updateAddressSchema = z.object({
  name: z.string().min(1).optional(),
  line1: z.string().min(1).optional(),
  line2: z.string().optional(),
  city: z.string().min(1).optional(),
  state: z.string().optional(),
  postalCode: z.string().min(1).optional(),
  country: z.string().min(2).optional(),
  phoneNumber: z.string().optional(),
  isDefault: z.boolean().optional(),
});

// API handler
const handler = createApiHandler(
  {
    auth: {
      required: true,
    },
    rateLimit: rateLimitConfigs.standard,
    allowedMethods: ['GET', 'PUT', 'DELETE'],
  },
  {
    // Get address
    GET: async ({ request, context, auth }) => {
      try {
        const addressId = request.url.split('/').pop();
        if (!addressId) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            { message: 'Address ID is required' },
            context.requestId
          );
        }

        const address = await prisma.billingAddress.findUnique({
          where: { id: addressId },
        });

        if (!address) {
          return createErrorResponse(
            'RESOURCE_NOT_FOUND',
            { message: 'Address not found' },
            context.requestId
          );
        }

        // Check access
        const currentUserId = auth.user?.id || '';
        let hasAccess = false;

        if (address.userId === currentUserId) {
          hasAccess = true;
        } else if (address.billingAccountId) {
          const billingAccount = await prisma.billingAccount.findUnique({
            where: { id: address.billingAccountId },
          });

          if (billingAccount) {
            const isMember = await prisma.organizationMember.findFirst({
              where: {
                userId: currentUserId,
                organizationId: billingAccount.organizationId,
                isActive: true,
              },
            });

            if (isMember) {
              hasAccess = true;
            }
          }
        }

        if (!hasAccess) {
          return createErrorResponse('FORBIDDEN', { message: 'Access denied' }, context.requestId);
        }

        return createSuccessResponse(
          {
            address,
          },
          200,
          context.requestId
        );
      } catch (error) {
        logger.error('Failed to get billing address', error as Error, {
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to get billing address' },
          context.requestId
        );
      }
    },

    // Update address
    PUT: async ({ request, body, context, auth }) => {
      try {
        const addressId = request.url.split('/').pop();
        if (!addressId) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            { message: 'Address ID is required' },
            context.requestId
          );
        }

        const validation = updateAddressSchema.safeParse(body);
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

        const address = await prisma.billingAddress.findUnique({
          where: { id: addressId },
        });

        if (!address) {
          return createErrorResponse(
            'RESOURCE_NOT_FOUND',
            { message: 'Address not found' },
            context.requestId
          );
        }

        // Check access
        const currentUserId = auth.user?.id || '';
        let hasAccess = false;

        if (address.userId === currentUserId) {
          hasAccess = true;
        } else if (address.billingAccountId) {
          const billingAccount = await prisma.billingAccount.findUnique({
            where: { id: address.billingAccountId },
          });

          if (billingAccount) {
            const isMember = await prisma.organizationMember.findFirst({
              where: {
                userId: currentUserId,
                organizationId: billingAccount.organizationId,
                isActive: true,
              },
            });

            if (isMember) {
              hasAccess = true;
            }
          }
        }

        if (!hasAccess) {
          return createErrorResponse('FORBIDDEN', { message: 'Access denied' }, context.requestId);
        }

        // If setting as default, unset other defaults
        if (validation.data.isDefault) {
          const where: any = {};
          if (address.billingAccountId) {
            where.billingAccountId = address.billingAccountId;
          } else if (address.userId) {
            where.userId = address.userId;
          }

          await prisma.billingAddress.updateMany({
            where: {
              ...where,
              id: { not: addressId },
            },
            data: { isDefault: false },
          });
        }

        // Update address
        const updatedAddress = await prisma.billingAddress.update({
          where: { id: addressId },
          data: validation.data,
        });

        logger.info('Billing address updated', {
          addressId,
          userId: currentUserId,
          requestId: context.requestId,
        });

        return createSuccessResponse(
          {
            address: updatedAddress,
          },
          200,
          context.requestId
        );
      } catch (error) {
        logger.error('Failed to update billing address', error as Error, {
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to update billing address' },
          context.requestId
        );
      }
    },

    // Delete address
    DELETE: async ({ request, context, auth }) => {
      try {
        const addressId = request.url.split('/').pop();
        if (!addressId) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            { message: 'Address ID is required' },
            context.requestId
          );
        }

        const address = await prisma.billingAddress.findUnique({
          where: { id: addressId },
        });

        if (!address) {
          return createErrorResponse(
            'RESOURCE_NOT_FOUND',
            { message: 'Address not found' },
            context.requestId
          );
        }

        // Check access
        const currentUserId = auth.user?.id || '';
        let hasAccess = false;

        if (address.userId === currentUserId) {
          hasAccess = true;
        } else if (address.billingAccountId) {
          const billingAccount = await prisma.billingAccount.findUnique({
            where: { id: address.billingAccountId },
          });

          if (billingAccount) {
            const isMember = await prisma.organizationMember.findFirst({
              where: {
                userId: currentUserId,
                organizationId: billingAccount.organizationId,
                isActive: true,
              },
            });

            if (isMember) {
              hasAccess = true;
            }
          }
        }

        if (!hasAccess) {
          return createErrorResponse('FORBIDDEN', { message: 'Access denied' }, context.requestId);
        }

        await prisma.billingAddress.delete({
          where: { id: addressId },
        });

        logger.info('Billing address deleted', {
          addressId,
          userId: currentUserId,
          requestId: context.requestId,
        });

        return createSuccessResponse(
          {
            message: 'Address deleted successfully',
          },
          200,
          context.requestId
        );
      } catch (error) {
        logger.error('Failed to delete billing address', error as Error, {
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to delete billing address' },
          context.requestId
        );
      }
    },
  }
);

export const GET = handler;
export const PUT = handler;
export const DELETE = handler;
