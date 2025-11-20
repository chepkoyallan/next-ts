// /**
//  * Engine API - Tasks
//  * Task management endpoints using the engine
//  */

// import { z } from 'zod';
// import { NextRequest, NextResponse } from 'next/server';

// import { RBACDecorators } from 'src/app/api/lib/auth/rbac/middleware';
// import {
//   trackEngineUsage,
//   requireSecureEngine,
//   auditEngineOperation,
// } from 'src/app/api/lib/services/engine-helper-rbac';

// import { TaskListQuerySchema, TaskCreateRequestSchema } from '../schemas';

// // /**
// //  * GET /api/v1/engine/tasks
// //  * List tasks with optional filtering
// //  */
// // export async function GET(request: NextRequest) {
// //   try {
// //     const result = await requireSecureEngine(request, {
// //       serviceName: 'admin',
// //       rbac: RBACDecorators.requirePermission('tasks', 'read'),
// //       checkSubscription: false,
// //       trackUsage: false,
// //     });

// //     if (result instanceof NextResponse) {
// //       return result;
// //     }

// //     const { context } = result;
// //     const { organizationId } = context;

// //     if (!organizationId) {
// //       return NextResponse.json(
// //         {
// //           success: false,
// //           error: 'Organization ID not found',
// //         },
// //         { status: 400 }
// //       );
// //     }

// //     // Validate query parameters
// //     const { searchParams } = request.nextUrl;
// //     const queryParams = Object.fromEntries(searchParams.entries());
// //     const validatedQuery = TaskListQuerySchema.parse(queryParams);

// //     const { project, domain, name, version, limit } = validatedQuery;

// //     // NEW: With single Flyte project strategy, domain encodes UI project
// //     // Convert domain to Flyte domain format if needed
// //     let flyteProject = null;
// //     let flyteDomain = domain;

// //     const { prisma } = await import('src/lib/prisma');

// //     if (project) {
// //       const projectRecord = await prisma.project.findFirst({
// //         where: {
// //           id: project,
// //           organizationId,
// //         },
// //         select: {
// //           flyteProjectId: true,
// //         },
// //       });

// //       if (projectRecord?.flyteProjectId) {
// //         flyteProject = projectRecord.flyteProjectId; // "aus"

// //         // If domain provided, encode UI project in it
// //         // E.g., project="project-testing", domain="development" -> "project-testing-development"
// //         if (domain) {
// //           flyteDomain = `${project}-${domain}`;
// //         }
// //       }
// //     }

// //     // Query Flyte directly (Flyte is source of truth for tasks)
// //     console.log(`Fetching tasks from Flyte: project=${flyteProject}, domain=${flyteDomain}`);

// //     let apiTasks: any[] = [];

// //     if (flyteProject && flyteDomain) {
// //       try {
// //         const { getFlyteAdminClient } = await import('src/app/api/lib/services/flyte-admin-client');
// //         const flyteClient = getFlyteAdminClient();

// //         if (flyteClient) {
// //           const flyteTaskList = await flyteClient.listTasks(flyteProject, flyteDomain, {
// //             limit: limit || 50,
// //           });

// //           console.log(`Found ${flyteTaskList.tasks?.length || 0} tasks in Flyte`);

// //           // Convert Flyte tasks to API format
// //           apiTasks = (flyteTaskList.tasks || []).map((flyteTask) => ({
// //             id: {
// //               project: flyteTask.id?.project || '',
// //               domain: flyteTask.id?.domain || '',
// //               name: flyteTask.id?.name || '',
// //               version: flyteTask.id?.version || '',
// //             },
// //             flyteProject: flyteTask.id?.project || null,
// //             flyteTaskId: `${flyteTask.id?.project}:${flyteTask.id?.domain}:${flyteTask.id?.name}:${flyteTask.id?.version}`,
// //             description: flyteTask.closure?.compiledTask?.template?.metadata?.description || null,
// //             spec: flyteTask.closure?.compiledTask?.template || {},
// //             createdAt: flyteTask.closure?.createdAt || new Date().toISOString(),
// //           }));
// //         } else {
// //           console.warn('Flyte client not available');
// //         }
// //       } catch (error) {
// //         console.error('Error fetching tasks from Flyte:', error);
// //         // Return empty array on error
// //       }
// //     } else {
// //       console.warn('Missing flyteProject or flyteDomain - cannot query Flyte');
// //     }

