# Dynamic Configuration System

## Overview

The Dynamic Configuration System provides real-time configuration management with MongoDB storage and change stream support for instant updates.

## MongoDB Requirements

### Version Requirements
- **MongoDB >= 6.0** required for reliable pre-image support
- **Replica Set or Sharded Cluster** (change streams don't work on standalone MongoDB)

### Pre-image Configuration
Change streams require pre-images to be enabled for DELETE operations and UPDATE old values:

```javascript
// Enable pre-images on the collection
db.runCommand({
  collMod: "configurations",
  changeStreamPreAndPostImages: { enabled: true }
})
```

Or enable at database level:
```javascript
db.runCommand({
  collMod: "configurations", 
  changeStreamPreAndPostImages: { enabled: true }
})
```

## Fallback Behavior

The system gracefully handles MongoDB limitations:

1. **Change Streams Available**: Real-time updates with 30-minute polling backup
2. **Change Streams Unavailable**: Falls back to 5-minute polling
3. **MongoDB Unavailable**: Uses cached configurations only

## Monitoring

### Health Check Endpoint

The system is integrated with the application health check endpoint at `/health`. This includes:

```json
{
  "status": "ok",
  "info": {
    "dynamic-config": {
      "status": "up",
      "cache": "up",
      "repository": "up", 
      "changeStreams": {
        "enabled": true,
        "active": true,
        "mode": "real-time"
      },
      "metrics": {
        "cacheSize": 42,
        "refreshInterval": 1800000
      }
    }
  }
}
```

### Programmatic Monitoring

For custom monitoring, use the detailed health check:

```typescript
const healthCheck = await dynamicConfigService.getDetailedHealthCheck();
console.log({
  changeStreamsActive: healthCheck.changeStreams.active, // Alert if false
  mode: healthCheck.changeStreams.mode, // Should be 'real-time' in production
  cacheSize: healthCheck.metrics.cacheSize
});
```

### Recommended Alerts

- **Change Stream Failure**: Alert when `changeStreams.active` becomes `false`
- **Polling Mode**: Alert when `mode` is `'polling'` for extended periods
- **Cache Size**: Alert on unexpected cache size changes
- **Repository Health**: Alert when `repository` is `false`

## Environment Variables

```bash
# Disable change streams if needed (defaults to enabled)
MONGODB_CHANGE_STREAMS_ENABLED=false
```

## Development vs Production

- **Development**: Often uses standalone MongoDB, so change streams may not work
- **Production**: Should use replica set with pre-images enabled for optimal performance