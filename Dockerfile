FROM node:26-alpine3.24 AS node

FROM alpine:3.24
RUN apk add --no-cache libstdc++ libgcc libatomic \
 && adduser -D -H -u 1000 node \
 && mkdir /data && chown node:node /data
COPY --from=node /usr/local/bin/node /usr/local/bin/node

WORKDIR /app
COPY server.js ./
COPY public ./public

USER node
ENV HOST=0.0.0.0 DB_PATH=/data/log.db
VOLUME /data

CMD ["node", "server.js"]
