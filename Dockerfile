# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Rendu PDF (poppler) et OCR (tesseract, français) pour l'occultation
RUN apt-get update \
 && apt-get install -y --no-install-recommends poppler-utils tesseract-ocr tesseract-ocr-fra \
 && rm -rf /var/lib/apt/lists/*

# ── Dépendances (+ génération du client Prisma) ──
FROM base AS deps
# URL factice : prisma.config.ts l'exige, aucune connexion n'est faite au build
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

# ── Outils : migrations, imports, worker de traitement des documents ──
FROM deps AS tools
COPY . .
RUN mkdir -p /data/storage && chown -R node:node /data /app
CMD ["sh"]

# ── Build Next.js ──
FROM deps AS builder
COPY . .
RUN npm run build

# ── Image d'exécution ──
FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 STORAGE_DIR=/data/storage
RUN mkdir -p /data/storage && chown -R node:node /data
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
