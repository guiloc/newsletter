import { renderItemPdf } from './render.js';
import { config } from './config.js';
import { sanitizeFilename } from './util.js';

// Facteur de sécurité : les pièces jointes sont encodées en base64 dans
// l'email (+33 % environ), auxquels s'ajoutent les en-têtes MIME et le corps
// HTML. On budgète donc les octets bruts des PDF à 70 % du plafond de la
// boîte de réception pour être certain que le message final passe.
const RAW_BUDGET_RATIO = 0.7;

const STAGES = {
  EBOOK: 'ebook', // images 150 dpi
  SCREEN: 'screen', // images 72 dpi
  TEXTONLY: 'textonly', // sans images
  LINK: 'link', // pas de PDF, lien seul dans le mail
};

async function renderStage(item, stage) {
  switch (stage) {
    case STAGES.EBOOK:
      return renderItemPdf(item, { includeImages: true, gsLevel: 'ebook' });
    case STAGES.SCREEN:
      return renderItemPdf(item, { includeImages: true, gsLevel: 'screen' });
    case STAGES.TEXTONLY:
      return renderItemPdf(item, { includeImages: false, gsLevel: 'screen' });
    default:
      return null; // LINK
  }
}

// Construit le digest en restant SOUS le budget, via une échelle de
// dégradation déterministe. On ne descend d'un cran que si on dépasse encore.
//
//   1. Tous en /ebook (cas normal, ~95 % du temps on s'arrête là).
//   2. Tous en /screen.
//   3. Texte seul, en commençant par les PDF les plus lourds.
//   4. Lien seul (pas de pièce jointe), les plus lourds d'abord.
//
// Garanties : le mail rentre toujours sous le plafond, et aucun article
// n'est perdu (au pire il devient un lien).
export async function buildDigest(items) {
  const budget = config.email.limitMb * 1024 * 1024 * RAW_BUDGET_RATIO;
  const state = new Map(items.map((it) => [it.id, { stage: STAGES.EBOOK, pdf: null }]));

  const sizeOf = (id) => state.get(id).pdf?.length || 0;
  const total = () => items.reduce((sum, it) => sum + sizeOf(it.id), 0);
  const byLargest = () => [...items].sort((a, b) => sizeOf(b.id) - sizeOf(a.id));

  const render = async (it) => {
    const s = state.get(it.id);
    s.pdf = await renderStage(it, s.stage);
  };

  // Niveau 1 — tout en /ebook.
  for (const it of items) await render(it);

  // Niveau 2 — tout en /screen.
  if (total() > budget) {
    for (const it of items) {
      state.get(it.id).stage = STAGES.SCREEN;
      await render(it);
    }
  }

  // Niveau 3 — texte seul, les plus lourds d'abord, jusqu'à rentrer.
  if (total() > budget) {
    for (const it of byLargest()) {
      if (total() <= budget) break;
      state.get(it.id).stage = STAGES.TEXTONLY;
      await render(it);
    }
  }

  // Niveau 4 — lien seul pour ceux qui dépassent encore.
  if (total() > budget) {
    for (const it of byLargest()) {
      if (total() <= budget) break;
      const s = state.get(it.id);
      s.stage = STAGES.LINK;
      s.pdf = null;
    }
  }

  const attachments = [];
  const linkOnly = [];
  for (const it of items) {
    const s = state.get(it.id);
    if (s.pdf) {
      attachments.push({
        filename: `${sanitizeFilename(it.title)}.pdf`,
        content: s.pdf,
        item: it,
        stage: s.stage,
      });
    } else {
      linkOnly.push(it);
    }
  }

  return { attachments, linkOnly, totalBytes: total() };
}
