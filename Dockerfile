# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/bolts/package.json ./apps/bolts/package.json
COPY apps/bolts/prisma ./apps/bolts/prisma
COPY prisma ./prisma
RUN npm ci

FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?sslmode=disable"
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build:apps

FROM node:20-bookworm-slim AS runtime-base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates nginx gettext-base tini && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

FROM runtime-base AS runner

# Standalone server + static + public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Keep Bolts' traced dependencies isolated from Doof's standalone bundle.
COPY --from=builder /app/apps/bolts/.next/standalone /opt/bolts
COPY --from=builder /app/apps/bolts/.next/static /opt/bolts/apps/bolts/.next/static
COPY --from=builder /app/apps/bolts/prisma /opt/bolts/apps/bolts/prisma
COPY --from=builder /app/apps/bolts/src/generated/prisma /opt/bolts/apps/bolts/src/generated/prisma

# Prisma migrations + schema
COPY --from=builder /app/prisma ./prisma
# Generated Prisma client used at runtime by the app
COPY --from=builder /app/src/generated/prisma ./src/generated/prisma

# Install prisma CLI standalone so `prisma migrate deploy` works at startup
# (the standalone build excludes dev deps; prisma + its transitive deps are needed)
RUN npm install --omit=dev --no-package-lock --prefix /opt/prisma prisma@6.19.3

COPY entrypoint.sh ./entrypoint.sh
COPY infra/nginx.conf.template ./infra/nginx.conf.template
RUN chmod +x ./entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["./entrypoint.sh"]
