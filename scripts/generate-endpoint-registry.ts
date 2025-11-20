#!/usr/bin/env tsx
// Script to generate endpoint registry from /api/v1/ routes
// Usage: tsx scripts/generate-endpoint-registry.ts
// ----------------------------------------------------------------------

import { generateEndpointRegistry } from '../src/app/api/lib/discovery/endpoint-scanner';

async function main() {
  console.log('🔍 Scanning API endpoints...\n');

  try {
    await generateEndpointRegistry();
    console.log('\n✅ Endpoint registry generated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error generating endpoint registry:', error);
    process.exit(1);
  }
}

main();
