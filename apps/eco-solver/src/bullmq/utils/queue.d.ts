import { Queue } from 'bullmq';
export declare function removeJobSchedulers(queue: Queue, jobName: string): Promise<void>;
/**
 * Checks to see if there is a scheduled job of a given name in the queue.
 * @param queue the queue to check
 * @param jobName the name of the job to check
 * @returns
 */
export declare function isJobScheduled(queue: Queue, jobName: string): Promise<boolean>;
