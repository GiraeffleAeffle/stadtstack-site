FROM node:22-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY app ./app
COPY public ./public
COPY scripts ./scripts
COPY deploy/nginx.conf ./deploy/nginx.conf
COPY next.config.ts tsconfig.json next-env.d.ts postcss.config.mjs ./
RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine@sha256:e2a8fca8aa356d66159aaf8a877a9c126773635adf210503eefaaeaffeed6ad7
COPY --from=build /app/out/ /usr/share/nginx/html/
COPY --from=build /app/.next/export-nginx.conf /etc/nginx/nginx.conf
USER 101
EXPOSE 8080
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
