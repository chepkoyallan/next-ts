/**
 * Resource Isolation Helper
 * Functions to ensure multi-tenancy isolation for Flyte resources
 */

import { prisma } from '@app/database';

// ----------------------------------------------------------------------
// Organization Prefix Functions
// ----------------------------------------------------------------------

/**
 * Generate organization prefix for Flyte resources
 * Format: org-{first 8 chars of orgId}
 */
export function generateOrgPrefix(organizationId: string): string {
  // Use first 8 characters to keep IDs reasonably short
  const shortId = organizationId.substring(0, 8);
  return `org-${shortId}`;
}

/**
 * Generate Flyte project ID for organization
 * NEW: Uses "aus" as the shared Flyte project name
 * @param organizationId - Organization ID (not used in new strategy)
 * @returns Flyte project ID - always "aus"
 */
export function generateFlyteProjectId(organizationId?: string): string {
  // Use "aus" as the single shared Flyte project across all organizations
  return 'aus';
}

/**
 * Generate Flyte domain name that encodes UI project
 * @param userProjectId - UI project ID (e.g., "project-testing")
 * @param environment - Environment (e.g., "development", "staging", "production")
 * @returns Flyte domain (e.g., "project-testing-development")
 */
export function generateFlyteDomain(userProjectId: string, environment: string): string {
  return `${userProjectId}-${environment}`;
}

/**
 * Parse Flyte domain to extract UI project and environment
 * @param domain - Flyte domain (e.g., "project-testing-development")
 * @returns { projectId, environment } or null
 */
export function parseFlyteDomain(domain: string): {
  projectId: string;
  environment: string;
} | null {
  const parts = domain.split('-');
  if (parts.length < 2) return null;

  // Last part is environment, rest is project ID
  const environment = parts[parts.length - 1];
  const projectId = parts.slice(0, -1).join('-');

  return { projectId, environment };
}

/**
 * Parse Flyte project ID to extract organization prefix and user project ID
 * @param flyteProjectId - Flyte project ID (e.g., "org-abc12345-my-project")
 * @returns { orgPrefix, userProjectId } or null if invalid format
 */
export function parseFlyteProjectId(flyteProjectId: string): {
  orgPrefix: string;
  userProjectId: string;
} | null {
  const match = flyteProjectId.match(/^(org-[a-z0-9]{8})-(.+)$/);
  if (!match) return null;

  return {
    orgPrefix: match[1],
    userProjectId: match[2],
  };
}

/**
 * Generate Flyte workflow ID with organization prefix
 * Format: {org-prefix-project}:{domain}:{name}:{version}
 */
export function generateFlyteWorkflowId(
  organizationId: string,
  project: string,
  domain: string,
  name: string,
  version: string
): string {
  const flyteProject = generateFlyteProjectId(organizationId);
  return `${flyteProject}:${domain}:${name}:${version}`;
}

/**
 * Generate Flyte task ID with organization prefix
 * NEW: Format: {org-platform}:{project-env}:{project__name}:{version}
 * @param organizationId - Organization ID
 * @param uiProjectId - UI project ID (e.g., "project-testing")
 * @param environment - Environment (e.g., "development")
 * @param taskName - Task name without prefix (e.g., "data_validation")
 * @param version - Task version (e.g., "v1")
 * @returns Full Flyte task ID
 * Example: "org-abc12345-platform:project-testing-development:project_testing__data_validation:v1"
 */
export function generateFlyteTaskId(
  organizationId: string,
  uiProjectId: string,
  environment: string,
  taskName: string,
  version: string
): string {
  const flyteProject = generateFlyteProjectId(organizationId);
  const domain = generateFlyteDomain(uiProjectId, environment);
  const prefixedTaskName = `${uiProjectId.replace(/-/g, '_')}__${taskName}`;
  return `${flyteProject}:${domain}:${prefixedTaskName}:${version}`;
}

/**
 * Generate Flyte launch plan ID with organization prefix
 * Format: {org-prefix-project}:{domain}:{name}:{version}
 */
