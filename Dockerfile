# Build stage
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy package files first for better layer caching
COPY package.json yarn.lock ./

# Install all dependencies (including dev dependencies for build)
RUN yarn install --frozen-lockfile

# Copy source code and config files
COPY src/ ./src/
COPY tsconfig.json ./
COPY tsconfig.build.json ./
COPY nest-cli.json ./

# Build the application
RUN yarn build

# Production stage
FROM node:20-alpine AS production

WORKDIR /usr/src/app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files with correct ownership
COPY --chown=nodejs:nodejs package.json yarn.lock ./

# Install only production dependencies (excludes dev deps like TypeScript, Jest, etc.)
# This creates a much smaller node_modules than copying from build stage
RUN yarn install --frozen-lockfile --production && \
    yarn cache clean

# Copy built application from builder stage with correct ownership
COPY --chown=nodejs:nodejs --from=builder /usr/src/app/dist ./dist

# Switch to non-root user
USER nodejs

EXPOSE 3000

# Use production start command
CMD ["node", "dist/main"]