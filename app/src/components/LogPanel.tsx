'use client';

import { useEffect, useRef } from 'react';
import type { LogEntry } from '@/lib/types';
import { useI18n } from '@/i18n';

interface LogPanelProps {
  logs: LogEntry[];
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}

const levelColors: Record<string, string> = {
  info: 'text-blue-500 dark:text-blue-400',
  warn: 'text-yellow-500 dark:text-yellow-400',
  error: 'text-red-500 dark:text-red-400',
};

export default function LogPanel({ logs }: LogPanelProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

  // 检测用户是否手动滚动到非底部位置
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    shouldAutoScroll.current = atBottom;
  };

  // 自动滚动到底部
  useEffect(() => {
    if (shouldAutoScroll.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
        {t('logPanel.empty')}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="max-h-72 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-1 bg-white dark:bg-gray-800 font-mono text-xs"
    >
      {logs.map((log) => (
        <div key={log.id}>
          <div className="flex gap-2">
            <span className="text-gray-400 dark:text-gray-500 shrink-0">
              {formatTime(log.timestamp)}
            </span>
            <span className={`shrink-0 uppercase font-semibold ${levelColors[log.level] || ''}`}>
              [{log.level}]
            </span>
            <span className="text-gray-800 dark:text-gray-200 break-all">
              {log.message}
            </span>
          </div>
          {log.streamContent !== undefined && (
            <pre className="mt-1 ml-16 p-2 bg-gray-50 dark:bg-gray-900 rounded text-gray-600 dark:text-gray-300 whitespace-pre-wrap break-all text-xs leading-relaxed">
              {log.streamContent}
              {log.streaming && (
                <span className="animate-pulse text-blue-500">▍</span>
              )}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
