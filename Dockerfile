# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev --include=optional --no-audit --no-fund
COPY . .
ARG STUL_VERSION
ARG STUL_REVISION
RUN STUL_VERSION="$STUL_VERSION" STUL_REVISION="$STUL_REVISION" npm run build:node

FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=8080 STUL_DATA_DIR=/data
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/server ./server
COPY --from=build /app/package.json ./package.json
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server/start.mjs"]
