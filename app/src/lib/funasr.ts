import { invoke } from '@tauri-apps/api/core';
import type { AppConfig, SubtitleEntry, FunASRResponse, FunASRSegment, FunASRWordToken } from './types';

/**
 * 调用 FunASR API 识别音频文件
 *
 * 通过 Rust 侧直接读取音频文件并 multipart 上传到 FunASR 服务，
 * 避免大文件经过 JS 层 IPC 导致卡死。
 */
export interface AsrResult {
  entries: SubtitleEntry[];
  segments: FunASRSegment[];
  rawResponse: unknown;
}

export async function recognizeSpeech(
  audioFilePath: string,
  config: AppConfig['funasr']
): Promise<AsrResult> {
  // Rust 侧完成文件读取和 HTTP 上传，返回 JSON 字符串
  const responseBody = await invoke<string>('upload_audio_to_asr', {
    audioPath: audioFilePath,
    asrUrl: config.url,
    apiKey: config.apiKey || '',
    model: config.model,
  });

  const data = JSON.parse(responseBody) as FunASRResponse;

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
