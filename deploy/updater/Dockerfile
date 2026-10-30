FROM node:22-alpine AS node
FROM docker:28-cli
RUN apk add --no-cache libstdc++
COPY --from=node /usr/local/bin/node /usr/local/bin/node
WORKDIR /updater
COPY deploy/updater/*.mjs ./
COPY server/http.mjs ./http.mjs
ENTRYPOINT ["node"]
CMD ["start.mjs"]
