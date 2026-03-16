import { invoke } from '@tauri-apps/api/core';
import { fetch } from '@tauri-apps/plugin-http';
import type { AppConfig, SubtitleEntry, FunASRResponse } from './types';

/**
 * 调用 FunASR API 识别音频文件
 *
 * 通过 Rust 读取音频二进制，然后 HTTP multipart 上传到 FunASR 服务
 */
export interface AsrResult {
  entries: SubtitleEntry[];
  rawResponse: unknown;
}

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

  const entries = data.segments.map((segment, index) => ({
    index: index + 1,
    startTime: Math.round(segment.start * 1000),
    endTime: Math.round(segment.end * 1000),
    originalText: segment.text.trim(),
    translatedText: '',
    speakerId: segment.speaker,
  }));

  return { entries, rawResponse: data };
}
