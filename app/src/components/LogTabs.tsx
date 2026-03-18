'use client';

import type { LogEntry, SubtitleEntry, GlossaryEntry } from '@/lib/types';
import LogPanel from './LogPanel';
import SubtitlePreview from './SubtitlePreview';
import GlossaryPanel from './GlossaryPanel';
import { useI18n } from '@/i18n';

export type LogTabType = 'glossary' | 'log' | 'preview';

interface LogTabsProps {
  logs: LogEntry[];
  entries: SubtitleEntry[];
  activeTab: LogTabType;
  onTabChange: (tab: LogTabType) => void;
  glossaries: GlossaryEntry[];
  onGlossariesChange: (glossaries: GlossaryEntry[]) => void;
}

export default function LogTabs({ logs, entries, activeTab, onTabChange, glossaries, onGlossariesChange }: LogTabsProps) {
  const { t } = useI18n();

  const tabClass = (tab: LogTabType) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      activeTab === tab
        ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400'
        : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
    }`;

  return (
    <div>
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button className={tabClass('glossary')} onClick={() => onTabChange('glossary')}>
          {t('logTabs.glossary')}
        </button>
        <button className={tabClass('log')} onClick={() => onTabChange('log')}>
          {t('logTabs.log')}
        </button>
        <button className={tabClass('preview')} onClick={() => onTabChange('preview')}>
          {entries.length > 0 ? t('logTabs.previewCount', { count: entries.length }) : t('logTabs.preview')}
        </button>
      </div>
      <div className="mt-3">
        {activeTab === 'glossary' ? (
          <GlossaryPanel glossaries={glossaries} onChange={onGlossariesChange} />
        ) : activeTab === 'log' ? (
          <LogPanel logs={logs} />
        ) : (
          <SubtitlePreview entries={entries} />
        )}
      </div>
    </div>
  );
}
