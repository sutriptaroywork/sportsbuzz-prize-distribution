# --------------> The build image__
FROM node:latest AS build
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init
WORKDIR /usr/src/app
COPY . /usr/src/app/
RUN --mount=type=secret,mode=0644,id=npmrc,target=/usr/src/app/.npmrc npm ci --omit=dev --legacy-peer-deps
RUN npm i -f @swc/cli @swc/core
RUN npm run build

# --------------> The production image__
FROM node:18.17.1-slim
COPY --from=build /usr/bin/dumb-init /usr/bin/dumb-init
USER node
WORKDIR /usr/src/app
COPY --chown=node:node --from=build /usr/src/app/node_modules /usr/src/app/node_modules
COPY --chown=node:node --from=build /usr/src/app/dist /usr/src/app
EXPOSE 1340
USER node
CMD ["dumb-init", "node", "index.js"]
