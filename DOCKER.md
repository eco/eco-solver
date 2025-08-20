# Docker Integration for Eco-Solver

This document outlines the Docker integration setup for the eco-solver application in the Nx monorepo.

## Files Created

### Production Docker Files

- `apps/eco-solver/Dockerfile` - Production Dockerfile for building the eco-solver app
- `docker-compose.yml` - Production compose with MongoDB and Redis dependencies

### Development Docker Files

- `apps/eco-solver/Dockerfile.dev` - Development Dockerfile with hot reloading
- `docker-compose.dev.yml` - Development compose with volume mounting for live changes

### Configuration Files

- `.dockerignore` - Excludes unnecessary files from Docker build context

## Available Scripts

### Production

```bash
# Build production Docker image
pnpm run docker:build

# Run production containers
pnpm run docker:prod

# Build and run production containers
pnpm run docker:prod:build

# Stop production containers
pnpm run docker:down
```

### Development

```bash
# Run development containers with live reloading
pnpm run docker:dev

# Build and run development containers
pnpm run docker:dev:build

# Stop development containers
pnpm run docker:down:dev
```

## Testing Instructions

To test the Docker integration once Docker daemon is running:

1. **Test production build**:

   ```bash
   pnpm run docker:build
   pnpm run docker:run
   ```

2. **Test production compose**:

   ```bash
   pnpm run docker:prod:build
   # Verify at http://localhost:3000
   pnpm run docker:down
   ```

3. **Test development compose**:
   ```bash
   pnpm run docker:dev:build
   # Verify at http://localhost:3000 with hot reloading
   pnpm run docker:down:dev
   ```

## Environment Configuration

The Docker containers are configured to:

- Use the monorepo Nx build system
- Set proper `NODE_CONFIG_DIR` for configuration loading
- Connect to MongoDB and Redis services
- Handle both development and production environments

## Prerequisites

- Docker and Docker Compose installed
- Nx build system working (`pnpm nx build eco-solver` should succeed)
- All previous migration phases completed (dependencies, configuration, etc.)
