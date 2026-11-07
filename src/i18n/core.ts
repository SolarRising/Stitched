import { createContext, useContext } from 'react';
import { en } from './en';
import { pl, type MessageKey } from './pl';

export type Lang = 'pl' | 'en';
export type { MessageKey };
export type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

const DICTS: Record<Lang, Record<MessageKey, string>> = { pl, en };
export const LANG_STORAGE_KEY = 'stitched.lang';

export function translate(
  lang: Lang,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const text = DICTS[lang][key] ?? pl[key] ?? key;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in params ? String(params[name]) : m,
  );
}

export function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'pl' || saved === 'en') return saved;
  } catch {
    // Storage unavailable (private mode, blocked cookies) — use the browser language.
  }
  const nav =
    typeof navigator !== 'undefined' ? (navigator.languages?.[0] ?? navigator.language) : '';
  return nav?.toLowerCase().startsWith('pl') ? 'pl' : 'en';
}

/** Strand count label with Polish plural forms (1 nitka, 2–4 nitki, 5+ nitek). */
export function strandsLabel(t: Translate, n: number): string {
  if (n === 1) return t('size.strandsValue1');
  if (n >= 5) return t('size.strandsValue5', { n });
  return t('size.strandsValue', { n });
}

export interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Translate;
  /** Locale-aware number formatting. */
  num: (v: number, digits?: number) => string;
}

export const I18nContext = createContext<I18nValue | null>(null);

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
