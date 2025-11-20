// API route to discover endpoints on-the-fly
// GET /api/discover-endpoints
// ----------------------------------------------------------------------

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Simplified in-memory discovery without external dependencies
export async function GET() {
  try {
    const endpoints = discoverEndpoints();

    return NextResponse.json({
      success: true,
      endpoints,
      count: endpoints.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error discovering endpoints:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to discover endpoints',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

function discoverEndpoints() {
  const endpoints: any[] = [];
  const apiDir = path.join(process.cwd(), 'src/app/api/v1');

  if (!fs.existsSync(apiDir)) {
    console.warn('API directory not found:', apiDir);
    return endpoints;
  }

  function scanDir(dir: string, basePath: string = '/api/v1') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Handle dynamic segments [id], [slug], etc.
        const segment = entry.name.startsWith('[') ? `:${entry.name.slice(1, -1)}` : entry.name;
        scanDir(fullPath, `${basePath}/${entry.name}`);
      } else if (entry.name === 'route.ts') {
        // Found a route file
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const methods = extractMethods(content);

          if (methods.length > 0) {
            const routePath = basePath.replace(/\[([^\]]+)\]/g, ':$1');
            const domain = basePath.split('/')[3] || 'general';

            endpoints.push({
              id: `${routePath.replace(/\//g, '-').replace(/^-/, '')}-${methods.join(
                '-'
              )}`.toLowerCase(),
              routePath,
              methods,
              domain,
              filePath: fullPath.replace(process.cwd(), ''),
              auth: extractAuth(content),
              rateLimit: extractRateLimit(content),
              description: extractDescription(content),
            });
          }
        } catch (error) {
          console.error(`Error reading ${fullPath}:`, error);
        }
      }
    }
  }

  scanDir(apiDir);
  return endpoints;
}

function extractMethods(content: string): string[] {
  const methods: string[] = [];
  const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

  for (const method of httpMethods) {
    if (new RegExp(`export\\s+(const|async\\s+function)\\s+${method}\\s*[=(]`).test(content)) {
      methods.push(method);
    }
  }

  return methods;
}

function extractAuth(content: string): any {
  const auth: any = { required: false };

  const authMatch = content.match(/auth:\s*{\s*required:\s*(true|false)/);
  if (authMatch) {
    auth.required = authMatch[1] === 'true';
  }

  if (content.includes('requireAdmin')) {
    auth.required = true;
    auth.roles = ['admin', 'system-admin'];
  }

  return auth;
}

function extractRateLimit(content: string): any {
  const presetMatch = content.match(/rateLimitConfigs\.(\w+)/);
  if (presetMatch) {
    const presets: Record<string, any> = {
      strict: { windowMs: 900000, maxRequests: 5 },
      standard: { windowMs: 900000, maxRequests: 100 },
      lenient: { windowMs: 900000, maxRequests: 1000 },
      payment: { windowMs: 900000, maxRequests: 20 },
    };
    return presets[presetMatch[1]];
  }
  return undefined;
}

function extractDescription(content: string): string | undefined {
  const commentMatch = content.match(/^\/\*\*?\s*\n?\s*(.+?)\s*\n/);
  if (commentMatch) {
    return commentMatch[1].replace(/\*/g, '').trim();
  }
  return undefined;
}
