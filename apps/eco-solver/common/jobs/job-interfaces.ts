import { Job } from 'bullmq'

/**
 * Base interface for all job managers in the application.
 * Provides common methods that all job managers should implement.
 */
export interface IJobManager<TJob extends Job = Job, TProcessor = unknown> {
  /**
   * Type guard to check if the given job is handled by this manager.
   * @param job - The job to check.
   * @returns True if the job is handled by this manager.
   */
  is(job: TJob): boolean

  /**
   * Process the job if it matches the manager's type.
   * @param job - The job to process.
   * @param processor - The processor handling the job.
   */
  process(job: TJob, processor: TProcessor): Promise<void>

  /**
   * Handle job failures.
   * @param job - The job that failed.
   * @param processor - The processor handling the job.
   * @param error - The error that occurred.
   */
  onFailed(job: TJob, processor: TProcessor, error: unknown): void

  /**
   * Handle successful job completion (optional).
   * @param job - The job that completed.
   * @param processor - The processor handling the job.
   */
  onComplete?(job: TJob, processor: TProcessor): Promise<void> | void
}

/**
 * Base interface for job data that includes common fields.
 */
export interface BaseJobData {
  id?: string
  [key: string]: unknown
}

/**
 * Base interface for processors that handle jobs.
 */
export interface IJobProcessor<TJob extends Job = Job> {
  /**
   * Process a job.
   * @param job - The job to process.
   */
  handle(job: TJob): Promise<void>
}

/**
 * Common job options that can be used across different job types.
 */
export interface CommonJobOptions {
  attempts?: number
  backoff?: {
    type: 'exponential' | 'fixed'
    delay: number
  }
  removeOnComplete?: boolean | number
  removeOnFail?: boolean | number
  delay?: number
  priority?: number
  jobId?: string
}

/**
 * Interface for job creation helpers.
 */
export interface IJobCreator<TJobData extends BaseJobData = BaseJobData, TJobName = string> {
  /**
   * Create a job with the specified data.
   * @param jobData - The data for the job.
   * @returns The job creation parameters.
   */
  createJob(jobData: TJobData): {
    name: TJobName
    data: TJobData
    opts?: CommonJobOptions
  }
}