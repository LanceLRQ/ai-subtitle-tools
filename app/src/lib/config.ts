import { invoke } from '@tauri-apps/api/core';
import type { AppConfig } from './types';

/** 默认配置 */
export function getDefaultConfig(): AppConfig {
  return {
    language: 'zh',
    ffmpeg: {
      path: '',
    },
    funasr: {
      provider: 'funasr',
      url: 'http://127.0.0.1:17000',
      apiKey: '',
      model: 'qwen3-asr-1.7b',
    },
    llm: {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      model: 'translategemma-4b-it',
    },
    translation: {
      enabled: false,
      batchSize: 50,
      bilingual: true,
      targetLanguage: '中文',
      glossaries: [],
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const saved = JSON.parse(json) as any;
    const defaults = getDefaultConfig();

    // 深度合并，确保新增字段有默认值
    const merged = {
      language: saved.language ?? defaults.language,
      ffmpeg: { ...defaults.ffmpeg, ...saved.ffmpeg },
      funasr: { ...defaults.funasr, ...saved.funasr },
      llm: { ...defaults.llm, ...saved.llm },
      translation: { ...defaults.translation, ...saved.translation },
      subtitle: { ...defaults.subtitle, ...saved.subtitle },
      debug: { ...defaults.debug, ...saved.debug },
    };

    // 旧配置迁移：glossary (string) -> glossaries (GlossaryEntry[])
    if (saved.translation && typeof saved.translation.glossary === 'string') {
      const oldGlossary = saved.translation.glossary.trim();
      if (oldGlossary) {
        merged.translation.glossaries = [{ title: '默认', content: oldGlossary }];
      } else {
        merged.translation.glossaries = [];
      }
      delete (merged.translation as Record<string, unknown>).glossary;
    }

    return merged;
  } catch {
    return getDefaultConfig();
  }
}

/** 保存配置到 Tauri 后端 */
export async function saveConfig(config: AppConfig): Promise<void> {
  const json = JSON.stringify(config, null, 2);
  await invoke('write_config', { configJson: json });
}
