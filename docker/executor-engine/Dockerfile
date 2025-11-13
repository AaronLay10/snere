# Scene Executor Dockerfile
# Multi-stage build with TypeScript compilation

FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json tsconfig.json ./

# Install all dependencies
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

# Install security updates
RUN apk --no-cache upgrade && \
    apk add --no-cache wget

# Create non-root user
RUN addgroup -g 1001 -S sentient && \
    adduser -u 1001 -S sentient -G sentient

WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application from builder
COPY --from=builder --chown=sentient:sentient /app/dist ./dist

# Copy configuration files if needed
COPY --chown=sentient:sentient config ./config

# Switch to non-root user
USER sentient

# Expose port
EXPOSE 3004

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3004/health || exit 1

# Start application
CMD ["node", "dist/index.js"]