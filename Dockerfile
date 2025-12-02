# Build stage
FROM node:20-slim AS builder

RUN corepack enable && apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and pnpm config first for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .pnpmrc ./

# Use shamefully-hoist to create flat node_modules (pnpm symlinks don't copy well)
RUN pnpm install --frozen-lockfile --shamefully-hoist

# Copy source and build
COPY . .
RUN pnpm run build

# Capture git commit hash before .git is discarded
RUN git rev-parse HEAD > .git-commit

# Compile config files to JavaScript (config package needs ts-node otherwise)
RUN npx tsc --outDir config-compiled --target ES2021 --module commonjs --esModuleInterop true config/*.ts

# Verify build output exists (NestJS outputs to dist/src/)
RUN ls -la dist/src/ && test -f dist/src/main.js

# Prune dev dependencies
RUN pnpm prune --prod

# Production stage
FROM node:20-slim AS runner

WORKDIR /app

# Copy node_modules from builder (now flat structure, no broken symlinks)
COPY --from=builder /app/node_modules ./node_modules

# Copy built output and compiled config
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/config-compiled ./config
COPY --from=builder /app/package.json ./

# Copy git commit hash file
COPY --from=builder /app/.git-commit ./.git-commit

EXPOSE 3000

# Run pre-compiled JavaScript directly - no TypeScript compilation at runtime
ENTRYPOINT ["node", "dist/src/main.js"]
