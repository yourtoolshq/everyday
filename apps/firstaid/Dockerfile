FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
WORKDIR /app

FROM base AS prepare
COPY . .
RUN pnpm dlx turbo@2.5.8 prune firstaid --docker

FROM base AS deps
COPY --from=prepare /app/out/json/ .
RUN pnpm install --frozen-lockfile

FROM base AS builder
ENV SKIP_ENV_VALIDATION=1
ENV DATABASE_URL=file:/tmp/firstaid-build.db
COPY --from=deps /app/ .
COPY --from=prepare /app/out/full/ .
RUN pnpm turbo build --filter=firstaid

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL=file:/data/firstaid.db
ENV DOCUMENTS_DIR=/data/documents
RUN apk add --no-cache su-exec wget && addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/firstaid/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/firstaid/.next/static ./apps/firstaid/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/firstaid/scripts ./apps/firstaid/scripts
COPY --from=builder --chown=nextjs:nodejs /app/apps/firstaid/drizzle ./apps/firstaid/drizzle
# libSQL selects a native package at runtime; standalone tracing does not
# include every platform-specific optional dependency.
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

WORKDIR /app/apps/firstaid
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -q --spider http://127.0.0.1:3000/api/health || exit 1
ENTRYPOINT ["sh", "./scripts/docker-entrypoint.sh"]
