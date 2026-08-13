import { chromium } from 'playwright';

// Une seule instance de Chromium, partagée par l'extraction et le rendu PDF.
// Réutilisée entre les requêtes du serveur et pendant le job d'envoi.
let browserPromise = null;

export function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      args: [
        // --no-sandbox est nécessaire dans le conteneur Railway.
        '--no-sandbox',
        '--disable-dev-shm-usage',
        // Retire navigator.webdriver=true, signal de bot n°1 (ex. Substack
        // renvoie un 403 « Error - Substack » aux navigateurs headless).
        '--disable-blink-features=AutomationControlled',
      ],
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
