import { invoke } from '@tauri-apps/api/core';
import type { AppConfig } from './types';

/** 默认配置 */
export function getDefaultConfig(): AppConfig {
  return {
    ffmpeg: {
      path: '',
    },
    funasr: {
      url: 'http://127.0.0.1:17000',
      apiKey: '',
      model: 'qwen3-asr-1.7b',
    },
    llm: {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      model: 'gpt-4o-mini',
    },
    translation: {
      enabled: false,
      batchSize: 100,
      bilingual: true,
      targetLanguage: '中文',
    },
    subtitle: {
      maxCharsPerLine: 30,
    },
    debug: {
      enabled: false,
    },
  };
}

/** 从 Tauri 后端加载配置 */
export async function loadConfig(): Promise<AppConfig> {
  try {
    const json = await invoke<string>('read_config');
    const saved = JSON.parse(json) as Partial<AppConfig>;
    const defaults = getDefaultConfig();

    // 深度合并，确保新增字段有默认值
    return {
      ffmpeg: { ...defaults.ffmpeg, ...saved.ffmpeg },
      funasr: { ...defaults.funasr, ...saved.funasr },
      llm: { ...defaults.llm, ...saved.llm },
      translation: { ...defaults.translation, ...saved.translation },
      subtitle: { ...defaults.subtitle, ...saved.subtitle },
      debug: { ...defaults.debug, ...saved.debug },
    };
  } catch {
    return getDefaultConfig();
  }
}

/** 保存配置到 Tauri 后端 */
export async function saveConfig(config: AppConfig): Promise<void> {
  const json = JSON.stringify(config, null, 2);
  await invoke('write_config', { configJson: json });
}
