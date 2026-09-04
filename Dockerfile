# ──────────────────────────────────────────
# Stage 1: Builder
# ──────────────────────────────────────────
FROM node:22-bullseye AS builder

RUN apt-get update && apt-get install -y \
  python3 make g++ gcc sqlite3 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

RUN npm install

COPY . .

RUN npm run build

# ──────────────────────────────────────────
# Stage 2: Production Runtime
# ──────────────────────────────────────────
FROM node:22-bullseye AS runtime

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/.env ./

ENV NODE_ENV=production
ENV PORT=8000

EXPOSE 8000

CMD ["node", "dist/main.js"]
