import { escapeHtml } from './util.js';

// Enveloppe le contenu de l'article dans un document HTML autonome et
// imprimable, avec une typographie « mode lecture » sobre. Les images sont
// déjà des data URIs (voir extract.js), donc ce document ne dépend d'aucun
// réseau : il peut être imprimé en PDF de façon déterministe, même plus tard.
export function buildDocument({ title, byline, url, contentHtml }) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 12pt;
    line-height: 1.55;
    color: #1a1a1a;
    margin: 0;
  }
  article { max-width: 720px; margin: 0 auto; }
  h1 { font-size: 22pt; line-height: 1.2; margin: 0 0 6px; }
  h2 { font-size: 16pt; margin: 1.4em 0 0.4em; }
  h3 { font-size: 13pt; margin: 1.2em 0 0.3em; }
  .byline { color: #555; font-style: italic; margin: 0 0 4px; }
  .source { font-size: 9pt; color: #777; word-break: break-all; margin: 0 0 10px; }
  .source a { color: #777; text-decoration: none; }
  hr { border: none; border-top: 1px solid #ddd; margin: 14px 0 20px; }
  img { max-width: 100%; height: auto; display: block; margin: 12px auto; }
  figure { margin: 12px 0; }
  figcaption { font-size: 9pt; color: #777; text-align: center; }
  p { margin: 0 0 0.9em; }
  a { color: #1a4fa0; }
  blockquote {
    margin: 1em 0; padding-left: 14px;
    border-left: 3px solid #ccc; color: #444;
  }
  pre, code { font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 10pt; }
  pre { background: #f5f5f5; padding: 10px; overflow-x: auto; white-space: pre-wrap; }
  table { border-collapse: collapse; width: 100%; font-size: 10pt; }
  td, th { border: 1px solid #ddd; padding: 5px 7px; }
</style>
</head>
<body>
  <article>
    <h1>${escapeHtml(title)}</h1>
    ${byline ? `<p class="byline">${escapeHtml(byline)}</p>` : ''}
    <p class="source"><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>
    <hr>
    ${contentHtml}
  </article>
</body>
</html>`;
}
