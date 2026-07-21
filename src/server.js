import express from 'express';
import crypto from 'node:crypto';
import cron from 'node-cron';
import { nanoid } from 'nanoid';
import { config } from './config.js';
import { addItem } from './store.js';
import { processQueue } from './queue.js';
import { runDigest } from './run-digest.js';
import { bookmarkletPage } from './bookmarklet.js';
import { escapeHtml } from './util.js';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Comparaison à temps constant du token de capture.
function tokenOk(candidate) {
  if (!config.captureToken) return false;
  const a = Buffer.from(String(candidate || ''));
  const b = Buffer.from(config.captureToken);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Petite page HTML de confirmation, qui se referme toute seule (la fenêtre
// a été ouverte par le bookmarklet, donc window.close() est autorisé).
function statusPage(message, autoClose = false) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;
display:flex;align-items:center;justify-content:center;height:100vh;margin:0;
font-size:20px;color:#222;text-align:center;padding:20px}</style></head>
<body><div>${escapeHtml(message)}</div>
${autoClose ? '<script>setTimeout(function(){window.close()},1400)</script>' : ''}
</body></html>`;
}

app.get('/health', (_req, res) => res.json({ ok: true }));

// Page d'installation du bookmarklet — protégée par le token, car elle
// affiche ce token en clair. Il faut donc déjà le connaître pour la voir :
//   https://TON-URL/bookmarklet?token=XXX
app.get('/bookmarklet', (req, res) => {
  if (!tokenOk(req.query.token)) {
    return res
      .status(401)
      .type('html')
      .send(statusPage('⛔ Ajoute ?token=TON_TOKEN à l\'URL pour voir le bookmarklet.'));
  }
  res.type('html').send(bookmarkletPage(config.baseUrl, config.captureToken));
});

// Capture d'un article. Accepte GET (bookmarklet via window.open) et POST.
async function handleAdd(req, res) {
  const token = req.query.token ?? req.body?.token;
  const url = req.query.url ?? req.body?.url;
  const title = req.query.title ?? req.body?.title ?? '';

  if (!tokenOk(token)) return res.status(401).send(statusPage('⛔ Token invalide'));
  if (!url || !/^https?:\/\//i.test(url)) {
    return res.status(400).send(statusPage('⛔ URL invalide'));
  }

  await addItem({
    id: nanoid(10),
    url,
    title,
    status: 'pending',
    capturedAt: new Date().toISOString(),
  });

  // Extraction lancée en tâche de fond : on répond tout de suite.
  processQueue().catch((err) => console.error('processQueue:', err));

  res.send(statusPage('✓ Article ajouté', true));
}

app.get('/add', handleAdd);
app.post('/add', handleAdd);

// Force l'envoi du digest immédiatement, sans attendre le cron.
//   https://TON-URL/send-now?token=XXX
// Verrou pour éviter deux envois simultanés (le rendu des PDF prend du temps).
let digestRunning = false;
async function handleSendNow(req, res) {
  const token = req.query.token ?? req.body?.token;
  if (!tokenOk(token)) return res.status(401).send(statusPage('⛔ Token invalide'));
  if (digestRunning) return res.send(statusPage('⏳ Un envoi est déjà en cours…'));

  digestRunning = true;
  try {
    const result = await runDigest();
    const msg = result.sent
      ? `✓ Envoyé : ${result.attachments} PDF, ${result.links} lien(s) — ${result.size}`
      : `Rien à envoyer (${result.reason})`;
    res.send(statusPage(msg));
  } catch (err) {
    console.error('send-now:', err);
    res.status(500).send(statusPage(`⛔ Échec de l'envoi : ${err.message}`));
  } finally {
    digestRunning = false;
  }
}

app.get('/send-now', handleSendNow);
app.post('/send-now', handleSendNow);

app.listen(config.port, () => {
  console.log(`newsletter-tech en écoute sur le port ${config.port}`);

  // Rejoue les extractions en attente au démarrage (jobs perdus sur crash).
  processQueue().catch((err) => console.error('processQueue (démarrage):', err));

  // Cron in-process : partage le volume avec le serveur web (une seule
  // instance, un seul volume Railway).
  if (config.cron.enabled) {
    cron.schedule(
      config.cron.schedule,
      () => {
        console.log('Cron : envoi du digest…');
        runDigest()
          .then((r) => console.log('Cron :', JSON.stringify(r)))
          .catch((err) => console.error('Cron digest:', err));
      },
      { timezone: config.cron.tz }
    );
    console.log(`Cron programmé (${config.cron.schedule}, ${config.cron.tz}).`);
  }
});
