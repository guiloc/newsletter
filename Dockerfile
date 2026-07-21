# Image Playwright officielle : Chromium + toutes ses dépendances système
# sont déjà présents (version alignée avec "playwright" dans package.json).
FROM mcr.microsoft.com/playwright:v1.48.0-jammy

WORKDIR /app

# Ghostscript pour la recompression PDF (non fourni par l'image de base).
RUN apt-get update \
  && apt-get install -y --no-install-recommends ghostscript \
  && rm -rf /var/lib/apt/lists/*

# Chromium est déjà dans l'image de base : on empêche le paquet npm
# "playwright" de le re-télécharger pendant npm ci (image plus légère,
# build plus rapide, on reste loin de la limite 4 Go du plan Trial).
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
# Chemin par défaut du volume persistant (à monter côté Railway).
ENV DATA_DIR=/data

EXPOSE 3000
CMD ["node", "src/server.js"]
