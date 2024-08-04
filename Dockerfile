ARG NODE_VERSION=22.5.1

# Create build stage
FROM node:${NODE_VERSION}-slim AS build

RUN corepack enable

WORKDIR /app
COPY ./package.json /app/

#Build the app
RUN pnpm install

COPY . ./

#Build the app
ENV NODE_OPTIONS="--max_old_space_size=4096"
RUN npm run build 

# Create a new stage
FROM node:${NODE_VERSION}-slim

WORKDIR /app

COPY --from=build /app/.output ./

ENV HOST=0.0.0.0 NODE_ENV=production
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "/app/server/index.mjs"]
