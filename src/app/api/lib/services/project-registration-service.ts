/**
 * Project Registration Service
 * Handles registration of projects in Flyte and syncing to database
 * Can be used from API routes, seed scripts, or background jobs
 */

import { prisma } from '@app/database';

import { generateOrgPrefix, generateFlyteProjectId } from './resource-isolation-helper';

export interface ProjectRegistrationParams {
  userProjectId: string;
  organizationId: string;
  userId: string;
  name: string;
  description?: string;
  domains?: Array<{ id: string; name: string }>;
  state?: number;
}

export interface ProjectRegistrationResult {
  success: boolean;
  userProjectId: string;
  flyteProjectId: string;
  registered: boolean;
  error?: string;
}

export class ProjectRegistrationService {
  /**
   * Register project in Flyte and sync to database
   * NEW: Creates ONE Flyte project per organization (not per UI project)
   * UI projects are isolated via domain naming convention
   */
  static async registerProject(
    params: ProjectRegistrationParams,
    engineManager?: any // Optional - if not provided, will skip Flyte registration
  ): Promise<ProjectRegistrationResult> {
    const { userProjectId, organizationId, userId, name, description, domains, state } = params;

    try {
      // 1. Use "aus" as the shared Flyte project name
      const flyteProjectId = generateFlyteProjectId(organizationId);
      const orgPrefix = generateOrgPrefix(organizationId);

      // 2. Check if "aus" Flyte project exists (should already exist)
      let flyteRegistered = false;
      if (engineManager?.services?.admin) {
        try {
          // Check if "aus" Flyte project exists
          await engineManager.services.admin.getProject({
            id: flyteProjectId,
          });

          console.log(`ℹ️  Shared Flyte project "aus" exists and is accessible`);
          flyteRegistered = true;
        } catch (error: any) {
          // If "aus" project doesn't exist, log warning
          // Don't create it - it should be pre-existing in Flyte
          console.warn(
            `⚠️  Flyte project "aus" not found. Tasks will be registered when available.`
          );
          console.warn(`   Error: ${error.message}`);
          flyteRegistered = false;
        }
      }

      // 3. Generate domains that encode UI project
      // E.g., "project-testing-development", "project-testing-staging"
      const flyteDomains = (
        domains || [
          { id: 'development', name: 'Development' },
          { id: 'staging', name: 'Staging' },
          { id: 'production', name: 'Production' },
        ]
      ).map((d) => ({
        id: `${userProjectId}-${d.id}`,
        name: `${name} - ${d.name}`,
      }));

      // 4. Sync to database
      await prisma.project.upsert({
        where: { id: userProjectId },
        create: {
          id: userProjectId,
          organizationId,
          name,
          description: description || null,
          flyteProjectId, // Same for all UI projects in org
          flyteOrgPrefix: orgPrefix,
          flyteState: state || 0,
          flyteDomains: flyteDomains as any,
          createdBy: userId,
        },
        update: {
          name,
          description: description || null,
          flyteProjectId,
          flyteOrgPrefix: orgPrefix,
          flyteState: state || 0,
          flyteDomains: flyteDomains as any,
        },
      });

      console.log(`✅ Synced UI project to database: ${userProjectId}`);
      console.log(`   Flyte Project: ${flyteProjectId} (shared)`);
      console.log(`   Domains: ${flyteDomains.map((d) => d.id).join(', ')}`);

      return {
        success: true,
        userProjectId,
        flyteProjectId,
        registered: flyteRegistered,
      };
    } catch (error) {
      console.error(`❌ Failed to register project:`, error);
      return {
        success: false,
        userProjectId,
        flyteProjectId: generateFlyteProjectId(organizationId),
        registered: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Register projects in bulk (useful for seeding)
   */
  static async registerProjects(
    projects: ProjectRegistrationParams[],
    engineManager?: any
  ): Promise<ProjectRegistrationResult[]> {
    // Register projects in parallel for better performance
    const registrationPromises = projects.map((project) =>
      this.registerProject(project, engineManager)
    );

    const results = await Promise.all(registrationPromises);
    return results;
  }

  /**
   * Check if project is registered in Flyte
   */
  static async isProjectRegisteredInFlyte(
    flyteProjectId: string,
    engineManager: any
  ): Promise<boolean> {
    try {
      if (!engineManager?.services?.admin) {
        return false;
      }

      const result = await engineManager.services.admin.getProject({
        id: flyteProjectId,
      });

      return !!result;
    } catch {
      return false;
    }
  }

  /**
   * Sync existing database projects to Flyte
   * Useful for migrating old projects or fixing sync issues
   */
  static async syncExistingProjects(
    organizationId: string,
    engineManager?: any
  ): Promise<{
    total: number;
    synced: number;
    skipped: number;
    errors: Array<{ projectId: string; error: string }>;
  }> {
    const results = {
      total: 0,
      synced: 0,
      skipped: 0,
      errors: [] as Array<{ projectId: string; error: string }>,
    };

    try {
      // Get all projects for organization
      const projects = await prisma.project.findMany({
        where: {
          organizationId,
          deletedAt: null,
        },
      });

      results.total = projects.length;

      // Process projects sequentially to avoid overwhelming the system
      const projectPromises = projects.map(async (project) => {
        try {
          // Check if already has Flyte project ID
          if (project.flyteProjectId) {
            // Verify it exists in Flyte
            if (engineManager) {
              const exists = await this.isProjectRegisteredInFlyte(
                project.flyteProjectId,
                engineManager
              );

              if (exists) {
                return { status: 'skipped' as const, project };
              }
            }
          }

          // Register project
          const result = await this.registerProject(
            {
              userProjectId: project.id,
              organizationId: project.organizationId,
              userId: project.createdBy || 'system',
              name: project.name,
              description: project.description || undefined,
              domains: (project.flyteDomains as any) || [],
              state: project.flyteState || 0,
            },
            engineManager
          );

          if (result.success) {
            return { status: 'synced' as const, project };
          }
          return {
            status: 'error' as const,
            project,
            error: result.error || 'Unknown error',
          };
        } catch (error) {
          return {
            status: 'error' as const,
            project,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      });

      // Wait for all projects to be processed
      const projectResults = await Promise.all(projectPromises);

      // Aggregate results
      projectResults.forEach((result) => {
        if (result.status === 'synced') {
          results.synced += 1;
        } else if (result.status === 'skipped') {
          results.skipped += 1;
        } else if (result.status === 'error') {
          results.errors.push({
            projectId: result.project.id,
            error: result.error || 'Unknown error',
          });
        }
      });

      return results;
    } catch (error) {
      console.error('Error syncing projects:', error);
      throw error;
    }
  }
}
