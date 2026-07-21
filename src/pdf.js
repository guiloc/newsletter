import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { getBrowser } from './browser.js';

const execFileAsync = promisify(execFile);

// Imprime un document HTML autonome en PDF via Chromium.
export async function htmlToPdf(html) {
  const browser = await getBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    // 'load' attend le chargement des images (ici des data URIs, donc immédiat).
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
    });
  } finally {
    await context.close();
  }
}

// Recompresse un PDF avec Ghostscript. `level` : 'ebook' (150 dpi, défaut)
// ou 'screen' (72 dpi, plus agressif). Filet de sécurité en plus de la
// compression d'images déjà faite à l'extraction.
//
// Si Ghostscript est absent ou échoue, on renvoie le PDF d'origine :
// le pipeline ne casse jamais à cause de la compression.
export async function compressPdf(pdfBuffer, level = 'ebook') {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nl-gs-'));
  const inPath = path.join(dir, 'in.pdf');
  const outPath = path.join(dir, 'out.pdf');
  try {
    await fs.writeFile(inPath, pdfBuffer);
    await execFileAsync('gs', [
      '-sDEVICE=pdfwrite',
      '-dCompatibilityLevel=1.4',
      `-dPDFSETTINGS=/${level}`,
      '-dNOPAUSE',
      '-dBATCH',
      '-dQUIET',
      '-dDetectDuplicateImages=true',
      '-dCompressFonts=true',
      `-sOutputFile=${outPath}`,
      inPath,
    ]);
    const out = await fs.readFile(outPath);
    // Ghostscript peut parfois grossir un PDF déjà optimisé : on garde le
    // plus petit des deux.
    return out.length < pdfBuffer.length ? out : pdfBuffer;
  } catch {
    return pdfBuffer;
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
