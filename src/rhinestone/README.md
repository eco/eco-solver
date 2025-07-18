# Rhinestone WebSocket Module

This module provides a WebSocket client service for connecting to Rhinestone services.

## Structure

```
rhinestone/
├── services/
│   └── rhinestone-websocket.service.ts    # Main WebSocket service
├── types/
│   └── rhinestone-websocket.types.ts      # TypeScript types and interfaces
├── examples/
│   └── rhinestone.service.ts              # Example usage
├── standalone/                             # Standalone testing setup
│   ├── rhinestone-standalone.main.ts      # Standalone server entry point
│   ├── rhinestone-standalone.module.ts    # Module with mocked dependencies
│   ├── rhinestone-test.controller.ts      # REST endpoints for testing
│   └── mocks/
│       └── eco-config.service.mock.ts     # Mock EcoConfigService
└── rhinestone.module.ts                    # Main module
```

## Running Standalone Mode

The module can be run independently for testing purposes. This uses the original service files with a mocked EcoConfigService:

```bash
# Run with default WebSocket URL (ws://localhost:8080)
pnpm run start:rhinestone

# Run with auto-reload on file changes (development mode)
pnpm run start:rhinestone:dev

# Run with custom WebSocket URL
RHINESTONE_WS_URL=ws://example.com:8080 pnpm run start:rhinestone

# Run on custom port (default is 4000)
PORT=3002 pnpm run start:rhinestone
```

Note: The standalone mode uses the exact same `RhinestoneWebsocketService` from the main module but with mocked dependencies.

## API Endpoints (Standalone Mode)

When running in standalone mode, the following endpoints are available:

- `GET /rhinestone/status` - Get WebSocket connection status
- `POST /rhinestone/connect` - Connect to WebSocket server
- `POST /rhinestone/disconnect` - Disconnect from WebSocket server
- `POST /rhinestone/send` - Send raw message
- `POST /rhinestone/send-ping` - Send a Ping message
- `POST /rhinestone/send-bundle` - Send a Bundle message

## Message Types

The module supports two message types:

1. **Ping** - Keep-alive messages
   ```json
   {
     "type": "Ping",
     "timestamp": 1234567890
   }
   ```

2. **RhinestoneBundle** - Bundle messages
   ```json
   {
     "type": "RhinestoneBundle",
     "data": {...},
     "id": "optional-id"
   }
   ```

## Events

The service emits the following events via EventEmitter:

- `rhinestone.connected` - When connected to WebSocket
- `rhinestone.disconnected` - When disconnected
- `rhinestone.error` - On error
- `rhinestone.reconnect.failed` - When max reconnect attempts reached
- `rhinestone.message.Ping` - When Ping message received
- `rhinestone.message.RhinestoneBundle` - When Bundle message received

## Configuration

Configure the WebSocket URL in your environment config:

```typescript
rhinestone: {
  websocketUrl: 'ws://localhost:8080'
}
```

## Usage Example

```typescript
import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { RhinestoneWebsocketService } from './rhinestone/services/rhinestone-websocket.service'
import { RHINESTONE_EVENTS } from './rhinestone/types/rhinestone-websocket.types'

@Injectable()
export class MyService {
  constructor(private rhinestoneService: RhinestoneWebsocketService) {}

  async connect() {
    await this.rhinestoneService.connect()
  }

  @OnEvent(RHINESTONE_EVENTS.MESSAGE_BUNDLE)
  handleBundle(message: RhinestoneBundleMessage) {
    // Handle incoming bundle messages
  }
}
```