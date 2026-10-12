FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY client/package.json client/package-lock.json ./client/
RUN npm ci --prefix client

COPY client ./client
RUN npm run build --prefix client

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production \
    DATA_DIR=/data \
    PORT=3001

COPY package.json package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY server ./server
COPY --from=build /app/client/dist ./client/dist

RUN mkdir -p /data && chown node:node /data

USER node
EXPOSE 3001

CMD ["node", "server/index.js"]