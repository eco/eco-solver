export declare const QUEUES: Record<any, QueueInterface>;
export interface QueueMetadata {
    queue: string;
    prefix: string;
}
export interface QueueInterface extends QueueMetadata {
    jobs: Record<string, string>;
}
