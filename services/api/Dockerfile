# Sentient API Production Dockerfile
# Multi-stage build for optimized production image

FROM node:20-alpine AS builder

# Install build tools
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package.json tsconfig.json ./

# Install ALL dependencies (including dev for TypeScript compilation)
RUN npm install --no-package-lock

# Copy application source
COPY src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

# Install runtime dependencies
RUN apk add --no-cache curl

WORKDIR /app

ENV NODE_ENV=production

# Copy package files and install only production dependencies
COPY package.json ./
RUN npm install --omit=dev --no-package-lock

# Copy built JavaScript from builder
COPY --from=builder /app/dist ./dist

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start application from compiled dist
CMD ["node", "dist/server.js"]
