'use client';

import { usePipeline } from '@/hooks/usePipeline';
import SettingsPanel from '@/components/SettingsPanel';
import FilePicker from '@/components/FilePicker';
import ProgressBar from '@/components/ProgressBar';
import SubtitlePreview from '@/components/SubtitlePreview';
import { save } from '@tauri-apps/plugin-dialog';

export default function Home() {
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
    runDetectFFmpeg,
    exportSRT,
  } = usePipeline();

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
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* 标题 */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">AI Subtitle Tools</h1>
          <span className="text-xs text-gray-500">v0.1.0</span>
        </div>

        {/* 设置面板 */}
        <SettingsPanel
          config={config}
          ffmpegInfo={ffmpegInfo}
          onConfigChange={updateConfig}
          onDetectFFmpeg={runDetectFFmpeg}
        />

        {/* 文件选择 */}
        <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
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
              className="px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
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
            <button
              onClick={handleExport}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              另存为...
            </button>
          )}
        </div>

        {/* 进度条 */}
        <ProgressBar
          stage={pipeline.stage}
          progress={pipeline.progress}
          message={pipeline.message}
          stageLabel={stageLabel}
        />

        {/* 字幕预览 */}
        {pipeline.entries.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-gray-400">
              字幕预览 ({pipeline.entries.length} 条)
            </h2>
            <SubtitlePreview entries={pipeline.entries} />
          </div>
        )}
      </div>
    </div>
  );
}
