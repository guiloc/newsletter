import { escapeHtml } from './util.js';

// Code du bookmarklet : ouvre une petite fenêtre vers /add avec l'URL et le
// titre de la page courante. Fonctionne sur Safari iOS, Safari macOS et
// Firefox Windows (exécuté depuis les favoris).
export function bookmarkletCode(baseUrl, token) {
  return (
    `javascript:(function(){` +
    `var u=encodeURIComponent(location.href),` +
    `t=encodeURIComponent(document.title);` +
    `window.open('${baseUrl}/add?token=${encodeURIComponent(token)}&url='+u+'&title='+t,` +
    `'nl','width=440,height=260');})();`
  );
}

// Page d'installation : on y glisse le lien vers la barre de favoris.
export function bookmarkletPage(baseUrl, token) {
  const configured = baseUrl && token;
  const code = configured ? bookmarkletCode(baseUrl, token) : '';

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Installer le bookmarklet</title>
<style>
  body { font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif;
         max-width: 640px; margin: 40px auto; padding: 0 20px; line-height: 1.5; color: #222; }
  .btn { display: inline-block; background: #1a4fa0; color: #fff; text-decoration: none;
         padding: 10px 18px; border-radius: 8px; font-weight: 600; }
  code, textarea { font-family: Menlo, Consolas, monospace; font-size: 12px; }
  textarea { width: 100%; height: 90px; margin-top: 8px; }
  .warn { background: #fff6e0; border: 1px solid #f0d48a; padding: 12px; border-radius: 8px; }
</style></head>
<body>
  <h1>📎 Bookmarklet « Envoyer l'article »</h1>
  ${
    configured
      ? `<p>Glisse ce bouton dans ta barre de favoris (desktop), ou crée un favori
         avec le code ci-dessous (mobile) :</p>
       <p><a class="btn" href="${escapeHtml(code)}">Envoyer l'article →</a></p>
       <p>Code complet (pour créer le favori à la main) :</p>
       <textarea readonly onclick="this.select()">${escapeHtml(code)}</textarea>
       <div class="warn">Le token secret est inclus dans ce lien. Ne le partage pas,
         et régénère un token si tu penses qu'il a fuité.</div>`
      : `<div class="warn">Configuration incomplète : renseigne
         <code>BASE_URL</code> et <code>CAPTURE_TOKEN</code> dans les variables
         d'environnement, puis recharge cette page.</div>`
  }
  <h3>Utilisation</h3>
  <ol>
    <li>Sur un article intéressant, clique le favori.</li>
    <li>Une petite fenêtre confirme l'ajout puis se ferme.</li>
    <li>Chaque jour, tous les articles capturés arrivent par mail en PDF.</li>
  </ol>
</body></html>`;
}
