FROM node:22-bookworm-slim@sha256:5f56e27b5f10efe0a76d5fc7e305b261452ce8625c7b396e807f2b24b9d710db
WORKDIR /app
ENV NODE_ENV=production PORT=8081 ADMIN_PORT=8082 CONTACT_STORE_DIR=/data/inbox
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force
COPY src ./src
USER node
EXPOSE 8081 8082
CMD ["node", "src/server.mjs"]
