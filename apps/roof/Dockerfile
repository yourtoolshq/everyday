FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
WORKDIR /app

FROM base AS prepare
COPY . .
RUN pnpm dlx turbo@2.5.8 prune roof --docker

FROM base AS deps
COPY --from=prepare /app/out/json/ .
RUN pnpm install --frozen-lockfile

FROM base AS builder
ENV SKIP_ENV_VALIDATION=1
ENV DATA_DIR=/tmp/roof-build-data
COPY --from=deps /app/ .
COPY --from=prepare /app/out/full/ .
RUN pnpm turbo build --filter=roof

FROM node:22-alpine AS runner
ARG APP_VERSION=
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATA_DIR=/data
ENV BACKUP_DIR=/backups
ENV APP_VERSION=${APP_VERSION}
RUN apk add --no-cache su-exec wget && addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/roof/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/roof/.next/static ./apps/roof/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/roof/drizzle ./apps/roof/drizzle
COPY --from=builder --chown=nextjs:nodejs /app/apps/roof/scripts ./apps/roof/scripts
COPY --from=builder --chown=nextjs:nodejs /app/packages/data/dist/yt-data.cjs ./apps/roof/scripts/yt-data.cjs
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/apps/roof/node_modules ./apps/roof/node_modules

RUN ln -s /app/apps/roof/scripts/yt-data /usr/local/bin/yt-data

WORKDIR /app/apps/roof
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -q --spider http://127.0.0.1:3000/api/health || exit 1
ENTRYPOINT ["sh", "./scripts/docker-entrypoint.sh"]
