import { readArticleHtml } from './store.js';
import { htmlToPdf, compressPdf } from './pdf.js';

// Retire les <img> du HTML stocké (variante « texte seul » de la dégradation).
const IMG_TAG = /<img\b[^>]*>/gi;

// Rend un item en PDF à un niveau de qualité donné.
//   includeImages : false => version texte seul (bien plus légère)
//   gsLevel       : 'ebook' | 'screen'
export async function renderItemPdf(item, { includeImages = true, gsLevel = 'ebook' } = {}) {
  let html = await readArticleHtml(item.id);
  if (!includeImages) html = html.replace(IMG_TAG, '');
  const pdf = await htmlToPdf(html);
  return compressPdf(pdf, gsLevel);
}
