# newsletter-tech

Capture d'articles web depuis le navigateur → PDF « mode lecture » → **un** digest quotidien par email, garanti **sous 7 Mo**.

## Le workflow

1. Sur un article intéressant, tu cliques un **bookmarklet** (Safari iOS/macOS, Firefox Windows).
2. L'URL part vers le service hébergé sur **Railway** (protégé par un token secret).
3. Le serveur extrait l'article en **mode lecture** (Readability), réduit/compresse les images, et stocke un PDF léger dans la file d'attente (un **volume** persistant).
4. Une fois par jour, tous les articles en attente partent dans **un seul email** via **Resend**. Une échelle de dégradation garantit que le mail reste sous le plafond de 7 Mo, puis la file est vidée.

## Architecture

```
Navigateur ──(bookmarklet + token)──▶ /add ──▶ file (volume) ──▶ cron quotidien ──▶ Resend ──▶ boîte mail
                                        │                             │
                                  extraction mode lecture       échelle de dégradation < 7 Mo
                                  + compression images
```

| Fichier | Rôle |
|---|---|
| `src/server.js` | Serveur HTTP (endpoint `/add`, `/bookmarklet`, `/health`) + cron in-process |
| `src/extract.js` | Chargement Chromium + Readability + inline/compression des images |
| `src/template.js` | Gabarit HTML imprimable (typographie mode lecture) |
| `src/pdf.js` | Rendu PDF (Playwright) + recompression Ghostscript |
| `src/digest.js` | Assemblage sous budget avec l'échelle de dégradation |
| `src/send.js` | Envoi de l'email via Resend |
| `src/run-digest.js` | Logique d'envoi quotidien (cron + CLI) |
| `src/queue.js` / `src/store.js` | File d'attente sur volume (index.json + fichiers HTML) |

## L'échelle de dégradation (le point clé)

Le digest tient dans **un seul mail** ; on ne dépasse jamais 7 Mo. Le budget des octets bruts est fixé à **70 % du plafond** pour absorber l'encodage base64 (+33 %) des pièces jointes. On descend d'un cran seulement si on dépasse encore :

1. Tous les PDF en `/ebook` (images 150 dpi) — cas normal.
2. Tous en `/screen` (images 72 dpi).
3. **Texte seul** (images retirées), les plus lourds d'abord.
4. **Lien seul** dans le mail (pas de pièce jointe), les plus lourds d'abord.

Garanties : le mail **part toujours**, et **aucun article n'est perdu** (au pire il devient un lien).

## Développement local

```bash
npm install
npx playwright install chromium   # navigateur pour le rendu
cp .env.example .env              # puis renseigne les valeurs
npm run dev                       # serveur sur http://localhost:3000
```

Ghostscript est optionnel en local (sans lui, pas de recompression, mais rien ne casse) : `brew install ghostscript`.

Générer un token :
```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Tester sans attendre le cron :
```bash
npm run process-queue   # force l'extraction des articles en attente
npm run send-digest     # force l'envoi du digest
```

Récupère le bookmarklet sur `http://localhost:3000/bookmarklet`.

## Déploiement Railway

1. **Nouveau projet** depuis ce dépôt. Le `Dockerfile` (image Playwright + Ghostscript) est détecté automatiquement.
2. **Volume** : attache un volume au service, monté sur `/data` (sinon la file est perdue à chaque redéploiement).
3. **Variables d'environnement** : reprends `.env.example` (`CAPTURE_TOKEN`, `BASE_URL` = l'URL publique du service, `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_TO`…).
4. Le **cron est in-process** (planificateur dans le serveur web, `CRON_SCHEDULE`), donc **pas besoin d'un second service** — ce qui évite le partage de volume, impossible sur Railway.

### Resend

- Ajoute et **vérifie ton domaine** dans Resend (enregistrements DNS SPF/DKIM).
- Utilise une adresse de ce domaine comme `MAIL_FROM`.
- Plan gratuit : 3 000 mails/mois, largement suffisant pour un digest quotidien.

## Bookmarklet

Ouvre `/<BASE_URL>/bookmarklet` et suis les instructions (glisser dans la barre de favoris sur desktop, créer un favori manuellement sur mobile). Le token est inclus dans le lien : ne le partage pas, régénère-le en cas de fuite.
