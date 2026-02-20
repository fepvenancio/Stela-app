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

CMD ["node", "apps/bot/dist/bot.js"]
