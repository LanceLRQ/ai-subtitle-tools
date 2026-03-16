'use client';

import type { SubtitleEntry } from '@/lib/types';
import { formatTimestamp } from '@/lib/subtitle';

interface SubtitlePreviewProps {
  entries: SubtitleEntry[];
}

export default function SubtitlePreview({ entries }: SubtitlePreviewProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        暂无字幕数据
      </div>
    );
  }

  return (
    <div className="max-h-96 overflow-y-auto border border-gray-700 rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-gray-800 sticky top-0">
          <tr className="text-gray-400 text-left">
            <th className="px-3 py-2 w-12">#</th>
            <th className="px-3 py-2 w-48">时间</th>
            <th className="px-3 py-2">原文</th>
            <th className="px-3 py-2">译文</th>
            <th className="px-3 py-2 w-24">说话人</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {entries.map((entry) => (
            <tr key={entry.index} className="hover:bg-gray-800/50">
              <td className="px-3 py-2 text-gray-500">{entry.index}</td>
              <td className="px-3 py-2 text-gray-400 text-xs font-mono whitespace-nowrap">
                {formatTimestamp(entry.startTime)}
                <br />
                {formatTimestamp(entry.endTime)}
              </td>
              <td className="px-3 py-2 text-gray-200">{entry.originalText}</td>
              <td className="px-3 py-2 text-blue-300">{entry.translatedText || '-'}</td>
              <td className="px-3 py-2 text-gray-500 text-xs">{entry.speakerId || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
