# Sentient API Production Dockerfile
# Multi-stage build for optimized production image

FROM node:20-alpine AS base

# Install production dependencies
RUN apk add --no-cache curl

WORKDIR /app

# Copy package files (service-level package.json only, no lockfile needed for individual service)
COPY package.json ./

# Install production dependencies directly (no lockfile verification)
RUN npm install --omit=dev --no-package-lock

# Copy application source
COPY src ./src

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy dependencies and source from base
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/src ./src
COPY package.json ./

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["node", "src/server.js"]
