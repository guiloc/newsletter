// Traite manuellement la file d'extraction, puis sort.
// Utile pour tester : `npm run process-queue`.
import { processQueue } from '../queue.js';
import { closeBrowser } from '../browser.js';

processQueue()
  .then(() => console.log('File traitée.'))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeBrowser());
