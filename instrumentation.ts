/**
 * Next.js Instrumentation Hook
 * This file is automatically called once when the server starts
 */

export async function register() {
  console.log('🔧 Instrumentation hook called');
  console.log('NEXT_RUNTIME:', process.env.NEXT_RUNTIME);
  console.log('FLYTE_ADMIN_HOST:', process.env.FLYTE_ADMIN_HOST);
  console.log('FLYTE_ADMIN_PORT:', process.env.FLYTE_ADMIN_PORT);

  // Only run on server side
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('✅ Running in nodejs runtime, initializing services...');
    const { initializeAPI } = await import('./src/app/api/lib/startup');

    try {
      await initializeAPI();
      console.log('✅ API services initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize API services:', error);
      // Don't throw - allow server to start even if some services fail
    }
  } else {
    console.log('⚠️ Not running in nodejs runtime, skipping initialization');
  }
}
