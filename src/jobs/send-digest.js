// Déclenche manuellement l'envoi du digest, puis sort.
// Utile pour tester ou pour un cron externe : `npm run send-digest`.
import { runDigest } from '../run-digest.js';
import { closeBrowser } from '../browser.js';

runDigest()
  .then((r) => console.log(JSON.stringify(r, null, 2)))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeBrowser());
