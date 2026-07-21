# Image Playwright officielle : Chromium + toutes ses dépendances système
# sont déjà présents (version alignée avec "playwright" dans package.json).
FROM mcr.microsoft.com/playwright:v1.48.0-jammy

WORKDIR /app

# Ghostscript pour la recompression PDF (non fourni par l'image de base).
RUN apt-get update \
  && apt-get install -y --no-install-recommends ghostscript \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
# Chemin par défaut du volume persistant (à monter côté Railway).
ENV DATA_DIR=/data

EXPOSE 3000
CMD ["node", "src/server.js"]