// //     return NextResponse.json({
// //       success: true,
// //       data: {
// //         tasks: apiTasks,
// //         token: '',
// //       },
// //     });
// //   } catch (error) {
// //     if (error instanceof z.ZodError) {
// //       return NextResponse.json(
// //         {
// //           success: false,
// //           error: 'Validation error',
// //           details: error.issues,
// //         },
// //         { status: 400 }
// //       );
// //     }

// //     return NextResponse.json(
// //       {
// //         success: false,
// //         error: error instanceof Error ? error.message : 'Failed to list tasks',
// //       },
// //       { status: 500 }
// //     );
// //   }
// // }

// /**
//  * POST /api/v1/engine/tasks
//  * Create a new task
//  */
// export async function POST(request: NextRequest) {
//   try {
//     const result = await requireSecureEngine(request, {
//       serviceName: 'admin',
//       rbac: RBACDecorators.requirePermission('tasks', 'create'),
//       checkSubscription: true,
//       trackUsage: true,
//     });

//     if (result instanceof NextResponse) {
//       return result;
//     }

//     const { engineManager, userId, context } = result;
//     const { organizationId } = context;

//     if (!organizationId) {
//       return NextResponse.json(
//         {
//           success: false,
//           error: 'Organization ID not found',
//         },
//         { status: 400 }
//       );
//     }

//     // Validate request body
//     const body = await request.json();
//     const validatedData = TaskCreateRequestSchema.parse(body);

//     // Null safety check
//     if (!validatedData.id) throw new Error('Task ID is required');

//     // Generate Flyte task ID with organization prefix
//     const { generateFlyteTaskId } = await import(
//       'src/app/api/lib/services/resource-isolation-helper'
//     );

//     const flyteTaskId = generateFlyteTaskId(
//       organizationId,
//       validatedData.id.project || '',
//       validatedData.id.domain || 'development',
//       validatedData.id.name || 'unnamed-task',
//       validatedData.id.version || 'v1'
//     );

//     // Create task in Flyte with org-prefixed ID
//     const taskResult = await engineManager.services.admin!.createTask({
//       id: {
//         ...validatedData.id,
//         project: flyteTaskId.split(':')[0], // Use org-prefixed project
//       },
//       spec: validatedData.spec,
//     } as any);

//     // Sync to database
//     const { prisma } = await import('src/lib/prisma');
//     await prisma.task.create({
//       data: {
//         projectId: validatedData.id.project || '', // User-friendly project ID
//         organizationId,
//         domain: validatedData.id.domain || '',
//         name: validatedData.id.name || '',
//         version: validatedData.id.version || '',
//         description: validatedData.spec?.description || null,
//         spec: validatedData.spec as any,
//         flyteTaskId,
//         createdBy: userId,
//       },
//     });

//     // Track usage for billing
//     await trackEngineUsage(userId, 'task', 1, {
//       project: validatedData.id.project || '',
//       domain: validatedData.id.domain || '',
//       name: validatedData.id.name || '',
//     });

//     // Audit log
//     await auditEngineOperation(
//       userId,
//       'task_created',
//       'tasks',
//       `${validatedData.id.project}:${validatedData.id.domain}:${validatedData.id.name}`,
//       { version: validatedData.id.version }
//     );

