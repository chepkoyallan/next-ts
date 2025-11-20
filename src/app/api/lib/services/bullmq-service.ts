/**
 * BullMQ Job Queue Service
 * Production-ready background job processing with Redis
 * Replaces in-memory background-job-service.ts for reliability
 */

import { Queue, Worker, QueueEvents, Job as BullJob } from 'bullmq';

import { logger } from '../utils/logger';

export type JobStatus = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused';
export type JobPriority = 1 | 2 | 3 | 4 | 5; // 1 = highest, 5 = lowest

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
  failedAt?: Date;
  error?: string;
  result?: any;
  progress?: number;
}

export interface JobHandler<T = any, R = any> {
  (payload: T, job: BullJob<T>): Promise<R>;
}

export interface JobOptions {
  priority?: JobPriority;
  maxAttempts?: number;
  delay?: number;
  timeout?: number;
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
}

// Redis connection for BullMQ
// Parse REDIS_URL properly (handles redis://host:port and redis://user:pass@host:port)
function parseRedisUrl(url: string = 'redis://localhost:6379') {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || 'localhost',
      port: parseInt(parsed.port || '6379', 10),
      password: parsed.password || undefined,
      username: parsed.username || undefined,
    };
  } catch {
    return { host: 'localhost', port: 6379 };
  }
}

const connection = parseRedisUrl(process.env.REDIS_URL);

// Job queues by type
const queues = new Map<string, Queue>();
const workers = new Map<string, Worker>();
const handlers = new Map<string, JobHandler>();
const queueEvents = new Map<string, QueueEvents>();

/**
 * Get or create queue for job type
 */
function getQueue(type: string): Queue {
  let queue = queues.get(type);

  if (!queue) {
    queue = new Queue(type, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 200, // Keep last 200 failed jobs
      },
    });

    queues.set(type, queue);
    logger.info(`Queue created for job type: ${type}`);
  }

  return queue;
}

/**
 * Register a job handler and start worker
 */
export function registerJobHandler<T, R>(
  type: string,
  handler: JobHandler<T, R>,
  options?: {
    concurrency?: number;
    limiter?: {
      max: number;
      duration: number;
    };
  }
): void {
  handlers.set(type, handler);

  // Create worker for this job type
  const worker = new Worker<T, R>(
    type,
    async (job: BullJob<T>) => {
      logger.info(`Processing job ${job.id} of type ${type}`, {
        jobId: job.id,
        attempt: job.attemptsMade + 1,
        maxAttempts: job.opts.attempts,
      });

      try {
        const result = await handler(job.data, job);

        logger.info(`Job ${job.id} completed successfully`, {
          jobId: job.id,
          type,
        });

        return result;
      } catch (error: any) {
        logger.error(`Job ${job.id} failed`, error, {
          jobId: job.id,
          type,
          attempt: job.attemptsMade + 1,
        });

        throw error;
      }
    },
    {
      connection,
      concurrency: options?.concurrency || 5,
      limiter: options?.limiter,
    }
  );

  // Event handlers
  worker.on('completed', (job: BullJob<T, R>, result: R) => {
    logger.info(`Worker completed job ${job.id}`, {
      jobId: job.id,
      type,
      duration: Date.now() - job.timestamp,
    });
  });

  worker.on('failed', (job: BullJob<T> | undefined, error: Error) => {
    logger.error(`Worker failed job ${job?.id}`, error, {
      jobId: job?.id,
      type,
      attempts: job?.attemptsMade,
    });
  });

  worker.on('error', (error: Error) => {
    logger.error(`Worker error for type `, error, { type });
  });

  workers.set(type, worker);

  // Set up queue events for monitoring
  const events = new QueueEvents(type, { connection });

  events.on('waiting', ({ jobId }) => {
    logger.debug(`Job ${jobId} is waiting`, { jobId, type });
  });

  events.on('active', ({ jobId }) => {
    logger.debug(`Job ${jobId} is active`, { jobId, type });
  });

  events.on('completed', ({ jobId, returnvalue }) => {
    logger.debug(`Job ${jobId} completed`, { jobId, type });
  });

  events.on('failed', ({ jobId, failedReason }) => {
    logger.debug(`Job ${jobId} failed`, { jobId, type, reason: failedReason });
  });

  queueEvents.set(type, events);

  logger.info(`Job handler registered for type: ${type}`, {
    type,
    concurrency: options?.concurrency || 5,
  });
}

/**
 * Enqueue a new job
 */
export async function enqueueJob<T>(
  type: string,
  payload: T,
  options?: JobOptions
): Promise<Job<T>> {
  const queue = getQueue(type);

  const bullJob = await queue.add(type, payload, {
    priority: options?.priority,
    attempts: options?.maxAttempts || 3,
    delay: options?.delay,

    removeOnComplete: options?.removeOnComplete ?? 100,
    removeOnFail: options?.removeOnFail ?? 200,
  });

  logger.info(`Job enqueued: ${type}`, {
    jobId: bullJob.id,
    type,
    priority: options?.priority,
  });

  return mapBullJobToJob(bullJob);
}

/**
 * Get job by ID
 */
export async function getJob(jobId: string, type: string): Promise<Job | undefined> {
  const queue = getQueue(type);
  const bullJob = await queue.getJob(jobId);

  if (!bullJob) return undefined;

  return mapBullJobToJob(bullJob);
}

/**
 * Get all jobs of a type with filter
 */
