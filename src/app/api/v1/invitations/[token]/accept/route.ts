// Accept Organization Invitation
import { verify } from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

import { OrganizationInvitationService } from '../../../../lib/services/organization-invitation-service';

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    const jwtToken = authHeader.substring(7);
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: 'Server configuration error',
          },
        },
        { status: 500 }
      );
    }

    const decoded: any = verify(jwtToken, jwtSecret);
    const userId = decoded.userId || decoded.id;

    // Accept invitation
    const { token } = params;
    const result = await OrganizationInvitationService.acceptInvitation(token, userId);

    // Fetch organization details
    const { prisma } = await import('src/lib/prisma');
    const organization = await prisma.organization.findUnique({
      where: { id: result.invitation.organizationId },
    });

    return NextResponse.json({
      success: true,
      data: {
        organization,
        membership: result.membership,
        message: 'Invitation accepted successfully',
      },
    });
  } catch (error: any) {
    console.error('Accept invitation error:', error);

    if (
      error.message.includes('not found') ||
      error.message.includes('expired') ||
      error.message.includes('does not match')
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INVITATION',
            message: error.message,
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to accept invitation',
        },
      },
      { status: 500 }
    );
  }
}
