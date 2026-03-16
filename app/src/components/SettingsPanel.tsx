'use client';

import { useState } from 'react';
import type { AppConfig, FFmpegDetectResult } from '@/lib/types';

interface SettingsPanelProps {
  config: AppConfig;
  ffmpegInfo: FFmpegDetectResult | null;
  onConfigChange: (config: AppConfig) => void;
  onDetectFFmpeg: () => void;
}

export default function SettingsPanel({
  config,
  ffmpegInfo,
  onConfigChange,
  onDetectFFmpeg,
}: SettingsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const update = <K extends keyof AppConfig>(
    section: K,
    key: string,
    value: string | number | boolean
  ) => {
    const newConfig = {
      ...config,
      [section]: {
        ...config[section],
        [key]: value,
      },
    };
    onConfigChange(newConfig);
  };

  return (
    <div className="w-full">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
      >
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        设置
      </button>

      {isOpen && (
        <div className="mt-3 space-y-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
          {/* FFmpeg */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-gray-300">FFmpeg</legend>
            <div className="flex gap-2">
              <input
                type="text"
                value={config.ffmpeg.path}
                onChange={(e) => update('ffmpeg', 'path', e.target.value)}
                placeholder="FFmpeg 路径（留空自动检测）"
                className="flex-1 px-3 py-1.5 bg-gray-900 border border-gray-600 rounded text-sm text-gray-200 placeholder-gray-500"
              />
              <button
                onClick={onDetectFFmpeg}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
              >
                检测
              </button>
            </div>
            {ffmpegInfo && (
              <p className="text-xs text-green-400">
                {ffmpegInfo.version} ({ffmpegInfo.source === 'config' ? '用户配置' : ffmpegInfo.source === 'local' ? '本地目录' : '系统 PATH'})
              </p>
            )}
          </fieldset>

          {/* FunASR */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-gray-300">FunASR 语音识别</legend>
            <input
              type="text"
              value={config.funasr.url}
              onChange={(e) => update('funasr', 'url', e.target.value)}
              placeholder="API URL"
              className="w-full px-3 py-1.5 bg-gray-900 border border-gray-600 rounded text-sm text-gray-200 placeholder-gray-500"
            />
            <div className="flex gap-2">
              <input
                type="password"
                value={config.funasr.apiKey}
                onChange={(e) => update('funasr', 'apiKey', e.target.value)}
                placeholder="API Key（可选）"
                className="flex-1 px-3 py-1.5 bg-gray-900 border border-gray-600 rounded text-sm text-gray-200 placeholder-gray-500"
              />
              <input
                type="text"
                value={config.funasr.model}
                onChange={(e) => update('funasr', 'model', e.target.value)}
                placeholder="模型"
                className="w-48 px-3 py-1.5 bg-gray-900 border border-gray-600 rounded text-sm text-gray-200 placeholder-gray-500"
              />
            </div>
          </fieldset>

          {/* LLM */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-gray-300">LLM 翻译</legend>
            <input
              type="text"
              value={config.llm.baseUrl}
              onChange={(e) => update('llm', 'baseUrl', e.target.value)}
              placeholder="API Base URL"
              className="w-full px-3 py-1.5 bg-gray-900 border border-gray-600 rounded text-sm text-gray-200 placeholder-gray-500"
            />
            <div className="flex gap-2">
              <input
                type="password"
                value={config.llm.apiKey}
                onChange={(e) => update('llm', 'apiKey', e.target.value)}
                placeholder="API Key"
                className="flex-1 px-3 py-1.5 bg-gray-900 border border-gray-600 rounded text-sm text-gray-200 placeholder-gray-500"
              />
              <input
                type="text"
                value={config.llm.model}
                onChange={(e) => update('llm', 'model', e.target.value)}
                placeholder="模型"
                className="w-48 px-3 py-1.5 bg-gray-900 border border-gray-600 rounded text-sm text-gray-200 placeholder-gray-500"
              />
            </div>
          </fieldset>

          {/* 字幕设置 */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-gray-300">字幕设置</legend>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={config.subtitle.bilingual}
                  onChange={(e) => update('subtitle', 'bilingual', e.target.checked)}
                  className="rounded border-gray-600"
                />
                双语字幕
              </label>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">目标语言</label>
                <input
                  type="text"
                  value={config.subtitle.targetLanguage}
                  onChange={(e) => update('subtitle', 'targetLanguage', e.target.value)}
                  placeholder="如：英文、日文"
                  className="w-32 px-3 py-1.5 bg-gray-900 border border-gray-600 rounded text-sm text-gray-200 placeholder-gray-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">每批数量</label>
                <input
                  type="number"
                  value={config.subtitle.batchSize}
                  onChange={(e) => update('subtitle', 'batchSize', parseInt(e.target.value) || 10)}
                  min={1}
                  max={50}
                  className="w-20 px-3 py-1.5 bg-gray-900 border border-gray-600 rounded text-sm text-gray-200"
                />
              </div>
            </div>
          </fieldset>
        </div>
      )}
    </div>
  );
}
