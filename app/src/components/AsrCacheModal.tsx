'use client';

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ask } from '@tauri-apps/plugin-dialog';
import { useI18n } from '@/i18n';

interface AsrCacheEntry {
  video_path: string;
  data_size: number;
}

interface AsrCacheListResult {
  entries: AsrCacheEntry[];
  total: number;
}

interface AsrCacheModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChanged: () => void;
}

const PAGE_SIZE = 20;

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function AsrCacheModal({ isOpen, onClose, onChanged }: AsrCacheModalProps) {
  const { t } = useI18n();
  const [entries, setEntries] = useState<AsrCacheEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadEntries = useCallback(async (pageNum: number) => {
    setLoading(true);
    try {
      const result = await invoke<AsrCacheListResult>('list_asr_cache', {
        offset: pageNum * PAGE_SIZE,
        limit: PAGE_SIZE,
      });
      setEntries(result.entries);
      setTotal(result.total);
    } catch (err) {
      console.error('Failed to list ASR cache:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setPage(0);
      loadEntries(0);
    }
  }, [isOpen, loadEntries]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const goToPage = (p: number) => {
    setPage(p);
    loadEntries(p);
  };

  const handleDelete = async (videoPath: string) => {
    const confirmed = await ask(t('settings.storage.cacheDeleteConfirm'), { kind: 'warning' });
    if (!confirmed) return;
    try {
      await invoke('delete_asr_cache_entry', { videoPath });
      // 如果当前页删空了且不是第一页，回到上一页
      const newTotal = total - 1;
      const maxPage = Math.max(0, Math.ceil(newTotal / PAGE_SIZE) - 1);
      const targetPage = page > maxPage ? maxPage : page;
      setPage(targetPage);
      await loadEntries(targetPage);
      onChanged();
    } catch (err) {
      console.error('Failed to delete cache entry:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="relative flex flex-col w-full max-w-2xl max-h-[70vh] mx-4 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('settings.storage.cacheList')}
            {total > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-400 dark:text-gray-500">
                ({total})
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容区 */}
        <div className="overflow-y-auto px-6 py-4 flex-1">
          {loading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">...</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
              {t('settings.storage.cacheEmpty')}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 pr-4 font-medium text-gray-700 dark:text-gray-300">
                    {t('settings.storage.cacheVideoPath')}
                  </th>
                  <th className="text-right py-2 px-4 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {t('settings.storage.cacheDataSize')}
                  </th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.video_path}
                    className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                  >
                    <td
                      className="py-2 pr-4 text-gray-900 dark:text-gray-100 break-all"
                      title={entry.video_path}
                    >
                      {entry.video_path}
                    </td>
                    <td className="py-2 px-4 text-right text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {formatSize(entry.data_size)}
                    </td>
                    <td className="py-2 pl-2">
                      <button
                        onClick={() => handleDelete(entry.video_path)}
                        className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        title={t('settings.storage.clear')}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 分页栏 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 px-6 py-3 border-t border-gray-200 dark:border-gray-700 shrink-0">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page === 0}
              className="px-2 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:text-gray-300 dark:disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => goToPage(i)}
                className={`px-2.5 py-1 text-sm rounded transition-colors ${
                  i === page
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages - 1}
              className="px-2 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:text-gray-300 dark:disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
