const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(input = '') {
  return String(input).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

// Nom de fichier sûr pour une pièce jointe, dérivé du titre de l'article.
export function sanitizeFilename(title, fallback = 'article') {
  const cleaned = String(title || '')
    .replace(/[^\p{L}\p{N} \-_]/gu, '')
    .trim()
    .slice(0, 60)
    .replace(/\s+/g, '-');
  return cleaned || fallback;
}

export function formatMo(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
}
