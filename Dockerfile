ARG NODE_VERSION=24.21.0
FROM node:${NODE_VERSION}-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
ARG VUEFIRE_API_KEY
ARG VUEFIRE_AUTH_DOMAIN
ARG VUEFIRE_PROJECT_ID
ARG VUEFIRE_STORAGE_BUCKET
ARG VUEFIRE_MESSAGING_SENDER_ID
ARG VUEFIRE_APP_ID
ARG RECAPTCHA_KEY
ARG NUXT_PUBLIC_MAPBOX_GL_ACCESS_TOKEN
ARG MAX_OLD_SPACE_SIZE_MB=4096
ENV NODE_OPTIONS="--max_old_space_size=${MAX_OLD_SPACE_SIZE_MB}"
RUN pnpm exec nuxt prepare && pnpm build

FROM node:${NODE_VERSION}-slim
WORKDIR /app
COPY --from=build --chown=node:node /app/.output ./
ENV HOST=0.0.0.0
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["node", "/app/server/index.mjs"]