export function generateFlyteLaunchPlanId(
  organizationId: string,
  project: string,
  domain: string,
  name: string,
  version: string
): string {
  const flyteProject = generateFlyteProjectId(organizationId);
  return `${flyteProject}:${domain}:${name}:${version}`;
}

/**
 * Generate Flyte execution ID with organization prefix
 * Format: {org-prefix-project}:{domain}:{name}
 */
export function generateFlyteExecutionId(
  organizationId: string,
  project: string,
  domain: string,
  name: string
): string {
  const flyteProject = generateFlyteProjectId(organizationId);
  return `${flyteProject}:${domain}:${name}`;
}

// ----------------------------------------------------------------------
// Filtering Functions
// ----------------------------------------------------------------------

/**
 * Filter Flyte projects by organization
 * @param projects - Array of Flyte projects
 * @param organizationId - Organization ID to filter by
 * @returns Filtered projects that belong to the organization
 */
export function filterProjectsByOrganization<T extends { id?: string | null }>(
  projects: T[],
  organizationId: string
): T[] {
  const orgPrefix = generateOrgPrefix(organizationId);

  return projects.filter((project) => {
    if (!project.id) return false;
    return project.id.startsWith(`${orgPrefix}-`);
  });
}

/**
 * Filter Flyte workflows by organization
 * @param workflows - Array of Flyte workflows
 * @param organizationId - Organization ID to filter by
 * @returns Filtered workflows
 */
export function filterWorkflowsByOrganization<
  T extends { id?: { project?: string | null } | null },
>(workflows: T[], organizationId: string): T[] {
  const orgPrefix = generateOrgPrefix(organizationId);

  return workflows.filter((workflow) => {
    const projectId = workflow.id?.project;
    if (!projectId) return false;
    return projectId.startsWith(`${orgPrefix}-`);
  });
}

/**
 * Filter Flyte tasks by organization
 * @param tasks - Array of Flyte tasks
 * @param organizationId - Organization ID to filter by
 * @returns Filtered tasks
 */
export function filterTasksByOrganization<T extends { id?: { project?: string | null } | null }>(
  tasks: T[],
  organizationId: string
): T[] {
  const orgPrefix = generateOrgPrefix(organizationId);

  return tasks.filter((task) => {
    const projectId = task.id?.project;
    if (!projectId) return false;
    return projectId.startsWith(`${orgPrefix}-`);
  });
}

/**
 * Filter Flyte executions by organization
 * @param executions - Array of Flyte executions
 * @param organizationId - Organization ID to filter by
 * @returns Filtered executions
 */
export function filterExecutionsByOrganization<
  T extends { id?: { project?: string | null } | null },
>(executions: T[], organizationId: string): T[] {
  const orgPrefix = generateOrgPrefix(organizationId);

  return executions.filter((execution) => {
    const projectId = execution.id?.project;
    if (!projectId) return false;
    return projectId.startsWith(`${orgPrefix}-`);
  });
}

// ----------------------------------------------------------------------
// Ownership Verification Functions
// ----------------------------------------------------------------------

/**
 * Verify user has access to a project (via organization membership)
 * @param projectId - User-friendly project ID
 * @param userId - User ID
 * @param organizationId - Organization ID
 * @returns true if user can access, false otherwise
 */
export async function verifyProjectOwnership(
  projectId: string,
  userId: string,
  organizationId: string
): Promise<boolean> {
  try {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,
        deletedAt: null,
      },
    });

    return project !== null;
  } catch (error) {
    console.error('Error verifying project ownership:', error);
    return false;
  }
}

/**
 * Verify user has access to a workflow
 */
export async function verifyWorkflowOwnership(
  workflowId: string,
  userId: string,
  organizationId: string
): Promise<boolean> {
  try {
    const workflow = await prisma.workflow.findFirst({
      where: {
        id: workflowId,
        organizationId,
        isDeleted: false,
      },
    });

    return workflow !== null;
  } catch (error) {
    console.error('Error verifying workflow ownership:', error);
    return false;
  }
}