export async function getAllJobs(
  type: string,
  filter?: {
    status?: JobStatus | JobStatus[];
    limit?: number;
  }
): Promise<Job[]> {
  const queue = getQueue(type);

  let statuses: JobStatus[];
  if (filter?.status) {
    statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
  } else {
    statuses = ['waiting', 'active', 'completed', 'failed', 'delayed', 'paused'];
  }

  // Fetch jobs for all statuses in parallel
  const jobPromises = statuses.map((status) =>
    queue.getJobs(status as any, 0, filter?.limit || 100)
  );

  const jobArrays = await Promise.all(jobPromises);
  const bullJobs = jobArrays.flat();

  return bullJobs.map(mapBullJobToJob);
}

/**
 * Cancel a job
 */
export async function cancelJob(jobId: string, type: string): Promise<boolean> {
  const queue = getQueue(type);
  const job = await queue.getJob(jobId);

  if (!job) return false;

  await job.remove();

  logger.info(`Job cancelled: ${jobId}`, { jobId, type });

  return true;
}

/**
 * Retry a failed job
 */
export async function retryJob(jobId: string, type: string): Promise<boolean> {
  const queue = getQueue(type);
  const job = await queue.getJob(jobId);

  if (!job) return false;

  await job.retry();

  logger.info(`Job retry requested: ${jobId}`, { jobId, type });

  return true;
}

/**
 * Get queue statistics
 */
export async function getQueueStats(type: string): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}> {
  const queue = getQueue(type);

  const counts = await queue.getJobCounts();

  return {
    waiting: counts.waiting || 0,
    active: counts.active || 0,
    completed: counts.completed || 0,
    failed: counts.failed || 0,
    delayed: counts.delayed || 0,
    paused: counts.paused || 0,
  };
}

/**
 * Pause queue (stop processing new jobs)
 */
export async function pauseQueue(type: string): Promise<void> {
  const queue = getQueue(type);
  await queue.pause();

  logger.info(`Queue paused: ${type}`, { type });
}

/**
 * Resume queue (start processing jobs again)
 */
export async function resumeQueue(type: string): Promise<void> {
  const queue = getQueue(type);
  await queue.resume();

  logger.info(`Queue resumed: ${type}`, { type });
}

/**
 * Clean completed/failed jobs
 */
export async function cleanQueue(
  type: string,
  age: number = 3600000, // 1 hour
  limit: number = 1000
): Promise<void> {
  const queue = getQueue(type);

  const [cleanedCompleted, cleanedFailed] = await Promise.all([
    queue.clean(age, limit, 'completed'),
    queue.clean(age, limit, 'failed'),
  ]);

  logger.info(`Queue cleaned: ${type}`, {
    type,
    cleanedCompleted,
    cleanedFailed,
  });
}

/**
 * Shutdown all workers and close connections
 */
export async function shutdown(): Promise<void> {
  logger.info('Shutting down BullMQ workers...');

  // Close all workers
  await Promise.all(Array.from(workers.values()).map((worker) => worker.close()));

  // Close all queue events
  await Promise.all(Array.from(queueEvents.values()).map((events) => events.close()));

  // Close all queues
  await Promise.all(Array.from(queues.values()).map((queue) => queue.close()));

  logger.info('BullMQ shutdown complete');
}

/**
 * Map BullMQ job to our Job interface
 * Note: getState() is async but we can use internal state for sync access
 */
function mapBullJobToJob<T>(bullJob: BullJob<T>): Job<T> {
  // Determine status from job properties (sync alternative to getState())
  let status: JobStatus = 'waiting';
  if (bullJob.finishedOn && bullJob.returnvalue) {
    status = 'completed';
  } else if (bullJob.failedReason) {
    status = 'failed';
  } else if (bullJob.processedOn) {
    status = 'active';
  } else if (bullJob.delay) {
    status = 'delayed';
  }

  return {
    id: bullJob.id!,
    type: bullJob.name,
    payload: bullJob.data,
    priority: (bullJob.opts.priority as JobPriority) || 3,
    status,
    attempts: bullJob.attemptsMade,
    maxAttempts: bullJob.opts.attempts || 3,
    createdAt: new Date(bullJob.timestamp),
    startedAt: bullJob.processedOn ? new Date(bullJob.processedOn) : undefined,
    completedAt: bullJob.finishedOn ? new Date(bullJob.finishedOn) : undefined,
    failedAt: bullJob.failedReason ? new Date(bullJob.finishedOn!) : undefined,
    error: bullJob.failedReason,
    result: bullJob.returnvalue,
    progress: bullJob.progress as number | undefined,
  };
}

// Register common job handlers
export function registerDefaultHandlers(): void {
  // Email sending
  registerJobHandler('send-email', async (payload: any) => {
    // TODO: Integrate with email service
    logger.info('Sending email', { to: payload.to, subject: payload.subject });
    return { sent: true };
  });

  // Webhook delivery
  registerJobHandler('webhook-delivery', async (payload: any) => {
    // TODO: Integrate with webhook service
    logger.info('Delivering webhook', { url: payload.url });
    return { delivered: true };
  });

  // Report generation
  registerJobHandler('generate-report', async (payload: any) => {
    // TODO: Integrate with report generation
    logger.info('Generating report', { type: payload.type });
    return { generated: true };
  });

  // Audit log cleanup
  registerJobHandler('cleanup-audit-logs', async (payload: any) => {
    // TODO: Integrate with audit service
    logger.info('Cleaning up audit logs', { olderThan: payload.olderThan });
    return { cleaned: true };
  });
}

// Process cleanup on exit
process.on('SIGTERM', async () => {
  await shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await shutdown();
  process.exit(0);
});
