'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { AppConfig, FFmpegDetectResult } from '@/lib/types';
import { testLLMConnection } from '@/lib/translator';

interface SettingsPanelProps {
  config: AppConfig;
  ffmpegInfo: FFmpegDetectResult | null;
  onConfigChange: (config: AppConfig) => void;
  onDetectFFmpeg: () => void;
}

const ASR_MODELS = [
  { value: 'qwen3-asr-1.7b', label: 'Qwen3-ASR 1.7B' },
  { value: 'qwen3-asr-0.6b', label: 'Qwen3-ASR 0.6B' },
  { value: 'paraformer-large', label: 'Paraformer Large' },
];

const TARGET_LANGUAGES = [
  { value: '中文', annotation: 'Chinese' },
  { value: '英语', annotation: 'English' },
  { value: '日语', annotation: 'Japanese' },
  { value: '韩语', annotation: 'Korean' },
  { value: '西班牙语', annotation: 'Spanish' },
  { value: '葡萄牙语', annotation: 'Portuguese' },
];

/** 可输入的下拉组合框 */
function ComboBox({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; annotation?: string }[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className={`relative ${className || ''}`}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-1.5 bg-gray-900 border border-gray-600 rounded text-sm text-gray-200 placeholder-gray-500 disabled:opacity-50"
      />
      {open && !disabled && (
        <ul className="absolute z-10 mt-1 w-full bg-gray-900 border border-gray-600 rounded shadow-lg max-h-48 overflow-y-auto">
          {options.map((opt) => (
            <li
              key={opt.value}
              onMouseDown={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-700 flex items-center justify-between ${
                opt.value === value ? 'text-blue-400' : 'text-gray-200'
              }`}
            >
              <span>{opt.label}</span>
              {opt.annotation && (
                <span className="text-xs text-gray-500">{opt.annotation}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 开关组件 */
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? 'bg-blue-600' : 'bg-gray-600'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4.5' : 'translate-x-0.5'
          }`}
        />
      </button>
      <span className="text-sm text-gray-300">{label}</span>
    </label>
  );
}

export default function SettingsPanel({
  config,
  ffmpegInfo,
  onConfigChange,
  onDetectFFmpeg,
}: SettingsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [llmTestState, setLlmTestState] = useState<{
    status: 'idle' | 'testing' | 'success' | 'error';
    message: string;
    hadThinkingTags?: boolean;
  }>({ status: 'idle', message: '' });

  const handleTestLLM = useCallback(async () => {
    setLlmTestState({ status: 'testing', message: '测试中...' });
    try {
      const result = await testLLMConnection(config.llm);
      setLlmTestState({ status: 'success', message: result.reply, hadThinkingTags: result.hadThinkingTags });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLlmTestState({ status: 'error', message: msg });
    }
  }, [config.llm]);

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

  // 当前语言的注释
  const currentLangAnnotation = TARGET_LANGUAGES.find(
    (l) => l.value === config.translation.targetLanguage
  )?.annotation;

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
              <ComboBox
                value={config.funasr.model}
                onChange={(v) => update('funasr', 'model', v)}
                options={ASR_MODELS.map((m) => ({ value: m.value, label: m.label }))}
                placeholder="模型"
                className="w-52"
              />
            </div>
          </fieldset>

          {/* LLM */}
          <fieldset className="space-y-2">
            <div className="flex items-center justify-between">
              <legend className="text-sm font-medium text-gray-300">LLM 翻译</legend>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTestLLM}
                  disabled={llmTestState.status === 'testing'}
                  className="text-sm text-blue-400 hover:text-blue-300 underline underline-offset-2 disabled:text-gray-600 disabled:no-underline disabled:cursor-not-allowed transition-colors"
                >
                  {llmTestState.status === 'testing' ? '测试中...' : '测试连接'}
                </button>
                {llmTestState.status === 'success' && (
                  <span
                    className="text-xs text-green-400 flex items-center gap-1 cursor-default"
                    title={llmTestState.message + (llmTestState.hadThinkingTags ? '\n(<think> 标签已自动过滤)' : '')}
                  >
                    成功✅
                  </span>
                )}
                {llmTestState.status === 'error' && (
                  <span className="text-xs text-red-400 truncate max-w-xs" title={llmTestState.message}>
                    {llmTestState.message}
                  </span>
                )}
              </div>
            </div>
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
                className="w-52 px-3 py-1.5 bg-gray-900 border border-gray-600 rounded text-sm text-gray-200 placeholder-gray-500"
              />
            </div>
          </fieldset>

          {/* 翻译设置 */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-gray-300">翻译设置</legend>
            <div className="flex items-center gap-6">
              <Toggle
                checked={config.translation.enabled}
                onChange={(v) => update('translation', 'enabled', v)}
                label="启用翻译"
              />
              <Toggle
                checked={config.translation.bilingual}
                onChange={(v) => update('translation', 'bilingual', v)}
                label="双语字幕"
              />
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">目标语言</label>
                <ComboBox
                  value={config.translation.targetLanguage}
                  onChange={(v) => update('translation', 'targetLanguage', v)}
                  options={TARGET_LANGUAGES.map((l) => ({
                    value: l.value,
                    label: l.value,
                    annotation: l.annotation,
                  }))}
                  placeholder="输入或选择语言"
                  disabled={!config.translation.enabled}
                  className="w-40"
                />
                {currentLangAnnotation && (
                  <span className="text-xs text-gray-500">{currentLangAnnotation}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">每批数量</label>
                <input
                  type="number"
                  value={config.translation.batchSize}
                  onChange={(e) => update('translation', 'batchSize', parseInt(e.target.value) || 10)}
                  min={1}
                  max={200}
                  disabled={!config.translation.enabled}
                  className="w-20 px-3 py-1.5 bg-gray-900 border border-gray-600 rounded text-sm text-gray-200 disabled:opacity-50"
                />
              </div>
            </div>
          </fieldset>

          {/* 字幕设置 */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-gray-300">字幕设置</legend>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400">每行最大字符数</label>
              <input
                type="number"
                value={config.subtitle.maxCharsPerLine}
                onChange={(e) => update('subtitle', 'maxCharsPerLine', parseInt(e.target.value) || 30)}
                min={10}
                max={100}
                className="w-20 px-3 py-1.5 bg-gray-900 border border-gray-600 rounded text-sm text-gray-200"
              />
              <span className="text-xs text-gray-500">
                ASR 长文本将按标点拆分并合并为不超过此长度的字幕行
              </span>
            </div>
          </fieldset>

          {/* 调试 */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-gray-300">调试</legend>
            <div className="flex items-center gap-2">
              <Toggle
                checked={config.debug.enabled}
                onChange={(v) => update('debug', 'enabled', v)}
                label="调试模式"
              />
              <span className="text-xs text-gray-500">
                开启后将 ASR 原始 JSON 和 LLM 请求日志保存到视频所在目录
              </span>
            </div>
          </fieldset>
        </div>
      )}
    </div>
  );
}
