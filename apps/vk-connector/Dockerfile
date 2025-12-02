# Multi-stage Dockerfile for VK Connector
# Stage 1: Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/ ./packages/
COPY apps/vk-connector/package*.json ./apps/vk-connector/

# Install dependencies
RUN npm install

# Copy source code
COPY packages/ ./packages/
COPY apps/vk-connector/ ./apps/vk-connector/
COPY tsconfig.json ./
COPY turbo.json ./

# Clean and build shared packages first using tsc directly
RUN cd packages/shared/types && npm run clean && npx tsc
RUN cd packages/shared/utils && npm run clean && npx tsc
RUN cd packages/shared/chatwoot-client && npm run clean && npx tsc

# Build the VK connector
RUN cd apps/vk-connector && npm run clean && npx tsc

# Stage 2: Production stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S vkconnector -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/ ./packages/
COPY apps/vk-connector/package*.json ./apps/vk-connector/

# Install only production dependencies
RUN npm install --only=production && npm cache clean --force

# Copy built artifacts from builder stage
COPY --from=builder --chown=vkconnector:nodejs /app/packages/shared/types/dist ./packages/shared/types/dist
COPY --from=builder --chown=vkconnector:nodejs /app/packages/shared/utils/dist ./packages/shared/utils/dist
COPY --from=builder --chown=vkconnector:nodejs /app/packages/shared/chatwoot-client/dist ./packages/shared/chatwoot-client/dist
COPY --from=builder --chown=vkconnector:nodejs /app/apps/vk-connector/dist ./apps/vk-connector/dist
COPY --from=builder --chown=vkconnector:nodejs /app/apps/vk-connector/public ./apps/vk-connector/public

# Switch to non-root user
USER vkconnector

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/vk-connector/dist/server.js"]