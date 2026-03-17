'use client';

import type { LogEntry, SubtitleEntry } from '@/lib/types';
import LogPanel from './LogPanel';
import SubtitlePreview from './SubtitlePreview';
import { useI18n } from '@/i18n';

interface LogTabsProps {
  logs: LogEntry[];
  entries: SubtitleEntry[];
  activeTab: 'log' | 'preview';
  onTabChange: (tab: 'log' | 'preview') => void;
}

export default function LogTabs({ logs, entries, activeTab, onTabChange }: LogTabsProps) {
  const { t } = useI18n();

  const tabClass = (tab: 'log' | 'preview') =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      activeTab === tab
        ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400'
        : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
    }`;

  return (
    <div>
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button className={tabClass('log')} onClick={() => onTabChange('log')}>
          {t('logTabs.log')}
        </button>
        <button className={tabClass('preview')} onClick={() => onTabChange('preview')}>
          {entries.length > 0 ? t('logTabs.previewCount', { count: entries.length }) : t('logTabs.preview')}
        </button>
      </div>
      <div className="mt-3">
        {activeTab === 'log' ? (
          <LogPanel logs={logs} />
        ) : (
          <SubtitlePreview entries={entries} />
        )}
      </div>
    </div>
  );
}
