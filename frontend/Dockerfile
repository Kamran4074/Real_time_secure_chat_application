# Stage 1: build the React app
FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Vite bakes this into the bundle at build time
ARG VITE_BACKEND_URL=http://localhost:3000
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
RUN npm run build

# Stage 2: serve the static files with nginx
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
