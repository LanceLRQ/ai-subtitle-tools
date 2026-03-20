'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ask } from '@tauri-apps/plugin-dialog';
import type { AppConfig, FFmpegDetectResult, AsrProvider, Qwen3HealthResponse } from '@/lib/types';
import { testLLMConnection } from '@/lib/translator';
import { checkQwen3Health } from '@/lib/qwen3Asr';
import { useI18n } from '@/i18n';
import type { Locale } from '@/i18n';
import AsrCacheModal from './AsrCacheModal';

/** 格式化文件大小 */
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

interface SettingsPanelProps {
  config: AppConfig;
  ffmpegInfo: FFmpegDetectResult | null;
  onConfigChange: (config: AppConfig) => void;
  onDetectFFmpeg: () => void;
}

const ASR_PROVIDERS: { value: AsrProvider; label: string }[] = [
  { value: 'funasr', label: 'Quantatirsk/funasr-api' },
  { value: 'lancelrq/qwen3-asr-service', label: 'Qwen3-ASR-Service' },
];

const ASR_MODELS = [
  { value: 'qwen3-asr-1.7b', label: 'Qwen3-ASR 1.7B' },
  { value: 'qwen3-asr-0.6b', label: 'Qwen3-ASR 0.6B' },
  { value: 'paraformer-large', label: 'Paraformer Large' },
];

