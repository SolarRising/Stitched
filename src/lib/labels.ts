import type { Thread } from '../core/palettes';
import type { Fabric } from '../core/sizing';
import type { MessageKey } from '../i18n';

/** "Aida 14 ct", "Kanwa do wyprucia 8,5 ct" … */
export function fabricLabel(f: Fabric, t: (k: MessageKey) => string, decimalComma = true): string {
  const kind = t(`size.fabric.${f.kind}` as MessageKey).replace(/\s*\(.*\)$/, '');
  const count = decimalComma ? String(f.count).replace('.', ',') : String(f.count);
  return `${kind} ${count} ct`;
}

export function threadTitle(th: Thread): string {
  return `${th.brand} ${th.code} – ${th.name}`;
}
