import { Resend } from 'resend';
import { config } from './config.js';
import { escapeHtml } from './util.js';

// Envoie le digest en un seul email via Resend. Les articles dégradés en
// « texte seul » ou en « lien seul » sont signalés dans le corps du mail.
export async function sendDigest({ attachments, linkOnly }, dateLabel) {
  if (!config.email.apiKey) throw new Error('RESEND_API_KEY manquant');
  if (!config.email.from) throw new Error('MAIL_FROM manquant');
  if (!config.email.to) throw new Error('MAIL_TO manquant');

  const resend = new Resend(config.email.apiKey);
  const rows = [];

  for (const a of attachments) {
    const note = a.stage === 'textonly' ? ' — <em>texte seul (images retirées)</em>' : '';
    rows.push(
      `<li><a href="${escapeHtml(a.item.url)}">${escapeHtml(a.item.title)}</a>${note}</li>`
    );
  }
  for (const it of linkOnly) {
    rows.push(
      `<li><a href="${escapeHtml(it.url)}">${escapeHtml(it.title)}</a> — <em>trop lourd pour être joint, lien seul</em></li>`
    );
  }

  const count = attachments.length + linkOnly.length;
  const html = `
    <div style="font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; color:#1a1a1a;">
      <h2>Tes articles — ${escapeHtml(dateLabel)}</h2>
      <p>${count} article${count > 1 ? 's' : ''} capturé${count > 1 ? 's' : ''}.
         ${attachments.length} en pièce${attachments.length > 1 ? 's' : ''} jointe${attachments.length > 1 ? 's' : ''} PDF.</p>
      <ol>${rows.join('')}</ol>
    </div>`;

  const { error } = await resend.emails.send({
    from: config.email.from,
    to: config.email.to,
    subject: `Articles du jour — ${dateLabel} (${count})`,
    html,
    attachments: attachments.map((a) => ({ filename: a.filename, content: a.content })),
  });

  if (error) throw new Error(`Resend a refusé l'envoi : ${JSON.stringify(error)}`);
}