/**
 * Verify user has access to a task
 */
export async function verifyTaskOwnership(
  taskId: string,
  userId: string,
  organizationId: string
): Promise<boolean> {
  try {
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        organizationId,
        isDeleted: false,
      },
    });

    return task !== null;
  } catch (error) {
    console.error('Error verifying task ownership:', error);
    return false;
  }
}

/**
 * Verify user has access to an execution
 */
export async function verifyExecutionOwnership(
  executionId: string,
  userId: string,
  organizationId: string
): Promise<boolean> {
  try {
    const execution = await prisma.workflowExecution.findFirst({
      where: {
        id: executionId,
        organizationId,
      },
    });

    return execution !== null;
  } catch (error) {
    console.error('Error verifying execution ownership:', error);
    return false;
  }
}

// ----------------------------------------------------------------------
// Project Name Conversion Functions
// ----------------------------------------------------------------------

/**
 * Remove organization prefix from Flyte project ID for display
 * @param flyteProjectId - Flyte project ID (e.g., "org-abc12345-my-project")
 * @returns User-friendly project ID (e.g., "my-project")
 */
export function removeFlytePrefix(flyteProjectId: string): string {
  const parsed = parseFlyteProjectId(flyteProjectId);
  return parsed ? parsed.userProjectId : flyteProjectId;
}

/**
 * Convert Flyte project to user-friendly format
 */
export function convertFlyteProjectToUser<T extends { id?: string | null }>(project: T): T {
  if (!project.id) return project;

  return {
    ...project,
    id: removeFlytePrefix(project.id),
  };
}

/**
 * Convert array of Flyte projects to user-friendly format
 */
export function convertFlyteProjectsToUser<T extends { id?: string | null }>(projects: T[]): T[] {
  return projects.map(convertFlyteProjectToUser);
}

// ----------------------------------------------------------------------
// Database Sync Functions
// ----------------------------------------------------------------------

/**
 * Sync Flyte project to database
 */
export async function syncProjectToDatabase(
  flyteProjectId: string,
  organizationId: string,
  userId: string,
  projectData: any
): Promise<void> {
  try {
    const userProjectId = removeFlytePrefix(flyteProjectId);
    const orgPrefix = generateOrgPrefix(organizationId);

    await prisma.project.upsert({
      where: {
        id: userProjectId,
      },
      create: {
        flyteProjectId,
        id: userProjectId,
        organizationId,
        name: projectData.name || userProjectId,
        description: projectData.description,
        flyteOrgPrefix: orgPrefix,
        flyteState: projectData.state || 0,
        flyteDomains: projectData.domains || [],
        createdBy: userId,
      },
      update: {
        name: projectData.name || userProjectId,
        description: projectData.description,
        flyteState: projectData.state || 0,
        flyteDomains: projectData.domains || [],
      },
    });
  } catch (error) {
    console.error('Error syncing project to database:', error);
    throw error;
  }
}

/**
 * Sync Flyte workflow to database
 */
export async function syncWorkflowToDatabase(
  flyteWorkflowId: string,
  projectId: string,
  organizationId: string,
  userId: string,
  workflowData: any
): Promise<void> {
  try {
    await prisma.workflow.upsert({
      where: { flyteWorkflowId },
      create: {
        flyteWorkflowId,
        projectId,
        organizationId,
        domain: workflowData.domain || 'development',
        name: workflowData.name,
        version: workflowData.version,
        description: workflowData.description,
        spec: workflowData.spec || {},
        compiledWorkflow: workflowData.compiledWorkflow,
        createdBy: userId,
      },
      update: {
        description: workflowData.description,
        spec: workflowData.spec || {},
        compiledWorkflow: workflowData.compiledWorkflow,
      },
    });
  } catch (error) {
    console.error('Error syncing workflow to database:', error);
    throw error;
  }
}
