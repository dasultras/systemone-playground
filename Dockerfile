# Next.js standalone auf Node 24.
FROM node:24-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# --- Dependencies (Cache-Schicht: nur Manifest + Lockfile) ---
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# --- Build (Next standalone) ---
COPY . .
RUN npm run build

# --- Runtime: nur der Standalone-Server inkl. getracter Dependencies ---
FROM base AS runtime

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD ["node", "-e", "fetch('http://localhost:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

CMD ["node", "server.js"]
