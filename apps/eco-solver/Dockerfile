FROM node:20-alpine

# Install pnpm globally
RUN corepack enable pnpm

WORKDIR /usr/src/app

# Copy package files (for better Docker layer caching)
COPY package*.json pnpm-lock.yaml ./
COPY nx.json ./
COPY tsconfig.base.json ./

# Copy app specific files
COPY apps/eco-solver ./apps/eco-solver/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build the application
RUN pnpm nx build eco-solver

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/apps/eco-solver/main.js"]