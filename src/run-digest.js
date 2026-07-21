import { readIndex, removeItems } from './store.js';
import { processQueue } from './queue.js';
import { buildDigest } from './digest.js';
import { sendDigest } from './send.js';
import { formatMo } from './util.js';

// Logique complète de l'envoi quotidien, réutilisée par le cron in-process
// (server.js) et par le script CLI (jobs/send-digest.js).
export async function runDigest() {
  // On termine d'abord les extractions en attente, pour n'oublier aucun
  // article capturé juste avant l'heure d'envoi.
  await processQueue();

  const index = await readIndex();
  const ready = index.items.filter((x) => x.status === 'ready');

  if (ready.length === 0) {
    return { sent: false, reason: 'Aucun article prêt à envoyer.' };
  }

  const dateLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const digest = await buildDigest(ready);
  await sendDigest(digest, dateLabel);

  // Succès -> on vide la file (PDF non conservés, cf. décision de rétention).
  await removeItems(ready.map((x) => x.id));

  return {
    sent: true,
    attachments: digest.attachments.length,
    links: digest.linkOnly.length,
    size: formatMo(digest.totalBytes),
  };
}
