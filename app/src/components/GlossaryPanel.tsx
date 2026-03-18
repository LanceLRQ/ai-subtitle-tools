'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { GlossaryEntry } from '@/lib/types';
import { useI18n } from '@/i18n';
import { ask } from '@tauri-apps/plugin-dialog';

interface GlossaryPanelProps {
  glossaries: GlossaryEntry[];
  onChange: (glossaries: GlossaryEntry[]) => void;
}

export default function GlossaryPanel({ glossaries, onChange }: GlossaryPanelProps) {
  const { t } = useI18n();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [localContent, setLocalContent] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const glossariesRef = useRef(glossaries);
  glossariesRef.current = glossaries;

  // activeIndex 越界时修正
  const safeIndex = glossaries.length > 0
    ? Math.min(activeIndex, glossaries.length - 1)
    : 0;
  useEffect(() => {
    if (safeIndex !== activeIndex) {
      setActiveIndex(safeIndex);
    }
  }, [safeIndex, activeIndex]);

  // 当切换 tab 或 glossaries 变化时，同步本地内容
  useEffect(() => {
    setLocalContent(glossaries[safeIndex]?.content ?? '');
  }, [safeIndex, glossaries]);

  // 聚焦重命名输入框
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  // 防抖同步到父组件
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushContent = useCallback((content: string) => {
    const idx = safeIndex;
    const updated = glossariesRef.current.map((g, i) =>
      i === idx ? { ...g, content } : g
    );
    onChange(updated);
  }, [safeIndex, onChange]);

  const handleContentChange = (content: string) => {
    setLocalContent(content);
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(() => flushContent(content), 300);
  };

  // 失焦时立即同步
  const handleContentBlur = () => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    flushContent(localContent);
  };

  // 切换前先同步当前内容
  const switchIndex = (newIndex: number) => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    flushContent(localContent);
    setActiveIndex(newIndex);
  };

  const handleAdd = () => {
    // 先同步当前内容
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    if (glossaries.length > 0) {
      flushContent(localContent);
    }

    let index = 1;
    const existingTitles = new Set(glossaries.map(g => g.title));
    while (existingTitles.has(t('glossary.untitled', { index: String(index) }))) {
      index++;
    }
    const newEntry: GlossaryEntry = {
      title: t('glossary.untitled', { index: String(index) }),
      content: '',
    };
    const updated = [...glossariesRef.current.map((g, i) =>
      i === safeIndex ? { ...g, content: localContent } : g
    ), newEntry];
    setActiveIndex(updated.length - 1);
    setLocalContent('');
    onChange(updated);
  };

  const handleDelete = async () => {
    const entry = glossaries[safeIndex];
    const confirmed = await ask(t('glossary.deleteConfirm', { title: entry.title }), {
      kind: 'warning',
    });
    if (!confirmed) return;
    const updated = glossaries.filter((_, i) => i !== safeIndex);
    onChange(updated);
  };

  const startRename = () => {
    setRenameValue(glossaries[safeIndex].title);
    setIsRenaming(true);
  };

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== glossaries[safeIndex].title) {
      const updated = glossaries.map((g, i) =>
        i === safeIndex ? { ...g, title: trimmed } : g
      );
      onChange(updated);
    }
    setIsRenaming(false);
  };

  // 空状态
  if (glossaries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('glossary.empty')}</p>
        <button
          onClick={handleAdd}
          className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
        >
          + {t('glossary.add')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* 工具栏：下拉框 + 操作按钮 */}
      <div className="flex items-center gap-1.5">
        <select
          value={safeIndex}
          onChange={(e) => switchIndex(Number(e.target.value))}
          className="w-36 h-9 px-2 text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
        >
          {glossaries.map((entry, index) => (
            <option key={index} value={index}>{entry.title}</option>
          ))}
        </select>

        {/* 新增 */}
        <button
          onClick={handleAdd}
          className="shrink-0 p-1 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          title={t('glossary.add')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>

        {/* 重命名 */}
        <button
          onClick={startRename}
          className="shrink-0 p-1 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          title={t('glossary.rename')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
          </svg>
        </button>

        {/* 删除 */}
        <button
          onClick={handleDelete}
          className="shrink-0 p-1 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          title={t('glossary.delete')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
        </button>
      </div>

      {/* 重命名输入行 */}
      {isRenaming && (
        <div className="flex items-center">
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setIsRenaming(false);
            }}
            className="w-36 px-2 py-1 text-sm rounded-md border border-blue-500 dark:border-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
        </div>
      )}

      {/* 内容区域 */}
      <textarea
        value={localContent}
        onChange={(e) => handleContentChange(e.target.value)}
        onBlur={handleContentBlur}
        placeholder={t('glossary.placeholder')}
        className="w-full min-h-[200px] resize-none rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
      />
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {t('glossary.hint')}
      </p>
    </div>
  );
}
