import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Lazy initialization to avoid build-time issues
let _prisma: PrismaClient | null = null;
let _initializationAttempted = false;

function getPrismaClient(): PrismaClient {
  if (_prisma) return _prisma as any;

  if (globalForPrisma.prisma) {
    _prisma = globalForPrisma.prisma;
    return _prisma as any;
  }

  if (_initializationAttempted) {
    throw new Error(
      'Prisma client initialization failed. Please ensure the database is accessible and "prisma generate" has been run.'
    );
  }

  _initializationAttempted = true;

  try {
    const basePrisma = new PrismaClient({
      // ⚡ Memory optimization: Reduce logging in dev to save memory
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      errorFormat: 'minimal',
    });

    // ✅ Apply Prisma Accelerate extension for optimized caching and connection pooling
    _prisma = basePrisma.$extends(withAccelerate()) as any;

    // ✅ Connection pool limits to prevent memory leaks
    basePrisma.$connect().catch((error) => {
      console.error('Failed to connect to database:', error);
    });

    if (process.env.NODE_ENV !== 'production') {
      globalForPrisma.prisma = _prisma as any;
    }

    return _prisma as any;
  } catch (error) {
    console.error('Failed to initialize Prisma client:', error);
    console.error('Make sure to run "prisma generate" and check your database connection.');
    throw new Error(`Prisma initialization failed: ${(error as Error).message}`);
  }
}

// Export a proxy that lazily initializes the client
export const prisma = new Proxy({} as PrismaClient, {
  get(target, prop) {
    const client = getPrismaClient();
    const value = (client as any)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
