import { Logger } from '@nestjs/common';
import { Job as BullMQJob } from 'bullmq';
import { WorkerHost } from '@nestjs/bullmq';
import { BaseJobManager } from '@eco-solver/common/bullmq/base-job';
/**
 * Abstract class representing a base processor for liquidity manager jobs.
 * @template Job - The type of the job.
 * @template JobType - The constructor type of the job.
 */
export declare abstract class BaseProcessor<Job extends BullMQJob, JobManager extends BaseJobManager<Job> = BaseJobManager<Job>> extends WorkerHost {
    protected readonly name: string;
    protected readonly jobManagers: JobManager[];
    readonly logger: Logger;
    /**
     * Constructs a new BaseProcessor.
     * @param name - The name of the processor.
     * @param jobManagers - The array of job managers.
     */
    constructor(name: string, jobManagers: JobManager[]);
    /**
     * Processes a job.
     * @param job - The job to process.
     * @returns The result of the job execution.
     */
    process(job: Job): any;
    /**
     * Hook triggered when a job is completed.
     * @param job - The job that was completed.
     * @returns The result of the onCompleted hook from the job type.
     */
    onCompleted(job: Job): any;
    /**
     * Hook triggered when a job fails.
     * @param job - The job that failed.
     * @param error - The error that caused the job to fail.
     * @returns The result of the onFailed hook from the job type.
     */
    onFailed(job: Job, error: Error): any;
    /**
     * Executes a method on the job type that matches the given job.
     * @param job - The job to execute the method on.
     * @param method - The method to execute.
     * @param params - Additional parameters for the method.
     * @returns The result of the method execution.
     */
    private execute;
}
