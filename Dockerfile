# Use Node.js 22 Alpine as base image for build steps
FROM node:22.21-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Node runtime layer for the final image
FROM base AS node_runtime

# Production image, copy all the files and run next
FROM python:3.13-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/requirements.txt ./requirements.txt
COPY --from=node_runtime /usr/local/bin/node /usr/local/bin/node
COPY --from=node_runtime /usr/local/lib/node_modules /usr/local/lib/node_modules

RUN apk add --no-cache \
    py3-pip \
    libstdc++ \
    freetype \
    libpng \
  && apk add --no-cache --virtual .build-deps \
    build-base \
    python3-dev \
    musl-dev \
    freetype-dev \
    libpng-dev \
  && python3 -m pip install --no-cache-dir -r requirements.txt \
  && apk del .build-deps

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Copy all application files owned by root — the nextjs user can read but NOT modify them.
# This prevents an attacker running as nextjs from overwriting JS bundles or scripts.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/scripts/word_cloud_generator.py ./scripts/word_cloud_generator.py
COPY --from=builder /app/data ./data

# Grant the nextjs user write access ONLY to the directories that need it at runtime:
#   .next      — Next.js writes server-side cache here
#   /tmp/wordcloud — isolated temp directory for word cloud CSV/SVG files
# Everything else stays root-owned and read-only to the app user.
RUN mkdir -p .next /tmp/wordcloud \
 && chown nextjs:nodejs .next /tmp/wordcloud \
 && chmod 750 .next /tmp/wordcloud

USER nextjs

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# Scope word cloud temp files to the dedicated directory instead of /tmp
ENV TEMP_FOLDER=/tmp/wordcloud

EXPOSE 3000

# Restart the container if the app stops responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO/dev/null http://localhost:3000/ || exit 1

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD ["node", "server.js"]
