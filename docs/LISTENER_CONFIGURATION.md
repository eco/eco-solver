# Blockchain Listener Configuration

## Overview

The blockchain listener system supports multiple deployment configurations to handle different scaling and availability requirements. This document explains how to configure listeners for both single-instance and multi-instance deployments.

## Leader Election Pattern

When running multiple instances of the application, a Redis-based leader election system ensures only one instance runs blockchain listeners at a time, preventing duplicate event processing while maintaining high availability.

### How It Works

1. **Automatic Leader Election**: Instances compete for leadership using Redis atomic operations (SET NX)
2. **Heartbeat Mechanism**: The leader maintains its position by renewing the lock periodically
3. **Automatic Failover**: If the leader fails, another instance automatically takes over
4. **Event-Driven Coordination**: Leadership changes trigger events that start/stop listeners

### Architecture

The leader election service is part of the Redis module (`src/modules/redis/leader-election.service.ts`) and uses the shared Redis client for efficiency.

## Configuration Options

### Single Instance Mode (Default)

By default, leader election is disabled and all listeners start immediately:

```bash
# No additional configuration needed
pnpm run start:dev
```

### Multi-Instance Mode with Leader Election

Enable leader election to ensure only one instance runs listeners:

```bash
LEADER_ELECTION_ENABLED=true pnpm run start:dev
```

### Configuration Parameters

All leader election parameters can be configured via environment variables:

```bash
# Enable/disable leader election (default: false)
LEADER_ELECTION_ENABLED=true

# Redis lock key for leadership (default: 'solver:leader:lock')
LEADER_ELECTION_LOCK_KEY=solver:leader:lock

# Lock TTL in seconds (default: 30)
LEADER_ELECTION_LOCK_TTL_SECONDS=30

# Heartbeat interval in milliseconds (default: 10000)
LEADER_ELECTION_HEARTBEAT_INTERVAL_MS=10000

# Election check interval in milliseconds (default: 5000)
LEADER_ELECTION_CHECK_INTERVAL_MS=5000
```

### Disabling Specific Blockchain Listeners

You can disable listeners for specific blockchains while keeping others active:

```bash
# Disable EVM listeners
EVM_LISTENERS_ENABLED=false

# Disable Solana listeners
SVM_LISTENERS_ENABLED=false

# Disable Tron listeners
TVM_LISTENERS_ENABLED=false
```

## Deployment Scenarios

### Scenario 1: Development (Single Instance)

```bash
# Simple development setup - all listeners active
pnpm run start:dev
```

### Scenario 2: Production (Multiple Instances with HA)

```bash
# Instance 1
LEADER_ELECTION_ENABLED=true PORT=3001 pnpm run start:prod

# Instance 2
LEADER_ELECTION_ENABLED=true PORT=3002 pnpm run start:prod

# Instance 3
LEADER_ELECTION_ENABLED=true PORT=3003 pnpm run start:prod
```

Only one instance will run listeners at any time. If it fails, another automatically takes over.

### Scenario 3: Mixed Mode (API-only Instances)

```bash
# Listener instance (can become leader)
LEADER_ELECTION_ENABLED=true PORT=3001 pnpm run start:prod

# API-only instance 1 (never runs listeners)
EVM_LISTENERS_ENABLED=false \
SVM_LISTENERS_ENABLED=false \
TVM_LISTENERS_ENABLED=false \
PORT=3002 pnpm run start:prod

# API-only instance 2 (never runs listeners)
EVM_LISTENERS_ENABLED=false \
SVM_LISTENERS_ENABLED=false \
TVM_LISTENERS_ENABLED=false \
PORT=3003 pnpm run start:prod
```

## Monitoring Leader Election

### Checking Current Leader

The application logs leadership changes:

```
info: Instance instance-12345-1234567890-abc123 became the leader
info: Leadership gained - starting EVM listeners
info: Leadership gained - starting SVM listeners
```

### Leadership Loss

When an instance loses leadership (graceful shutdown or failure):

```
info: Instance instance-12345-1234567890-abc123 lost leadership
info: Leadership lost - stopping EVM listeners
info: Leadership lost - stopping SVM listeners
```

### Redis Commands for Monitoring

Check current leader:
```bash
redis-cli GET solver:leader:lock
```

Check lock TTL:
```bash
redis-cli TTL solver:leader:lock
```

## Best Practices

1. **Always Enable Leader Election in Production**: When running multiple instances, always enable leader election to prevent duplicate event processing.

2. **Configure Appropriate TTLs**:
   - Set `LEADER_ELECTION_LOCK_TTL_SECONDS` based on your failure detection requirements
   - Lower values = faster failover but more Redis operations
   - Higher values = slower failover but fewer Redis operations

3. **Monitor Redis Connection**: Leader election depends on Redis. Ensure Redis is highly available and monitor connection health.

4. **Graceful Shutdown**: The application automatically releases leadership on shutdown, allowing faster failover.

5. **Load Balancing**: Use a load balancer for API requests while leader election handles listener coordination.

## Troubleshooting

### Issue: Multiple Leaders

**Symptom**: Logs show multiple instances claiming leadership

**Cause**: Clock skew or network partitions

**Solution**:
- Ensure NTP synchronization across all instances
- Check Redis connectivity from all instances
- Increase `LEADER_ELECTION_LOCK_TTL_SECONDS`

### Issue: No Leader

**Symptom**: No instance becomes leader

**Cause**: Redis connection issues or incorrect configuration

**Solution**:
- Verify Redis is accessible: `redis-cli ping`
- Check Redis authentication if configured
- Verify `LEADER_ELECTION_ENABLED=true` is set
- Check application logs for Redis connection errors

### Issue: Frequent Leader Changes

**Symptom**: Leadership changes frequently between instances

**Cause**: Network issues or insufficient heartbeat interval

**Solution**:
- Increase `LEADER_ELECTION_HEARTBEAT_INTERVAL_MS`
- Check network latency between instances and Redis
- Monitor Redis performance

## Technical Implementation

The leader election system is implemented in the Redis module for efficient resource usage:

- **Location**: `src/modules/redis/leader-election.service.ts`
- **Redis Client**: Uses shared Redis connection from `RedisService`
- **Events**: Emits `leader.gained` and `leader.lost` via EventEmitter2
- **Integration**: Blockchain listener managers subscribe to leadership events

### Module Structure

```
src/modules/redis/
├── redis.module.ts           # Module definition
├── redis.service.ts          # Redis client management
├── redis-cache.service.ts    # Caching functionality
└── leader-election.service.ts # Leader election implementation
```

The consolidation into the Redis module ensures:
- Single Redis connection for all Redis operations
- Better code organization
- Reduced module complexity
- Efficient resource usage