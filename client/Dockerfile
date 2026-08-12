# Builds the React frontend and outputs the static bundle.
# Used by docker-compose: a one-shot service that populates a shared volume
# which Caddy serves; the API handles /api/* behind it.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM scratch AS export
COPY --from=build /app/dist /out
