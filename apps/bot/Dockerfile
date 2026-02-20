FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./

# Copy only the packages this app needs
COPY packages/core/package.json packages/core/
COPY apps/bot/package.json apps/bot/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/core/ packages/core/
COPY apps/bot/ apps/bot/

# Build
RUN pnpm turbo build --filter bot

# Production stage — smaller image, no dev deps or source
FROM node:22-alpine AS production
WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages/core/dist ./packages/core/dist
COPY --from=base /app/packages/core/package.json ./packages/core/package.json
COPY --from=base /app/apps/bot/dist ./apps/bot/dist
COPY --from=base /app/apps/bot/package.json ./apps/bot/package.json
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

CMD ["node", "apps/bot/dist/bot.js"]
