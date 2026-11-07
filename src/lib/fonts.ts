import robotoBoldUrl from '../assets/fonts/Roboto-Bold.ttf?url';
import robotoRegularUrl from '../assets/fonts/Roboto-Regular.ttf?url';

/** Font family used for letter symbols on canvas (same glyphs as in the PDF). */
export const SYMBOL_FONT_FAMILY = 'StitchedSymbol';
export const SYMBOL_FONT = `${SYMBOL_FONT_FAMILY}, "Arial Black", Arial, sans-serif`;

let symbolFont: Promise<void> | null = null;

/** Loads the symbol font for canvas rendering; resolves even if loading fails. */
export function ensureSymbolFont(): Promise<void> {
  if (!symbolFont) {
    symbolFont = (async () => {
      try {
        const face = new FontFace(SYMBOL_FONT_FAMILY, `url(${robotoBoldUrl})`);
        await face.load();
        document.fonts.add(face);
      } catch {
        // Fallback fonts are fine.
      }
    })();
  }
  return symbolFont;
}

async function toBase64(url: string): Promise<string> {
  const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** TTF files (base64) for embedding into PDFs. */
export async function pdfFonts(): Promise<{ regular: string; bold: string }> {
  const [regular, bold] = await Promise.all([toBase64(robotoRegularUrl), toBase64(robotoBoldUrl)]);
  return { regular, bold };
}
