# Multi-stage build: compile the Vite SPA, then run the thin Express server
# that serves dist/ and the auth/character-sync API.

# --- build stage -------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Install all deps (incl. dev) for the Vite build.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- runtime stage -----------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Production deps only (express + fflate).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Server code + built SPA.
COPY server ./server
COPY --from=build /app/dist ./dist

# Character/user data persists here; mounted as a volume in compose.
ENV CS_DATA_FILE=/data/users.json
VOLUME ["/data"]

EXPOSE 3000
CMD ["node", "server/index.js"]
