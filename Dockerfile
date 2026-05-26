# ── Stage 1: dependencies ─────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy only package files first (layer-cache optimization)
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && npm cache clean --force

# ── Stage 2: production image ─────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Security: run as non-root user
RUN addgroup -S tokenix && adduser -S tokenix -G tokenix

WORKDIR /app

# Copy installed deps from stage 1
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY --chown=tokenix:tokenix . .

# Remove dev files that don't belong in prod image
RUN rm -rf test/ .github/ .env.example 2>/dev/null || true

USER tokenix

# Application port
EXPOSE 3000

# Health check — Docker will restart the container if /api/health fails
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# Default environment
ENV NODE_ENV=production \
    PORT=3000

CMD ["node", "server.js"]
