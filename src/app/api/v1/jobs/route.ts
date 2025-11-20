/**
 * Background Jobs API
 * Monitor and manage background jobs
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireSecureEngine } from '../../lib/services/engine-helper-rbac';
import {
  getJob,
  enqueueJob,
  getAllJobs,
  getJobStatistics,
} from '../../lib/services/background-job-service';

/**
 * GET /api/v1/jobs - Get jobs and statistics
 */
export async function GET(request: NextRequest) {
  try {
    const result = await requireSecureEngine(
      request,
      {
        rbac: {
          permissions: [{ resource: 'jobs', action: 'read' }],
          roles: ['developer', 'operator', 'project-admin', 'system-admin', 'super-admin'],
        },
      },
      {}
    );

    if (result instanceof NextResponse) {
      return result;
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('id');
    const status = searchParams.get('status') as any;
    const type = searchParams.get('type') || undefined;

    if (jobId) {
      const job = getJob(jobId);
      if (!job) {
        return NextResponse.json(
          {
            success: false,
            error: 'Job not found',
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        job,
      });
    }

    const jobs = getAllJobs({ status, type });
    const statistics = getJobStatistics();

    return NextResponse.json({
      success: true,
      jobs,
      statistics,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch jobs',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/jobs - Enqueue a new job
 */
export async function POST(request: NextRequest) {
  try {
    const result = await requireSecureEngine(
      request,
      {
        rbac: {
          permissions: [{ resource: 'jobs', action: 'create' }],
        },
      },
      {}
    );

    if (result instanceof NextResponse) {
      return result;
    }

    const body = await request.json();
    const { type, payload, priority, maxAttempts } = body;

    if (!type || !payload) {
      return NextResponse.json(
        {
          success: false,
          error: 'type and payload are required',
        },
        { status: 400 }
      );
    }

    const job = await enqueueJob(type, payload, {
      priority,
      maxAttempts,
    });

    return NextResponse.json({
      success: true,
      job,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to enqueue job',
      },
      { status: 500 }
    );
  }
}