//     return NextResponse.json({
//       success: true,
//       data: {
//         ...taskResult,
//         id: validatedData.id, // Return user-friendly ID
//       },
//     });
//   } catch (error) {
//     if (error instanceof z.ZodError) {
//       return NextResponse.json(
//         {
//           success: false,
//           error: 'Validation error',
//           details: error.issues,
//         },
//         { status: 400 }
//       );
//     }

//     return NextResponse.json(
//       {
//         success: false,
//         error: error instanceof Error ? error.message : 'Failed to create task',
//       },
//       { status: 500 }
//     );
//   }
// }

/**
 * Engine API - Tasks
 * Task management endpoints using the engine
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { RBACDecorators } from 'src/app/api/lib/auth/rbac/middleware';
import {
  trackEngineUsage,
  requireSecureEngine,
  auditEngineOperation,
} from 'src/app/api/lib/services/engine-helper-rbac';

import { TaskListQuerySchema, TaskCreateRequestSchema } from '../schemas';

/**
 * GET /api/v1/engine/tasks
 * List tasks with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const result = await requireSecureEngine(request, {
      serviceName: 'admin',
      rbac: RBACDecorators.requirePermission('tasks', 'read'),
      checkSubscription: false,
      trackUsage: false,
    });

    if (result instanceof NextResponse) {
      return result;
    }

    const { engineManager } = result;

    // Validate query parameters
    const { searchParams } = request.nextUrl;
    const queryParams = Object.fromEntries(searchParams.entries());

    console.log('[TasksAPI] Query parameters:', queryParams);

    const validatedQuery = TaskListQuerySchema.parse(queryParams);

    const { domain, name, version, limit } = validatedQuery;
    const project = process.env.FLYTE_DEFAULT_PROJECT || 'aus';

    console.log('[TasksAPI] Validated query:', { project, domain, name, version, limit });

    // Validate required parameters
    if (!domain) {
      return NextResponse.json(
        {
          success: false,
          error: 'Domain parameter is required',
        },
        { status: 400 }
      );
    }

    // Build list request - id is required with at least project and domain
    const listRequest: any = {
      limit,
      id: {
        project,
        domain,
      },
    };

    // Add optional filters if provided
    if (name) listRequest.id.name = name;
    if (version) listRequest.id.version = version;

    console.log('[TasksAPI] List request:', listRequest);

    const listResult = await engineManager.services.admin!.listTasks(listRequest);

    console.log('[TasksAPI] List result:', {
      taskCount: listResult.tasks?.length || 0,
      hasToken: !!listResult.token,
    });

    return NextResponse.json({
      success: true,
      data: {
        tasks: listResult.tasks || [],
        token: listResult.token || '',
      },
    });
  } catch (error) {
    console.error('[TasksAPI] Error listing tasks:', error);
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

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list tasks',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/engine/tasks
 * Create a new task
 */
export async function POST(request: NextRequest) {
  try {
    const result = await requireSecureEngine(request, {
      serviceName: 'admin',
      rbac: RBACDecorators.requirePermission('tasks', 'create'),
      checkSubscription: true,
      trackUsage: true,
    });

    if (result instanceof NextResponse) {
      return result;
    }

    const { engineManager, userId } = result;

    // Validate request body
    const body = await request.json();
    const validatedData = TaskCreateRequestSchema.parse(body);

    // Null safety check
    if (!validatedData.id) throw new Error('Task ID is required');

    const taskResult = await engineManager.services.admin!.createTask({
      id: validatedData.id,
      spec: validatedData.spec,
    } as any);

    // Track usage for billing
    await trackEngineUsage(userId, 'task', 1, {
      project: validatedData.id.project,
      domain: validatedData.id.domain,
      name: validatedData.id.name,
    });

    // Audit log
    await auditEngineOperation(
      userId,
      'task_created',
      'tasks',
      `${validatedData.id.project}:${validatedData.id.domain}:${validatedData.id.name}`,
      { version: validatedData.id.version }
    );

    return NextResponse.json({
      success: true,
      data: taskResult,
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

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create task',
      },
      { status: 500 }
    );
  }
}
