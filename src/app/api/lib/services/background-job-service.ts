/**
 * Background Job Processing Service
 * Queue-based async task processing with retry logic
 */

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';
export type JobPriority = 'low' | 'normal' | 'high' | 'critical';

export interface Job<T = any> {
  id: string;
  type: string;
  payload: T;
  priority: JobPriority;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: any;
}

export interface JobHandler<T = any, R = any> {
  (payload: T, job: Job<T>): Promise<R>;
}

// In-memory job queue (for development)
// In production, use Redis/BullMQ
const jobQueue: Job[] = [];
const jobHandlers = new Map<string, JobHandler>();
const processingJobs = new Set<string>();

/**
 * Register a job handler
 */
export function registerJobHandler<T, R>(type: string, handler: JobHandler<T, R>): void {
  jobHandlers.set(type, handler);
}

/**
 * Enqueue a new job
 */
export async function enqueueJob<T>(
  type: string,
  payload: T,
  options?: {
    priority?: JobPriority;
    maxAttempts?: number;
    delay?: number;
  }
): Promise<Job<T>> {
  const job: Job<T> = {
    id: generateJobId(),
    type,
    payload,
    priority: options?.priority || 'normal',
    status: 'pending',
    attempts: 0,
    maxAttempts: options?.maxAttempts || 3,
    createdAt: new Date(),
  };

  jobQueue.push(job);
  sortJobQueue();

  console.log(`✅ Job enqueued: ${job.type} (${job.id})`);

  // Start processing if not already running
  processNextJob();

  return job;
}

/**
 * Get job by ID
 */
export function getJob(jobId: string): Job | undefined {
  return jobQueue.find((job) => job.id === jobId);
}

/**
 * Get all jobs
 */
export function getAllJobs(filter?: { status?: JobStatus; type?: string }): Job[] {
  let jobs = [...jobQueue];

  if (filter?.status) {
    jobs = jobs.filter((job) => job.status === filter.status);
  }

  if (filter?.type) {
    jobs = jobs.filter((job) => job.type === filter.type);
  }

  return jobs;
}

/**
 * Process next job in queue
 */
async function processNextJob(): Promise<void> {
  const job = jobQueue.find((j) => j.status === 'pending' && !processingJobs.has(j.id));

  if (!job) return;

  const handler = jobHandlers.get(job.type);
  if (!handler) {
    console.error(`No handler registered for job type: ${job.type}`);
    job.status = 'failed';
    job.error = `No handler registered for job type: ${job.type}`;
    return;
  }

  processingJobs.add(job.id);
  job.status = 'processing';
  job.startedAt = new Date();
  job.attempts += 1;

  try {
    console.log(
      `🔄 Processing job: ${job.type} (${job.id}) - Attempt ${job.attempts}/${job.maxAttempts}`
    );

    const result = await handler(job.payload, job);

    job.status = 'completed';
    job.completedAt = new Date();
    job.result = result;

    console.log(`✅ Job completed: ${job.type} (${job.id})`);
  } catch (error: any) {
    console.error(`❌ Job failed: ${job.type} (${job.id}) - ${error.message}`);

    job.error = error.message;

    if (job.attempts < job.maxAttempts) {
      job.status = 'retrying';
      // Exponential backoff
      const delay = Math.min(1000 * 2 ** (job.attempts - 1), 30000);
      setTimeout(() => {
        job.status = 'pending';
        processNextJob();
      }, delay);
    } else {
      job.status = 'failed';
      job.completedAt = new Date();
    }
  } finally {
    processingJobs.delete(job.id);
    // Process next job
    setTimeout(processNextJob, 100);
  }
}

/**
 * Sort job queue by priority
 */
function sortJobQueue(): void {
  const priorityOrder: Record<JobPriority, number> = {
    critical: 4,
    high: 3,
    normal: 2,
    low: 1,
  };

  jobQueue.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
}

/**
 * Generate unique job ID
 */
function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Get job statistics
 */
export function getJobStatistics(): {
  total: number;
  byStatus: Record<JobStatus, number>;
  byType: Record<string, number>;
} {
  const byStatus: Record<JobStatus, number> = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    retrying: 0,
  };

  const byType: Record<string, number> = {};

  // Use forEach instead of for...of
  jobQueue.forEach((job) => {
    byStatus[job.status] += 1;
    byType[job.type] = (byType[job.type] || 0) + 1;
  });

  return {
    total: jobQueue.length,
    byStatus,
    byType,
  };
}

/**
 * Clear completed jobs
 */
export function clearCompletedJobs(olderThan?: Date): void {
  const cutoff = olderThan || new Date(Date.now() - 3600000); // 1 hour ago

  // Filter and reassign instead of using loop with decrement
  const filtered = jobQueue.filter(
    (job) => !(job.status === 'completed' && job.completedAt && job.completedAt < cutoff)
  );

  // Clear and repopulate
  jobQueue.length = 0;
  jobQueue.push(...filtered);
}

// Pre-register common job types
registerJobHandler('send-email', async (payload: { to: string; subject: string; body: string }) => {
  console.log(`Sending email to ${payload.to}: ${payload.subject}`);
  // Email sending logic here
  return { sent: true };
});

registerJobHandler('generate-report', async (payload: { userId: string; reportType: string }) => {
  console.log(`Generating ${payload.reportType} report for user ${payload.userId}`);
  // Report generation logic here
  return { reportId: generateJobId() };
});

registerJobHandler('process-webhook', async (payload: { url: string; data: any }) => {
  console.log(`Processing webhook: ${payload.url}`);
  // Webhook processing logic here
  return { success: true };
});

// Start job processor
setInterval(() => {
  clearCompletedJobs();
}, 300000); // Clean up every 5 minutes
