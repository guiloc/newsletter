import 'dotenv/config';
import path from 'node:path';

// Configuration centralisée, alimentée par les variables d'environnement.
// Rien de secret n'est codé en dur : tout vient de l'environnement Railway
// (ou d'un fichier .env en local, voir .env.example).
export const config = {
  port: parseInt(process.env.PORT || '3000', 10),

  // Secret partagé entre le bookmarklet et le serveur.
  captureToken: process.env.CAPTURE_TOKEN || '',

  // URL publique du service (utilisée pour générer le bookmarklet).
  baseUrl: (process.env.BASE_URL || '').replace(/\/$/, ''),

  // Dossier persistant. Sur Railway, monter un VOLUME sur ce chemin,
  // sinon la file d'articles est perdue à chaque redéploiement.
  dataDir: process.env.DATA_DIR || path.resolve('data'),

  email: {
    apiKey: process.env.RESEND_API_KEY || '',
    from: process.env.MAIL_FROM || '',
    to: process.env.MAIL_TO || '',
    // Plafond DUR de la boîte de réception (Mo). On reste toujours en dessous.
    limitMb: parseFloat(process.env.EMAIL_LIMIT_MB || '7'),
  },

  image: {
    // Réduction des images à la capture, avant même Ghostscript.
    maxWidth: parseInt(process.env.IMAGE_MAX_WIDTH || '1000', 10),
    quality: parseInt(process.env.IMAGE_QUALITY || '72', 10),
  },

  cron: {
    // Planificateur in-process (partage le volume avec le serveur web).
    enabled: (process.env.CRON_ENABLED || 'true') !== 'false',
    schedule: process.env.CRON_SCHEDULE || '0 6 * * *', // tous les jours à 06:00
    tz: process.env.CRON_TZ || 'Europe/Paris',
  },
};

export const paths = {
  index: path.join(config.dataDir, 'index.json'),
  articles: path.join(config.dataDir, 'articles'),
};
