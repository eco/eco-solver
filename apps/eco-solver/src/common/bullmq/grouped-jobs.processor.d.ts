import { BaseProcessor } from '@eco-solver/common/bullmq/base.processor';
import { Job, Queue } from 'bullmq';
import { BaseJobManager } from '@eco-solver/common/bullmq/base-job';
type DataKeys<T> = T extends {
    data?: infer D;
} ? (D extends object ? keyof D : never) : never;
/**
 * Abstract class representing a processor for grouped jobs.
 * @template Job - The type of the job.
 */
export declare abstract class GroupedJobsProcessor<GroupJob extends Job = Job, JobManager extends BaseJobManager<GroupJob> = BaseJobManager<GroupJob>> extends BaseProcessor<GroupJob, JobManager> {
    protected readonly groupBy: DataKeys<GroupJob>;
    protected abstract readonly queue: Queue;
    protected readonly activeGroups: Set<string>;
    /**
     * Constructs a new GroupedJobsProcessor.
     * @param groupBy - The property to group jobs by.
     * @param params - Additional parameters for the base processor.
     */
    constructor(groupBy: DataKeys<GroupJob>, ...params: ConstructorParameters<typeof BaseProcessor<Job, JobManager>>);
    /**
     * Processes a job, ensuring that jobs in the same group are not processed concurrently.
     * @param job - The job to process.
     * @returns A promise that resolves to an object indicating if the job was delayed.
     */
    process(job: GroupJob): Promise<any>;
    /**
     * Hook triggered when a job is completed.
     * @param job - The job that was completed.
     */
    onCompleted(job: GroupJob): any;
    /**
     * Hook triggered when a job fails.
     * @param job - The job that was completed.
     * @param error - Error.
     */
    onFailed(job: GroupJob, error: Error): any;
}
export {};
