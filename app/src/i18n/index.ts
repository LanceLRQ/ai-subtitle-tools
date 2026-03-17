'use client';

import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import type { Locale, TranslationDict } from './types';
import zh from './zh';
import en from './en';

export type { Locale, TranslationDict };

const dictionaries: Record<Locale, TranslationDict> = { zh, en };

type TranslationKey = keyof TranslationDict;
type TranslationVars = Record<string, string | number>;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, vars?: TranslationVars) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'zh',
  setLocale: () => {},
  t: (key) => key,
});

interface I18nProviderProps {
  initialLocale?: Locale;
  onLocaleChange?: (locale: Locale) => void;
  children: ReactNode;
}

export function I18nProvider({ initialLocale = 'zh', onLocaleChange, children }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    onLocaleChange?.(l);
  }, [onLocaleChange]);

  // Sync when initialLocale changes from outside
  useEffect(() => {
    setLocaleState(initialLocale);
  }, [initialLocale]);

  const t = useCallback((key: TranslationKey, vars?: TranslationVars): string => {
    let text: string = dictionaries[locale][key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replaceAll(`{${k}}`, String(v));
      }
    }
    return text;
  }, [locale]);

  // Sync <html lang>
  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return createElement(I18nContext.Provider, { value }, children);
}

export function useI18n() {
  return useContext(I18nContext);
}
