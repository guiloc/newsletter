import { chromium } from 'playwright';

// Une seule instance de Chromium, partagée par l'extraction et le rendu PDF.
// Réutilisée entre les requêtes du serveur et pendant le job d'envoi.
let browserPromise = null;

export function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      // --no-sandbox est nécessaire dans le conteneur Railway.
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
  }
  return browserPromise;
}

export async function closeBrowser() {
  if (browserPromise) {
    const browser = await browserPromise;
    browserPromise = null;
    await browser.close();
  }
}
