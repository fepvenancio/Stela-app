FROM node:22-slim AS base
RUN corepack enable

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./

# Copy packages needed by the service
COPY packages/core/ packages/core/
COPY services/indexer/ services/indexer/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build core first, then service
RUN pnpm --filter @stela/core build && pnpm --filter stela-apibara-indexer build

# --- Production stage ---
FROM node:22-slim AS production
RUN corepack enable

WORKDIR /app

COPY --from=base /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/turbo.json ./
COPY --from=base /app/packages/core/dist/ packages/core/dist/
COPY --from=base /app/packages/core/package.json packages/core/package.json
COPY --from=base /app/packages/core/src/abi/ packages/core/src/abi/
COPY --from=base /app/services/indexer/dist/ services/indexer/dist/
COPY --from=base /app/services/indexer/package.json services/indexer/package.json

RUN pnpm install --frozen-lockfile --prod

CMD ["node", "services/indexer/dist/index.js"]
