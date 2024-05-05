# This Dockerfile uses `serve` npm package to serve the static files with node process.
# You can find the Dockerfile for nginx in the following link:
# https://github.com/refinedev/dockerfiles/blob/main/vite/Dockerfile.nginx
FROM node:lts-alpine3.12 as base

FROM base as deps
WORKDIR /frontend

COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* .npmrc* ./

RUN ls

RUN npm install

FROM deps as build

WORKDIR /frontend

COPY --from=deps /frontend/node_modules/ ./node_modules/

ENV NODE_ENV production

COPY . .

RUN ls

RUN npm run build

FROM nginx:1.18.0-alpine

COPY ./webserver/default.conf /etc/nginx/conf.d/default.conf

RUN ls

COPY --from=build /frontend/dist /usr/share/nginx/html