const DEFAULT_URLS: Record<AsrProvider, string> = {
  'funasr': 'http://127.0.0.1:17000',
  'lancelrq/qwen3-asr-service': 'http://127.0.0.1:8765/v1',
};

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
        className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50"
      />
      {open && !disabled && (
        <ul className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded shadow-lg max-h-48 overflow-y-auto">
          {options.map((opt) => (
            <li
              key={opt.value}
              onMouseDown={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between ${
                opt.value === value ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-200'
              }`}
            >
              <span>{opt.label}</span>
              {opt.annotation && (
                <span className="text-xs text-gray-400 dark:text-gray-500">{opt.annotation}</span>
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
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-center gap-2 select-none ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked && !disabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4.5' : 'translate-x-0.5'
          }`}
        />
      </button>
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
    </label>
  );
}

export default function SettingsPanel({
  config,
  ffmpegInfo,
  onConfigChange,
  onDetectFFmpeg,
}: SettingsPanelProps) {
  const { t } = useI18n();
  const [llmTestState, setLlmTestState] = useState<{
    status: 'idle' | 'testing' | 'success' | 'error';
    message: string;
    hadThinkingTags?: boolean;
  }>({ status: 'idle', message: '' });

  // Qwen3 健康检查状态
  const [healthState, setHealthState] = useState<{
    status: 'idle' | 'checking' | 'success' | 'error';
    data?: Qwen3HealthResponse;
    error?: string;
  }>({ status: 'idle' });

  // 存储管理状态
  const [storageInfo, setStorageInfo] = useState<{
    cacheSize: number;
    tempSize: number;
    configSize: number;
    configDir: string;
  } | null>(null);
  const [cacheModalOpen, setCacheModalOpen] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [clearingTemp, setClearingTemp] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);
  const [tempCleared, setTempCleared] = useState(false);

  const refreshStorageInfo = useCallback(async () => {
    try {
      const [cacheSize, tempSize, configSize, configDir] = await Promise.all([
        invoke<number>('get_asr_cache_size'),
        invoke<number>('get_temp_dir_size'),
        invoke<number>('get_config_dir_size'),
        invoke<string>('get_config_dir'),
      ]);
      setStorageInfo({ cacheSize, tempSize, configSize, configDir });
    } catch {
      // 忽略错误
    }
  }, []);

  useEffect(() => {
    refreshStorageInfo();
  }, [refreshStorageInfo]);

  const handleClearCache = useCallback(async () => {
    const confirmed = await ask(t('settings.storage.clearCacheConfirm'), { kind: 'warning' });
    if (!confirmed) return;
    setClearingCache(true);
    setCacheCleared(false);
    try {
      await invoke('clear_asr_cache');
      setCacheCleared(true);
      await refreshStorageInfo();
    } catch (err) {
      console.error('Failed to clear cache:', err);
    } finally {
      setClearingCache(false);
    }
  }, [refreshStorageInfo, t]);

  const handleClearTemp = useCallback(async () => {
    const confirmed = await ask(t('settings.storage.clearTempConfirm'), { kind: 'warning' });
    if (!confirmed) return;
    setClearingTemp(true);
    setTempCleared(false);
    try {
      await invoke('cleanup_temp_files');
      setTempCleared(true);
      await refreshStorageInfo();
    } catch (err) {
      console.error('Failed to clear temp:', err);
    } finally {
      setClearingTemp(false);
    }
  }, [refreshStorageInfo, t]);

  const handleOpenConfigDir = useCallback(async () => {
    if (!storageInfo?.configDir) return;
    try {
      await invoke('open_dir_in_explorer', { path: storageInfo.configDir });
    } catch (err) {
      console.error('Failed to open config dir:', err);
    }
  }, [storageInfo?.configDir]);

  const handleHealthCheck = useCallback(async () => {
    setHealthState({ status: 'checking' });
    try {
      const data = await checkQwen3Health(config.funasr.url, config.funasr.apiKey);
      setHealthState({ status: 'success', data });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setHealthState({ status: 'error', error: msg });
    }
  }, [config.funasr.url, config.funasr.apiKey]);

  const handleProviderChange = useCallback((provider: AsrProvider) => {
    const currentUrl = config.funasr.url;
    const newDefault = DEFAULT_URLS[provider];
    // 当前 URL 为空或是任意 provider 的预设值时，自动切换到新 provider 的预设值
    const isDefaultUrl = Object.values(DEFAULT_URLS).includes(currentUrl);
    const newUrl = (!currentUrl || isDefaultUrl) ? newDefault : currentUrl;
    onConfigChange({
      ...config,
      funasr: { ...config.funasr, provider, url: newUrl },
    });
    setHealthState({ status: 'idle' });
  }, [config, onConfigChange]);

  const handleTestLLM = useCallback(async () => {
    setLlmTestState({ status: 'testing', message: t('settings.llm.testing') });
    try {
      const result = await testLLMConnection(config.llm);
      setLlmTestState({ status: 'success', message: result.reply, hadThinkingTags: result.hadThinkingTags });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLlmTestState({ status: 'error', message: msg });
    }
  }, [config.llm, t]);

  const update = <K extends keyof AppConfig>(
    section: K,
    key: string,
    value: string | number | boolean
  ) => {
    const sectionValue = config[section];
    if (typeof sectionValue === 'object' && sectionValue !== null) {
      const newConfig = {
        ...config,
        [section]: {
          ...sectionValue,
          [key]: value,
        },
      };
      onConfigChange(newConfig);
    }
  };

  const ffmpegSourceLabel = (source: string) => {
    if (source === 'config') return t('settings.ffmpeg.sourceConfig');
    if (source === 'local') return t('settings.ffmpeg.sourceLocal');
    return t('settings.ffmpeg.sourceSystem');
  };

  // 当前语言的注释
  const currentLangAnnotation = TARGET_LANGUAGES.find(
    (l) => l.value === config.translation.targetLanguage
  )?.annotation;

  return (
    <div className="space-y-4">
      {/* 语言选择 */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('settings.language.label')}</legend>
        <select
          value={config.language}
          onChange={(e) => onConfigChange({ ...config, language: e.target.value as Locale })}
          className="px-3 h-9 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-gray-200"
        >
          <option value="zh">中文</option>
          <option value="en">English</option>
        </select>
      </fieldset>

      {/* FFmpeg */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('settings.ffmpeg.legend')}</legend>
        <div className="flex gap-2">
          <input
            type="text"
            value={config.ffmpeg.path}
            onChange={(e) => update('ffmpeg', 'path', e.target.value)}
            placeholder={t('settings.ffmpeg.pathPlaceholder')}
            className="flex-1 px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
          />
          <button
            onClick={onDetectFFmpeg}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
          >
            {t('settings.ffmpeg.detect')}
          </button>
        </div>
        {ffmpegInfo && (
          <p className="text-xs text-green-400">
            {ffmpegInfo.version} ({ffmpegSourceLabel(ffmpegInfo.source)})
          </p>
        )}
      </fieldset>

      {/* ASR 语音识别 */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('settings.asr.legend')}</legend>
        {/* Provider 选择 */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 dark:text-gray-400 shrink-0">{t('settings.asr.provider')}</label>
          <select
            value={config.funasr.provider || 'funasr'}
            onChange={(e) => handleProviderChange(e.target.value as AsrProvider)}
            className="flex-1 px-3 h-8 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-gray-200"
          >
            {ASR_PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        {/* URL */}
        <input
          type="text"
          value={config.funasr.url}
          onChange={(e) => update('funasr', 'url', e.target.value)}
          placeholder="API URL"
          className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
        />
        {/* API Key + Model (FunASR only) */}
        <div className="flex gap-2">
          <input
            type="password"
            value={config.funasr.apiKey}
            onChange={(e) => update('funasr', 'apiKey', e.target.value)}
            placeholder={t('settings.funasr.apiKeyPlaceholder')}
            className="flex-1 px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
          />
          {(config.funasr.provider || 'funasr') === 'funasr' && (
            <ComboBox
              value={config.funasr.model}
              onChange={(v) => update('funasr', 'model', v)}
              options={ASR_MODELS.map((m) => ({ value: m.value, label: m.label }))}
              placeholder={t('settings.funasr.modelPlaceholder')}
              className="w-52"
            />
          )}
        </div>
        {/* Qwen3 健康检查 */}
        {(config.funasr.provider) === 'lancelrq/qwen3-asr-service' && (
          <div className="space-y-1">
            <button
              onClick={handleHealthCheck}
              disabled={healthState.status === 'checking'}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 underline underline-offset-2 disabled:text-gray-400 dark:disabled:text-gray-600 disabled:no-underline disabled:cursor-not-allowed transition-colors"
            >
              {healthState.status === 'checking' ? t('settings.asr.healthChecking') : t('settings.asr.healthCheck')}
            </button>
            {healthState.status === 'success' && healthState.data && (
              <div className="text-xs text-green-500 dark:text-green-400 space-y-0.5 pl-1">
                <p>{t('settings.asr.healthDevice', { device: healthState.data.device })}</p>
                <p>{t('settings.asr.healthModel', { model: healthState.data.model_size })}</p>
                <p>{t('settings.asr.healthBackend', { backend: healthState.data.asr_backend })}</p>
                <p>{t('settings.asr.healthAlign', { status: healthState.data.align_enabled ? 'ON' : 'OFF' })}</p>
                <p>{t('settings.asr.healthPunc', { status: healthState.data.punc_enabled ? 'ON' : 'OFF' })}</p>
              </div>
            )}
            {healthState.status === 'error' && (
              <p className="text-xs text-red-400 pl-1">{healthState.error}</p>
            )}
          </div>
        )}
      </fieldset>

      {/* LLM */}
      <fieldset className="space-y-2">
        <div className="flex items-center justify-between">
          <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('settings.llm.legend')}</legend>
          <div className="flex items-center gap-2">
            <button
              onClick={handleTestLLM}
              disabled={llmTestState.status === 'testing'}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 underline underline-offset-2 disabled:text-gray-400 dark:disabled:text-gray-600 disabled:no-underline disabled:cursor-not-allowed transition-colors"
            >
              {llmTestState.status === 'testing' ? t('settings.llm.testing') : t('settings.llm.testConnection')}
            </button>
            {llmTestState.status === 'success' && (
              <span
                className="text-xs text-green-400 flex items-center gap-1 cursor-default"
                title={llmTestState.message + (llmTestState.hadThinkingTags ? '\n' + t('settings.llm.thinkingTagFiltered') : '')}
              >
                {t('settings.llm.success')}
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
          className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
        />
        <div className="flex gap-2">
          <input
            type="password"
            value={config.llm.apiKey}
            onChange={(e) => update('llm', 'apiKey', e.target.value)}
            placeholder="API Key"
            className="flex-1 px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
          />
          <input
            type="text"
            value={config.llm.model}
            onChange={(e) => update('llm', 'model', e.target.value)}
            placeholder={t('settings.llm.modelPlaceholder')}
            className="w-52 px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
      </fieldset>

      {/* 翻译设置 */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('settings.translation.legend')}</legend>
        <div className="flex items-center gap-6">
          <Toggle
            checked={config.translation.enabled}
            onChange={(v) => update('translation', 'enabled', v)}
            label={t('settings.translation.enabled')}
          />
          <Toggle
            checked={config.translation.bilingual}
            onChange={(v) => update('translation', 'bilingual', v)}
            label={t('settings.translation.bilingual')}
            disabled={!config.translation.enabled}
          />
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 dark:text-gray-400">{t('settings.translation.targetLanguage')}</label>
            <ComboBox
              value={config.translation.targetLanguage}
              onChange={(v) => update('translation', 'targetLanguage', v)}
              options={TARGET_LANGUAGES.map((l) => ({
                value: l.value,
                label: l.value,
                annotation: l.annotation,
              }))}
              placeholder={t('settings.translation.targetPlaceholder')}
              disabled={!config.translation.enabled}
              className="w-40"
            />
            {currentLangAnnotation && (
              <span className="text-xs text-gray-400 dark:text-gray-500">{currentLangAnnotation}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 dark:text-gray-400">{t('settings.translation.batchSize')}</label>
            <input
              type="number"
              value={config.translation.batchSize}
              onChange={(e) => update('translation', 'batchSize', parseInt(e.target.value) || 10)}
              min={1}
              max={200}
              disabled={!config.translation.enabled}
              className="w-20 px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-gray-200 disabled:opacity-50"
            />
          </div>
        </div>
      </fieldset>

      {/* 字幕设置 */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('settings.subtitle.legend')}</legend>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 dark:text-gray-400">{t('settings.subtitle.maxCharsPerLine')}</label>
          <input
            type="number"
            value={config.subtitle.maxCharsPerLine}
            onChange={(e) => update('subtitle', 'maxCharsPerLine', parseInt(e.target.value) || 30)}
            min={10}
            max={100}
            className="w-20 px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-gray-200"
          />
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {t('settings.subtitle.maxCharsHint')}
          </span>
        </div>
      </fieldset>

      {/* 调试 */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('settings.debug.legend')}</legend>
        <div className="flex items-center gap-2">
          <Toggle
            checked={config.debug.enabled}
            onChange={(v) => update('debug', 'enabled', v)}
            label={t('settings.debug.enabled')}
          />
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {t('settings.debug.hint')}
          </span>
        </div>
      </fieldset>

      {/* 存储管理 */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('settings.storage.legend')}</legend>
        <div className="space-y-1.5">
          {/* ASR 缓存 */}
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700 dark:text-gray-300">{t('settings.storage.asrCache')}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {storageInfo ? formatSize(storageInfo.cacheSize) : '...'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCacheModalOpen(true)}
                disabled={storageInfo?.cacheSize === 0}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 disabled:text-gray-400 dark:disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
              >
                {t('settings.storage.viewCache')}
              </button>
              <button
                onClick={handleClearCache}
                disabled={clearingCache || (storageInfo?.cacheSize === 0)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 disabled:text-gray-400 dark:disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
              >
                {clearingCache ? t('settings.storage.clearing') : cacheCleared ? t('settings.storage.cleared') : t('settings.storage.clear')}
              </button>
            </div>
          </div>

          {/* 临时文件 */}
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700 dark:text-gray-300">{t('settings.storage.tempFiles')}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {storageInfo ? formatSize(storageInfo.tempSize) : '...'}
              </span>
            </div>
            <button
              onClick={handleClearTemp}
              disabled={clearingTemp || (storageInfo?.tempSize === 0)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 disabled:text-gray-400 dark:disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              {clearingTemp ? t('settings.storage.clearing') : tempCleared ? t('settings.storage.cleared') : t('settings.storage.clear')}
            </button>
          </div>

          {/* 配置目录 */}
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700 dark:text-gray-300">{t('settings.storage.configDir')}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {storageInfo ? formatSize(storageInfo.configSize) : '...'}
              </span>
            </div>
            <button
              onClick={handleOpenConfigDir}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors"
            >
              {t('settings.storage.openDir')}
            </button>
          </div>
        </div>
      </fieldset>

      {/* ASR 缓存列表弹层 */}
      <AsrCacheModal
        isOpen={cacheModalOpen}
        onClose={() => setCacheModalOpen(false)}
        onChanged={refreshStorageInfo}
      />
    </div>
  );
}
