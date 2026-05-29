# syntax=docker/dockerfile:1

# --- base: node + pnpm via corepack ---
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH="/pnpm:$PATH" \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

# --- deps: install with the frozen lockfile, cached separately ---
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# --- builder: produce the standalone server bundle ---
FROM base AS builder
# rewrites() reads these at build time, so they must be present for `next build`.
ARG HABIS_API_ORIGIN=http://habis-finance-api:8000
ARG NEXT_PUBLIC_API_VERSION=1
ENV HABIS_API_ORIGIN=$HABIS_API_ORIGIN \
    NEXT_PUBLIC_API_VERSION=$NEXT_PUBLIC_API_VERSION
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# --- runner: minimal production image ---
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

# Standalone bundle ships its own trimmed node_modules + minimal server.js.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=5s --timeout=5s --start-period=30s --retries=5 \
    CMD node -e "fetch('http://localhost:3000/').then(() => process.exit(0)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
