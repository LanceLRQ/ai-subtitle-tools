'use client';

import { useTheme } from '@/hooks/useTheme';
import type { ThemeMode } from '@/hooks/useTheme';
import Tooltip from '@/components/Tooltip';
import { useI18n } from '@/i18n';
import type { TranslationDict } from '@/i18n/types';

const CYCLE: ThemeMode[] = ['system', 'light', 'dark'];
const MODE_KEY: Record<ThemeMode, keyof TranslationDict> = {
  system: 'theme.system',
  light: 'theme.light',
  dark: 'theme.dark',
};

export default function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const { t } = useI18n();

  const handleClick = () => {
    const idx = CYCLE.indexOf(mode);
    setMode(CYCLE[(idx + 1) % CYCLE.length]);
  };

  return (
    <Tooltip content={t(MODE_KEY[mode])}>
      <button
        onClick={handleClick}
        className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
      {mode === 'system' && (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      )}
      {mode === 'light' && (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )}
      {mode === 'dark' && (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
      </button>
    </Tooltip>
  );
}
