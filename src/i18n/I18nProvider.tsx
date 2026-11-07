import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  I18nContext,
  initialLang,
  LANG_STORAGE_KEY,
  translate,
  type I18nValue,
  type Lang,
} from './core';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, l);
    } catch {
      // Not critical.
    }
  }, []);

  const value = useMemo<I18nValue>(() => {
    const locale = lang === 'pl' ? 'pl-PL' : 'en-GB';
    const formatters = new Map<number, Intl.NumberFormat>();
    const num = (v: number, digits = 0) => {
      let f = formatters.get(digits);
      if (!f) {
        f = new Intl.NumberFormat(locale, { maximumFractionDigits: digits });
        formatters.set(digits, f);
      }
      return f.format(v);
    };
    return { lang, setLang, t: (key, params) => translate(lang, key, params), num };
  }, [lang, setLang]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
