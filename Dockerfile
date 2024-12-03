# Define constants
ARG NODE_VERSION=22.10.0
ARG MAX_OLD_SPACE_SIZE_MB=4096

# Build Stage: Set up environment and build the application
FROM node:${NODE_VERSION}-slim AS build
WORKDIR /app

# Enable corepack and install dependencies
RUN corepack enable
COPY ./package.json /app/
RUN pnpm install

# Copy source files and build
COPY . ./
ENV NODE_OPTIONS="--max_old_space_size=${MAX_OLD_SPACE_SIZE_MB}"
RUN pnpm run build

# Production Stage: Prepare a slim production image
FROM node:${NODE_VERSION}-slim
WORKDIR /app

# Copy the application output
COPY --from=build /app/.output ./

# Set environment variables for production
ENV HOST=0.0.0.0
ENV NODE_ENV=production
EXPOSE 3000

# Start the application
CMD ["node", "/app/server/index.mjs"]