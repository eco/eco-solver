FROM node:20

# Install pnpm globally
RUN corepack enable

WORKDIR /usr/src/app
COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm run build

EXPOSE 3000

ENTRYPOINT [ "pnpm", "start" ]