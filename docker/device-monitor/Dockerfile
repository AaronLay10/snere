# Device Monitor Dockerfile
# Multi-stage build for optimized production image

FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code
COPY . .

# Production stage
FROM node:20-alpine

# Install security updates
RUN apk --no-cache upgrade && \
    apk add --no-cache wget

# Create non-root user
RUN addgroup -g 1001 -S sentient && \
    adduser -u 1001 -S sentient -G sentient

WORKDIR /app

# Copy from builder
COPY --from=builder --chown=sentient:sentient /app/node_modules ./node_modules
COPY --chown=sentient:sentient . .

# Switch to non-root user
USER sentient

# Expose port
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3003/health || exit 1

# Start application
CMD ["node", "server.js"]