import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import Redis, { Cluster } from 'ioredis';

import { LeaderElectionConfigService } from '@/modules/config/services/leader-election-config.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { RedisService } from './redis.service';

/**
 * Leader Election Service
 *
 * Implements a Redis-based leader election pattern using atomic operations.
 * Only one instance can hold the leader lock at a time.
 *
 * Algorithm:
 * 1. Each instance tries to acquire a lock with SET NX (set if not exists)
 * 2. Lock has a TTL to handle instance crashes
 * 3. Leader renews the lock periodically (heartbeat)
 * 4. Other instances check periodically if they can become leader
 * 5. Events are emitted on leadership changes
 */
@Injectable()
export class LeaderElectionService implements OnModuleInit, OnModuleDestroy {
  private redis?: Redis | Cluster;
  private instanceId: string;
  private isLeader = false;
  private heartbeatInterval?: NodeJS.Timeout;
  private electionInterval?: NodeJS.Timeout;
  private isShuttingDown = false;
  private isEnabled: boolean;

  constructor(
    private readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
    private readonly eventEmitter: EventEmitter2,
    private readonly leaderElectionConfig: LeaderElectionConfigService,
    private readonly redisService: RedisService,
  ) {
    this.logger.setContext(LeaderElectionService.name);
    // Generate unique instance ID
    this.instanceId = `instance-${process.pid}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async onModuleInit() {
    this.isEnabled = this.leaderElectionConfig.enabled;

    if (!this.isEnabled) {
      this.logger.log('Leader election is disabled via configuration');
      return;
    }

    // Get Redis client from the service
    this.redis = this.redisService.getClient();
    this.logger.log('Leader election using shared Redis connection');

    // Start election process
    await this.startElection();
  }

  async onModuleDestroy() {
    this.isShuttingDown = true;

    // Clear intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.electionInterval) {
      clearInterval(this.electionInterval);
    }

    // Release leadership if we are the leader
    if (this.isLeader) {
      await this.releaseLeadership();
    }

    // Note: We don't close the Redis connection here as it's managed by RedisService
  }

  /**
   * Check if this instance is the current leader
   * Returns true if leader election is disabled (single instance mode)
   */
  isCurrentLeader(): boolean {
    if (!this.isEnabled) {
      return true; // If leader election is disabled, act as leader
    }
    return this.isLeader;
  }

  /**
   * Get the current leader instance ID
   */
  async getCurrentLeader(): Promise<string | null> {
    if (!this.redis) {
      return this.instanceId; // If Redis not initialized, return current instance
    }
    try {
      return await this.redis.get(this.leaderElectionConfig.lockKey);
    } catch (error) {
      this.logger.error('Error getting current leader:', error as Error);
      return null;
    }
  }

  /**
   * Start the election process
   */
  private async startElection() {
    // Try to become leader immediately
    await this.tryBecomeLeader();

    // Set up periodic election checks
    this.electionInterval = setInterval(async () => {
      if (!this.isLeader && !this.isShuttingDown) {
        await this.tryBecomeLeader();
      }
    }, this.leaderElectionConfig.electionCheckIntervalMs);
  }

  /**
   * Try to become the leader
   */
  private async tryBecomeLeader() {
    const span = this.otelService.startSpan('leader.election.attempt', {
      attributes: {
        'instance.id': this.instanceId,
        'current.leader': this.isLeader,
      },
    });

    try {
      if (!this.redis) {
        throw new Error('Redis connection not initialized');
      }

      // Try to acquire the lock with SET NX EX
      const result = await this.redis.set(
        this.leaderElectionConfig.lockKey,
        this.instanceId,
        'EX',
        this.leaderElectionConfig.lockTtlSeconds,
        'NX',
      );

      if (result === 'OK') {
        // We successfully became the leader
        if (!this.isLeader) {
          this.isLeader = true;
          this.logger.log(`Instance ${this.instanceId} became the leader`);

          // Emit leadership gained event
          this.eventEmitter.emit('leader.gained', { instanceId: this.instanceId });

          // Start heartbeat to maintain leadership
          this.startHeartbeat();

          span.setAttributes({
            'leader.acquired': true,
            'leader.instance': this.instanceId,
          });
        }
      } else {
        // Another instance is the leader
        const currentLeader = await this.getCurrentLeader();
        if (this.isLeader && currentLeader !== this.instanceId) {
          // We lost leadership
          this.handleLeadershipLoss();
        }

        span.setAttributes({
          'leader.acquired': false,
          'current.leader.instance': currentLeader || 'unknown',
        });
      }

      span.setStatus({ code: 0 });
    } catch (error) {
      this.logger.error('Error during leader election:', error as Error);
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message });

      // If we can't connect to Redis, we should not be leader
      if (this.isLeader) {
        this.handleLeadershipLoss();
      }
    } finally {
      span.end();
    }
  }

  /**
   * Start heartbeat to maintain leadership
   */
  private startHeartbeat() {
    // Clear any existing heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(async () => {
      if (this.isLeader && !this.isShuttingDown) {
        await this.renewLeadership();
      }
    }, this.leaderElectionConfig.heartbeatIntervalMs);
  }

  /**
   * Renew leadership by extending the lock TTL
   */
  private async renewLeadership() {
    const span = this.otelService.startSpan('leader.heartbeat', {
      attributes: {
        'instance.id': this.instanceId,
      },
    });

    try {
      // Use Lua script for atomic check and renew
      const script = `
        local key = KEYS[1]
        local instanceId = ARGV[1]
        local ttl = ARGV[2]

        if redis.call('get', key) == instanceId then
          return redis.call('expire', key, ttl)
        else
          return 0
        end
      `;

      if (!this.redis) {
        throw new Error('Redis connection not initialized');
      }

      const result = await this.redis.eval(
        script,
        1,
        this.leaderElectionConfig.lockKey,
        this.instanceId,
        this.leaderElectionConfig.lockTtlSeconds,
      );

      if (result === 1) {
        // Successfully renewed
        span.setAttributes({ 'heartbeat.success': true });
      } else {
        // Lost leadership
        this.logger.warn(`Failed to renew leadership for ${this.instanceId}`);
        this.handleLeadershipLoss();
        span.setAttributes({ 'heartbeat.success': false });
      }

      span.setStatus({ code: 0 });
    } catch (error) {
      this.logger.error('Error renewing leadership:', error as Error);
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message });

      // Assume we lost leadership on error
      this.handleLeadershipLoss();
    } finally {
      span.end();
    }
  }

  /**
   * Handle loss of leadership
   */
  private handleLeadershipLoss() {
    if (this.isLeader) {
      this.isLeader = false;
      this.logger.log(`Instance ${this.instanceId} lost leadership`);

      // Clear heartbeat
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = undefined;
      }

      // Emit leadership lost event
      this.eventEmitter.emit('leader.lost', { instanceId: this.instanceId });
    }
  }

  /**
   * Explicitly release leadership
   */
  private async releaseLeadership() {
    const span = this.otelService.startSpan('leader.release', {
      attributes: {
        'instance.id': this.instanceId,
      },
    });

    try {
      // Use Lua script to atomically check and delete
      const script = `
        local key = KEYS[1]
        local instanceId = ARGV[1]

        if redis.call('get', key) == instanceId then
          return redis.call('del', key)
        else
          return 0
        end
      `;

      if (!this.redis) {
        return;
      }

      const result = await this.redis.eval(
        script,
        1,
        this.leaderElectionConfig.lockKey,
        this.instanceId,
      );

      if (result === 1) {
        this.logger.log(`Instance ${this.instanceId} released leadership`);
        span.setAttributes({ 'release.success': true });
      }

      this.handleLeadershipLoss();
      span.setStatus({ code: 0 });
    } catch (error) {
      this.logger.error('Error releasing leadership:', error as Error);
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message });
    } finally {
      span.end();
    }
  }
}
