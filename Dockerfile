# ---- build stage -----------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

RUN corepack enable

COPY pnpm-lock.yaml package.json ./
RUN pnpm fetch

COPY . .
RUN pnpm install --offline --frozen-lockfile
RUN pnpm build

# ---- runtime stage ----------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable

COPY pnpm-lock.yaml package.json ./
RUN pnpm fetch --prod
RUN pnpm install --offline --prod --frozen-lockfile

COPY server.js ./
COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["node", "server.js"]
