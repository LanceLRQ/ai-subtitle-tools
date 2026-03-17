import { invoke } from '@tauri-apps/api/core';
import { fetch } from '@tauri-apps/plugin-http';
import type { AppConfig, AsrResult, FunASRResponse, FunASRSegment, FunASRWordToken } from './types';

export type { AsrResult } from './types';

export async function recognizeSpeech(
  audioFilePath: string,
  config: AppConfig['funasr']
): Promise<AsrResult> {
  // 读取音频文件二进制
  const audioBytes = await invoke<number[]>('read_file_bytes', { path: audioFilePath });
  const audioData = new Uint8Array(audioBytes);

  // 构造 multipart/form-data
  const formData = new FormData();
  const audioBlob = new Blob([audioData], { type: 'audio/wav' });
  formData.append('file', audioBlob, 'audio.wav');
  formData.append('model', config.model);
  formData.append('response_format', 'verbose_json');
  formData.append('language', 'auto');
  formData.append('word_timestamps', 'true');

  // 构造请求头
  const headers: Record<string, string> = {};
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  // 发送请求
  const url = `${config.url.replace(/\/+$/, '')}/v1/audio/transcriptions`;
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`FunASR API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as FunASRResponse;

  // 将 segments 映射为 SubtitleEntry
  if (!data.segments || data.segments.length === 0) {
    throw new Error('FunASR returned no segments');
  }

  // 映射 segments，兼容 word_tokens / tokens 两种字段名
  const segments: FunASRSegment[] = data.segments.map((segment) => {
    const raw = segment as unknown as Record<string, unknown>;
    const rawTokens = (raw.word_tokens ?? raw.tokens) as
      | Array<{ text: string; start: number; end: number; start_time?: number; end_time?: number }>
      | undefined;

    let wordTokens: FunASRWordToken[] | undefined;
    if (Array.isArray(rawTokens) && rawTokens.length > 0) {
      wordTokens = rawTokens.map((t) => ({
        text: t.text,
        start_time: t.start_time ?? t.start,
        end_time: t.end_time ?? t.end,
      }));
    }

    return {
      id: segment.id,
      text: segment.text,
      start: segment.start,
      end: segment.end,
      speaker: segment.speaker,
      word_tokens: wordTokens,
    };
  });

  const entries = segments.map((segment, index) => ({
    index: index + 1,
    startTime: Math.round(segment.start * 1000),
    endTime: Math.round(segment.end * 1000),
    originalText: segment.text.trim(),
    translatedText: '',
    speakerId: segment.speaker,
  }));

  return { entries, segments, rawResponse: data };
}
