FROM node:22-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c
WORKDIR /app
ENV NODE_ENV=production PORT=8081 ADMIN_PORT=8082 CONTACT_STORE_DIR=/data/inbox
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force
COPY src ./src
USER node
EXPOSE 8081 8082
CMD ["node", "src/server.mjs"]
