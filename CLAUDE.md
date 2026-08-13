# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Langue : ce projet se discute **en français**.

## Ce que fait le projet

Capture d'articles web → PDF « mode lecture » → **un seul** digest quotidien par email, garanti **sous 7 Mo** (contrainte dure de la boîte de réception cible). Voir `README.md` pour la vue produit.

## Commandes

Node n'est **pas** global : il passe par **fnm**. Exporter le PATH avant toute commande node/npm :

```bash
export PATH="$HOME/.local/share/fnm/node-versions/v20.20.2/installation/bin:$PATH"
```

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur en watch sur `http://localhost:3000` |
| `npm start` | Serveur (prod) |
| `npm run process-queue` | Force l'extraction des articles `pending` → `ready` (sans attendre) |
| `npm run send-digest` | Force l'assemblage + envoi du digest (sans attendre le cron) |
| `npx playwright install chromium` | Installe le navigateur en local (déjà présent dans l'image Docker) |

Il n'y a **pas de suite de tests** ni de linter configurés. Pour vérifier une modif d'extraction/rendu, écrire un petit script `.mjs` **à la racine du projet** (pour que `playwright` se résolve) qui importe depuis `./src/...`, l'exécuter, puis le supprimer. Fermer le navigateur en fin de script avec `closeBrowser()` sinon le process ne rend pas la main.

## Architecture — le flux

```
Navigateur ──(bookmarklet + token)──▶ /add ──▶ file (volume) ──▶ cron in-process ──▶ Resend ──▶ boîte mail
                                        │                              │
                                  extract.js                       digest.js (échelle de dégradation < 7 Mo)
                                  (navigateur → repli RSS)
```

- **File d'attente = `index.json` + un `{id}.html` autonome par article**, sur un **volume persistant** (`src/store.js`). Pas de base de données (surdimensionné pour ~10 articles). Statuts : `pending` → `ready` → (supprimé après envoi) / `error`.
- Le HTML stocké est **autonome** : Readability + images **inline en data URI** (compressées via `sharp` à la capture). Le rendu PDF au moment de l'envoi n'a donc plus besoin du réseau, ce qui permet de **re-rendre à différentes qualités** pour l'échelle de dégradation.
- `src/run-digest.js` porte la logique d'envoi, appelée **à la fois** par le cron in-process (`src/server.js`) et par la CLI (`src/jobs/send-digest.js`).

## Décisions non évidentes (ne pas « corriger » sans comprendre)

- **Cron in-process, pas un service Railway séparé.** Un volume Railway ne peut être monté que sur **un seul** service à la fois ; un cron séparé n'aurait pas accès à la file. Le planificateur (`node-cron`) tourne donc dans le serveur web. Variables : `CRON_ENABLED`, `CRON_SCHEDULE`, `CRON_TZ`.
- **Budget email = 70 % du plafond.** Les pièces jointes sont encodées en base64 (+33 %). `digest.js` vise donc `limitMb * 0.70` en octets **bruts** pour que le message final reste sous 7 Mo. Ne pas remonter ce facteur sans marge.
- **Échelle de dégradation** (`digest.js`) : `/ebook` → `/screen` → texte seul → lien seul, en ne dégradant que ce qui est nécessaire, les plus lourds d'abord. Objectif : le mail **part toujours**, **aucun article perdu**.
- **Extraction en deux couches** (`extract.js`) : voie navigateur avec **empreinte anti-bot** (UA complète, client hints `sec-ch-ua`, `navigator.webdriver` masqué) ; **repli RSS** `{site}/feed` si blocage. Motif : les IP **datacenter** (Railway) se font renvoyer un **403** par Cloudflare/Substack là où une IP résidentielle passe — aucun réglage navigateur ne contourne un blocage par IP, mais le flux RSS n'est pas protégé.
- **Garde-fous d'extraction** : rejeter (throw) une réponse HTTP ≥ 400 ou une page quasi vide / « Error… » **plutôt que** de produire un PDF depuis une page d'erreur. Un throw ⇒ article marqué `error` ⇒ non envoyé.
- **Dockerfile** : part de l'image Playwright officielle (Chromium + deps déjà là) et ajoute Ghostscript. `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` évite de re-télécharger Chromium pendant `npm ci` (image plus légère, sous la limite 4 Go du plan Trial). La version de `playwright` dans `package.json` **doit** rester alignée avec le tag de l'image de base.

## Sécurité

- Tout est protégé par `CAPTURE_TOKEN` (comparaison timing-safe) : `/add`, `/send-now`, **et** `/bookmarklet` (qui affiche le token en clair).
- Le token est embarqué dans l'URL du bookmarklet — le considérer comme un secret, le régénérer en cas de fuite. Aucun secret n'est commité (`.env` ignoré ; `.env.example` ne contient que des placeholders).

## Contexte de déploiement

Hébergé sur **Railway** (plan **Trial**). Piège récurrent : les déploiements des tiers gratuits **restent en « Queued »** pendant les pics (throttling au profit des comptes Pro) — ce n'est ni le code ni la config. Le build repart seul quand un slot se libère. Détails de setup (volume sur `/data`, variables, Resend/DNS) dans `README.md`.
