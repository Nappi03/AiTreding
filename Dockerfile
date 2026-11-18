# ==============================================================================
# AiTrading - Docker Multi-Stage Build (Next.js Standalone + SQLite)
# ==============================================================================

# STAGE 1: Install dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# STAGE 2: Build Application & Generate Prisma
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set build-time env
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/data/trading.db"

# Generate Prisma Client and build standalone Next.js bundle
RUN npx prisma generate
RUN npm run build

# STAGE 3: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:/app/data/trading.db"
ENV TZ="Europe/Rome"

# Install tzdata for Italy cron timing and prisma CLI for fast DB push
RUN apk add --no-cache tzdata && npm install -g prisma@6.4.1

# Create data directory with proper write permissions for SQLite volume
RUN mkdir -p /app/data && chmod 777 /app/data

# Copy built application assets
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

# Copy entrypoint script
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 3000

VOLUME ["/app/data"]

ENTRYPOINT ["./entrypoint.sh"]
