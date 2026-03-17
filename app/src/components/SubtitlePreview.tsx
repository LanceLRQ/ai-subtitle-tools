'use client';

import type { SubtitleEntry } from '@/lib/types';
import { formatTimestamp } from '@/lib/subtitle';
import { useI18n } from '@/i18n';

interface SubtitlePreviewProps {
  entries: SubtitleEntry[];
}

export default function SubtitlePreview({ entries }: SubtitlePreviewProps) {
  const { t } = useI18n();

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
        {t('subtitlePreview.empty')}
      </div>
    );
  }

  return (
    <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
          <tr className="text-gray-500 dark:text-gray-400 text-left">
            <th className="px-3 py-2 w-12">{t('subtitlePreview.index')}</th>
            <th className="px-3 py-2 w-48">{t('subtitlePreview.time')}</th>
            <th className="px-3 py-2">{t('subtitlePreview.original')}</th>
            <th className="px-3 py-2">{t('subtitlePreview.translated')}</th>
            <th className="px-3 py-2 w-24">{t('subtitlePreview.speaker')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
          {entries.map((entry) => (
            <tr key={entry.index} className="hover:bg-gray-100/50 dark:hover:bg-gray-800/50">
              <td className="px-3 py-2 text-gray-400 dark:text-gray-500">{entry.index}</td>
              <td className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs font-mono whitespace-nowrap">
                {formatTimestamp(entry.startTime)}
                <br />
                {formatTimestamp(entry.endTime)}
              </td>
              <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{entry.originalText}</td>
              <td className="px-3 py-2 text-blue-600 dark:text-blue-300">{entry.translatedText || '-'}</td>
              <td className="px-3 py-2 text-gray-400 dark:text-gray-500 text-xs">{entry.speakerId || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
