'use client';

import { useI18n } from '@/i18n';

interface GlossaryPanelProps {
  value: string;
  onChange: (value: string) => void;
}

export default function GlossaryPanel({ value, onChange }: GlossaryPanelProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('glossary.placeholder')}
        className="w-full min-h-[200px] resize-none rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
      />
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {t('glossary.hint')}
      </p>
    </div>
  );
}
