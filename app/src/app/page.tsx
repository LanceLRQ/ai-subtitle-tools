'use client';

import { useState, useEffect } from 'react';
import { usePipeline } from '@/hooks/usePipeline';
import { useLog } from '@/hooks/useLog';
import SettingsPanel from '@/components/SettingsPanel';
import SettingsModal from '@/components/SettingsModal';
import ThemeToggle from '@/components/ThemeToggle';
import Tooltip from '@/components/Tooltip';
import FilePicker from '@/components/FilePicker';
import ProgressBar from '@/components/ProgressBar';
import LogTabs from '@/components/LogTabs';
import { save } from '@tauri-apps/plugin-dialog';

export default function Home() {
  const log = useLog();
  const {
    config,
    updateConfig,
    pipeline,
    ffmpegInfo,
    videoPath,
    setVideoPath,
    stageLabel,
    isProcessing,
    startProcessing,
    cancelProcessing,
    retranslate,
    runDetectFFmpeg,
    exportSRT,
  } = usePipeline(log);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'log' | 'preview'>('log');

  // 开始处理时自动切换到日志 tab
  useEffect(() => {
    if (isProcessing) {
      setActiveTab('log');
    }
  }, [isProcessing]);

  const handleExport = async () => {
    const path = await save({
      filters: [{ name: 'SRT Subtitle', extensions: ['srt'] }],
      defaultPath: videoPath?.replace(/\.[^.]+$/, '.srt'),
    });
    if (path) {
      await exportSRT(path);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* 工具栏 */}
        <div className="flex items-center justify-end gap-2">
          <ThemeToggle />
          <Tooltip content="设置">
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </Tooltip>
        </div>

        {/* 设置弹层 */}
        <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)}>
          <SettingsPanel
            config={config}
            ffmpegInfo={ffmpegInfo}
            onConfigChange={updateConfig}
            onDetectFFmpeg={runDetectFFmpeg}
          />
        </SettingsModal>

        {/* 文件选择 */}
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <FilePicker
            videoPath={videoPath}
            onSelect={setVideoPath}
            disabled={isProcessing}
          />
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3">
          {!isProcessing ? (
            <button
              onClick={startProcessing}
              disabled={!videoPath}
              className="px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              开始生成字幕
            </button>
          ) : (
            <button
              onClick={cancelProcessing}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
            >
              取消
            </button>
          )}

          {pipeline.stage === 'done' && pipeline.entries.length > 0 && (
            <>
              <button
                onClick={retranslate}
                disabled={!config.translation.enabled}
                className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                重新翻译
              </button>
              <button
                onClick={handleExport}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                另存为...
              </button>
            </>
          )}
        </div>

        {/* 进度条 */}
        <ProgressBar
          stage={pipeline.stage}
          progress={pipeline.progress}
          message={pipeline.message}
          stageLabel={stageLabel}
        />

        {/* 日志 + 字幕预览 */}
        <LogTabs
          logs={log.logs}
          entries={pipeline.entries}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>
    </div>
  );
}
