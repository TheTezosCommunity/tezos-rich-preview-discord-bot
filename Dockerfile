# Use Bun's official image
FROM oven/bun:1 as base
WORKDIR /usr/src/app

# Install dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Production stage
FROM oven/bun:1-slim as production
WORKDIR /usr/src/app

# Copy built application
COPY --from=base /usr/src/app/dist ./dist
COPY --from=base /usr/src/app/node_modules ./node_modules
COPY --from=base /usr/src/app/package.json ./

# Create logs directory
RUN mkdir -p logs

# Create non-root user
RUN addgroup --system --gid 1001 bot && \
    adduser --system --uid 1001 --ingroup bot bot && \
    chown -R bot:bot /usr/src/app

USER bot

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD bun run --version || exit 1

# Expose port (if needed for metrics/health endpoints)
EXPOSE 3000

# Start the bot
CMD ["bun", "run", "start"]