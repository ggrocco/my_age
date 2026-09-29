FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
WORKDIR /usr/share/nginx/html
COPY index.html styles.css ./
COPY src ./src
# index.html's import map points at these two three.js paths
COPY --from=deps /app/node_modules/three/build ./node_modules/three/build
COPY --from=deps /app/node_modules/three/examples/jsm ./node_modules/three/examples/jsm
EXPOSE 80
HEALTHCHECK CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
