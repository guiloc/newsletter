import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import sharp from 'sharp';
import { getBrowser } from './browser.js';
import { config } from './config.js';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Options de contexte qui font ressembler la requête à un vrai Chrome plutôt
// qu'à un navigateur headless : UA complète + client hints `sec-ch-ua` (qu'un
// Chrome envoie toujours et dont l'absence trahit un bot), locale et fuseau
// cohérents. Indispensable pour passer les protections type Cloudflare qui
// sont plus strictes depuis une IP de datacenter (Railway).
const CONTEXT_OPTIONS = {
  userAgent: UA,
  locale: 'fr-FR',
  timezoneId: 'Europe/Paris',
  viewport: { width: 1280, height: 800 },
  extraHTTPHeaders: {
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Upgrade-Insecure-Requests': '1',
    'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
  },
};

// Télécharge une image, la redimensionne / recompresse, et renvoie une
// data URI autonome. C'est le premier levier de contrôle de la taille :
// on borne la largeur et la qualité AVANT même de générer le PDF.
async function inlineImage(absUrl) {
  try {
    const res = await fetch(absUrl, { headers: { 'User-Agent': UA } });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const image = sharp(buf, { failOn: 'none', animated: false });
    const meta = await image.metadata();

    let pipeline = image;
    if (meta.width && meta.width > config.image.maxWidth) {
      pipeline = pipeline.resize({ width: config.image.maxWidth });
    }

    // On garde le PNG uniquement s'il y a de la transparence, sinon JPEG
    // (bien plus léger) pour les photos.
    if (meta.hasAlpha) {
      const out = await pipeline.png({ compressionLevel: 9 }).toBuffer();
      return `data:image/png;base64,${out.toString('base64')}`;
    }
    const out = await pipeline.jpeg({ quality: config.image.quality }).toBuffer();
    return `data:image/jpeg;base64,${out.toString('base64')}`;
  } catch {
    return null;
  }
}

// Charge la page dans Chromium, extrait l'article en « mode lecture »
// (Readability). En secours, si l'extraction échoue, on retombe sur le
// <body> nettoyé de la page rendue.
export async function extractArticle(url) {
  const browser = await getBrowser();
  const context = await browser.newContext(CONTEXT_OPTIONS);
  const page = await context.newPage();

  let title = url;
  let byline = '';
  let sourceHtml;

  try {
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });

    // Garde-fou n°1 : un statut d'erreur ne lève pas d'exception côté
    // Playwright — on le fait nous-mêmes, sinon on fabriquerait un PDF à
    // partir d'une page « 403 / 404 » (ex. « Error - Substack »).
    const status = response ? response.status() : 0;
    if (status >= 400) {
      throw new Error(`HTTP ${status} (accès refusé ou page introuvable)`);
    }

    const rawHtml = await page.content();
    const dom = new JSDOM(rawHtml, { url });
    const article = new Readability(dom.window.document).parse();

    if (article?.content && article.textContent.trim().length > 200) {
      title = article.title || (await page.title());
      byline = article.byline || '';
      sourceHtml = article.content;
    } else {
      // Secours : le corps rendu de la page (nettoyé plus bas).
      const pageTitle = (await page.title()) || url;
      const bodyText = await page.evaluate(() => (document.body.innerText || '').trim());

      // Garde-fou n°2 : une page quasi vide ou intitulée « Error … » est
      // presque sûrement un blocage/erreur — on refuse plutôt que d'envoyer
      // un PDF poubelle (l'article sera marqué en erreur, pas envoyé).
      if (bodyText.length < 250 || /^error\b/i.test(pageTitle)) {
        throw new Error('contenu introuvable (page bloquée ou vide)');
      }
      title = pageTitle;
      sourceHtml = await page.evaluate(() => document.body.innerHTML);
    }
  } finally {
    await context.close();
  }

  // Nettoyage commun + inline des images sur le HTML retenu.
  const dom = new JSDOM(`<body>${sourceHtml}</body>`, { url });
  const doc = dom.window.document;
  doc
    .querySelectorAll('script,style,noscript,iframe,link,meta,svg,form,button,input,object,embed')
    .forEach((n) => n.remove());

  const images = [...doc.querySelectorAll('img')];
  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute('src');
      if (!src) return img.remove();
      let abs;
      try {
        abs = new URL(src, url).href;
      } catch {
        return img.remove();
      }
      if (abs.startsWith('data:')) return;
      const dataUri = await inlineImage(abs);
      if (!dataUri) return img.remove();
      img.setAttribute('src', dataUri);
      img.removeAttribute('srcset');
      img.removeAttribute('loading');
      img.removeAttribute('width');
      img.removeAttribute('height');
    })
  );

  return { url, title, byline, contentHtml: doc.body.innerHTML };
}
