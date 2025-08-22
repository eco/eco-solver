import { RegisterQueueOptions } from '@nestjs/bullmq';
import { DynamicModule } from '@nestjs/common';
import { QueueMetadata } from '@eco-solver/common/redis/constants';
/**
 * Initialize the BullMQ queue with the given token and eco configs
 * @param {QueueMetadata} queueInterface queue interface
 * @param {Partial<RegisterQueueOptions>} opts queue options
 * @returns
 */
export declare function initBullMQ(queueInterface: QueueMetadata, opts?: Partial<RegisterQueueOptions>): DynamicModule;
/**
 * Initialize the BullMQ flow with the given name and eco configs
 * @param {QueueMetadata} queueInterface queue interface
 * @returns
 */
export declare function initFlowBullMQ(queueInterface: QueueMetadata): DynamicModule;
