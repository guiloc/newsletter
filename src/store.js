import fs from 'node:fs/promises';
import path from 'node:path';
import { paths } from './config.js';

// File d'attente ultra-légère : un index.json + un fichier HTML autonome
// par article, le tout sur le volume persistant. Pas de base de données.
//
// Cycle de vie d'un item :
//   pending  -> URL capturée, article pas encore extrait
//   ready    -> HTML autonome (mode lecture, images inline) prêt à imprimer
//   error    -> extraction échouée (retentée jusqu'à 3 fois)

async function ensureDirs() {
  await fs.mkdir(paths.articles, { recursive: true });
}

export async function readIndex() {
  try {
    return JSON.parse(await fs.readFile(paths.index, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return { items: [] };
    throw err;
  }
}

// Écriture atomique : on écrit un fichier temporaire puis on le renomme,
// pour ne jamais laisser un index.json à moitié écrit.
export async function writeIndex(index) {
  await ensureDirs();
  const tmp = `${paths.index}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(index, null, 2));
  await fs.rename(tmp, paths.index);
}

export async function addItem(item) {
  const index = await readIndex();
  index.items.push(item);
  await writeIndex(index);
  return item;
}

export async function updateItem(id, patch) {
  const index = await readIndex();
  const item = index.items.find((x) => x.id === id);
  if (!item) return null;
  Object.assign(item, patch);
  await writeIndex(index);
  return item;
}

export function articleHtmlPath(id) {
  return path.join(paths.articles, `${id}.html`);
}

export async function saveArticleHtml(id, html) {
  await ensureDirs();
  await fs.writeFile(articleHtmlPath(id), html, 'utf8');
}

export async function readArticleHtml(id) {
  return fs.readFile(articleHtmlPath(id), 'utf8');
}

export async function removeItems(ids) {
  const index = await readIndex();
  index.items = index.items.filter((x) => !ids.includes(x.id));
  await writeIndex(index);
  await Promise.all(ids.map((id) => fs.rm(articleHtmlPath(id), { force: true })));
}
