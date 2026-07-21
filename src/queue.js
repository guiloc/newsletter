import { readIndex, updateItem, saveArticleHtml } from './store.js';
import { extractArticle } from './extract.js';
import { buildDocument } from './template.js';

const MAX_ATTEMPTS = 3;

// Verrou simple pour éviter deux passes de traitement en parallèle
// (ex : une requête /add pendant que le démarrage rejoue la file).
let running = false;

// Transforme les items 'pending' (et les 'error' pas trop réessayés) en
// 'ready' : extraction mode lecture -> document HTML autonome sur le volume.
export async function processQueue() {
  if (running) return;
  running = true;
  try {
    const index = await readIndex();
    const todo = index.items.filter(
      (x) => x.status === 'pending' || (x.status === 'error' && (x.attempts || 0) < MAX_ATTEMPTS)
    );

    for (const item of todo) {
      try {
        const article = await extractArticle(item.url);
        await saveArticleHtml(item.id, buildDocument(article));
        await updateItem(item.id, {
          status: 'ready',
          title: article.title,
          byline: article.byline,
        });
      } catch (err) {
        await updateItem(item.id, {
          status: 'error',
          error: String(err?.message || err).slice(0, 300),
          attempts: (item.attempts || 0) + 1,
        });
      }
    }
  } finally {
    running = false;
  }
}
