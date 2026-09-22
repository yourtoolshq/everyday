FROM node:22-alpine3.22 AS base
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
WORKDIR /app

FROM base AS prepare
COPY . .
RUN pnpm dlx turbo@2.5.8 prune tenure --docker

FROM base AS deps
COPY --from=prepare /app/out/json/ .
RUN pnpm install --frozen-lockfile

FROM base AS builder
ENV SKIP_ENV_VALIDATION=1
ENV DATABASE_URL=file:/tmp/tenure-build.db
ENV DOCUMENTS_DIR=/tmp/tenure-build-documents
COPY --from=deps /app/ .
COPY --from=prepare /app/out/full/ .
RUN pnpm turbo build --filter=tenure

FROM node:22-alpine3.22 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL=file:/data/tenure.db
ENV DOCUMENTS_DIR=/data/documents
RUN apk add --no-cache sqlite su-exec wget && addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/tenure/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/tenure/.next/static ./apps/tenure/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/tenure/public ./apps/tenure/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/tenure/drizzle ./apps/tenure/drizzle
COPY --from=builder --chown=nextjs:nodejs /app/apps/tenure/scripts ./apps/tenure/scripts
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/apps/tenure/node_modules ./apps/tenure/node_modules

WORKDIR /app/apps/tenure
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -q --spider http://127.0.0.1:3000/api/health || exit 1
ENTRYPOINT ["sh", "./scripts/docker-entrypoint.sh"]
