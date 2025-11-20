// Advanced Filtering Utilities

export interface DateRangeFilter {
  start?: Date;
  end?: Date;
}

export interface AdvancedOrganizationFilters {
  // Basic filters
  status?: string[];
  industry?: string[];
  size?: string[];

  // Search
  search?: string;
  searchFields?: ('name' | 'description' | 'slug' | 'website')[];

  // Date filters
  createdAt?: DateRangeFilter;
  updatedAt?: DateRangeFilter;

  // Member filters
  minMembers?: number;
  maxMembers?: number;

  // Project filters
  minProjects?: number;
  maxProjects?: number;
  hasActiveProjects?: boolean;

  // Owner filter
  ownerId?: string;

  // Sorting
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'memberCount' | 'projectCount';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Build Prisma where clause from advanced filters
 */
export function buildOrganizationWhereClause(filters: AdvancedOrganizationFilters): any {
  const where: any = {
    deletedAt: null,
  };

  // Status filter (multiple)
  if (filters.status && filters.status.length > 0) {
    where.status = { in: filters.status };
  }

  // Industry filter (multiple)
  if (filters.industry && filters.industry.length > 0) {
    where.industry = { in: filters.industry };
  }

  // Size filter (multiple)
  if (filters.size && filters.size.length > 0) {
    where.size = { in: filters.size };
  }

  // Search filter
  if (filters.search) {
    const searchFields = filters.searchFields || ['name', 'description', 'slug'];
    where.OR = searchFields.map((field) => ({
      [field]: { contains: filters.search, mode: 'insensitive' },
    }));
  }

  // Date range filters
  if (filters.createdAt) {
    where.createdAt = {};
    if (filters.createdAt.start) {
      where.createdAt.gte = filters.createdAt.start;
    }
    if (filters.createdAt.end) {
      where.createdAt.lte = filters.createdAt.end;
    }
  }

  if (filters.updatedAt) {
    where.updatedAt = {};
    if (filters.updatedAt.start) {
      where.updatedAt.gte = filters.updatedAt.start;
    }
    if (filters.updatedAt.end) {
      where.updatedAt.lte = filters.updatedAt.end;
    }
  }

  // Owner filter
  if (filters.ownerId) {
    where.ownerId = filters.ownerId;
  }

  return where;
}

/**
 * Build Prisma include clause for related data
 */
export function buildOrganizationIncludeClause(includeRelations: boolean = true): any {
  if (!includeRelations) return undefined;

  return {
    members: {
      where: { isActive: true },
      select: {
        id: true,
        role: true,
        userId: true,
      },
    },
    projects: {
      select: {
        id: true,
        state: true,
      },
    },
  };
}

/**
 * Build Prisma orderBy clause from sort options
 */
export function buildOrganizationOrderByClause(
  sortBy?: string,
  sortOrder: 'asc' | 'desc' = 'desc'
): any {
  if (!sortBy) {
    return { createdAt: 'desc' };
  }

  // For related counts, we'll need to handle this in post-processing
  if (sortBy === 'memberCount' || sortBy === 'projectCount') {
    return { createdAt: 'desc' }; // Fallback, we'll sort in memory
  }

  return { [sortBy]: sortOrder };
}

/**
 * Post-process organizations to apply filters on computed fields
 */
export function applyComputedFilters(
  organizations: any[],
  filters: AdvancedOrganizationFilters
): any[] {
  let filtered = [...organizations];

  // Member count filters
  if (filters.minMembers !== undefined) {
    filtered = filtered.filter((org) => {
      const memberCount = org.members?.length || 0;
      return memberCount >= filters.minMembers!;
    });
  }

  if (filters.maxMembers !== undefined) {
    filtered = filtered.filter((org) => {
      const memberCount = org.members?.length || 0;
      return memberCount <= filters.maxMembers!;
    });
  }

  // Project count filters
  if (filters.minProjects !== undefined) {
    filtered = filtered.filter((org) => {
      const projectCount = org.projects?.length || 0;
      return projectCount >= filters.minProjects!;
    });
  }

  if (filters.maxProjects !== undefined) {
    filtered = filtered.filter((org) => {
      const projectCount = org.projects?.length || 0;
      return projectCount <= filters.maxProjects!;
    });
  }

  // Active projects filter
  if (filters.hasActiveProjects !== undefined) {
    filtered = filtered.filter((org) => {
      const hasActive = org.projects?.some((p: any) => p.state === 'ACTIVE') || false;
      return hasActive === filters.hasActiveProjects;
    });
  }

  return filtered;
}

/**
 * Sort organizations by computed fields
 */
export function sortOrganizations(
  organizations: any[],
  sortBy?: string,
  sortOrder: 'asc' | 'desc' = 'desc'
): any[] {
  if (!sortBy || (sortBy !== 'memberCount' && sortBy !== 'projectCount')) {
    return organizations;
  }

  const sorted = [...organizations].sort((a, b) => {
    let aValue = 0;
    let bValue = 0;

    if (sortBy === 'memberCount') {
      aValue = a.members?.length || 0;
      bValue = b.members?.length || 0;
    } else if (sortBy === 'projectCount') {
      aValue = a.projects?.length || 0;
      bValue = b.projects?.length || 0;
    }

    return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
  });

  return sorted;
}

/**
 * Parse query parameters into advanced filters
 */
export function parseAdvancedFilters(
  queryParams: Record<string, any>
): AdvancedOrganizationFilters {
  const filters: AdvancedOrganizationFilters = {};

  // Parse array filters
  if (queryParams.status) {
    filters.status = Array.isArray(queryParams.status) ? queryParams.status : [queryParams.status];
  }

  if (queryParams.industry) {
    filters.industry = Array.isArray(queryParams.industry)
      ? queryParams.industry
      : [queryParams.industry];
  }

  if (queryParams.size) {
    filters.size = Array.isArray(queryParams.size) ? queryParams.size : [queryParams.size];
  }

  // Parse search
  if (queryParams.search) {
    filters.search = queryParams.search;
  }

  // Parse numeric filters
  if (queryParams.minMembers) {
    filters.minMembers = parseInt(queryParams.minMembers, 10);
  }

  if (queryParams.maxMembers) {
    filters.maxMembers = parseInt(queryParams.maxMembers, 10);
  }

  if (queryParams.minProjects) {
    filters.minProjects = parseInt(queryParams.minProjects, 10);
  }

  if (queryParams.maxProjects) {
    filters.maxProjects = parseInt(queryParams.maxProjects, 10);
  }

  // Parse boolean filters
  if (queryParams.hasActiveProjects !== undefined) {
    filters.hasActiveProjects = queryParams.hasActiveProjects === 'true';
  }

  // Parse date filters
  if (queryParams.createdAfter || queryParams.createdBefore) {
    filters.createdAt = {};
    if (queryParams.createdAfter) {
      filters.createdAt.start = new Date(queryParams.createdAfter);
    }
    if (queryParams.createdBefore) {
      filters.createdAt.end = new Date(queryParams.createdBefore);
    }
  }

  // Parse sorting
  if (queryParams.sortBy) {
    filters.sortBy = queryParams.sortBy;
  }

  if (queryParams.sortOrder) {
    filters.sortOrder = queryParams.sortOrder === 'asc' ? 'asc' : 'desc';
  }

  // Owner filter
  if (queryParams.ownerId) {
    filters.ownerId = queryParams.ownerId;
  }

  return filters;
}
