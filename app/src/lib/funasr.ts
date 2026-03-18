import { invoke } from '@tauri-apps/api/core';
import type { AppConfig, SubtitleEntry, FunASRResponse, FunASRSegment, FunASRWordToken } from './types';

/**
 * 调用 FunASR API 识别音频文件
 *
 * 通过 Rust 侧流式上传音频文件，避免将大文件加载到 JS 内存
 */
export interface AsrResult {
  entries: SubtitleEntry[];
  segments: FunASRSegment[];
  rawResponse: unknown;
}

/**
 * 解析 ASR 原始 JSON 字符串为 AsrResult
 *
 * 提取为独立函数，供缓存读取时复用
 */
export function parseAsrResponse(jsonStr: string): AsrResult {
  const data = JSON.parse(jsonStr) as FunASRResponse;

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

export async function recognizeSpeech(
  audioFilePath: string,
  config: AppConfig['funasr']
): Promise<AsrResult> {
  // 调用 Rust 命令（只传路径和配置，不传文件内容）
  const jsonStr = await invoke<string>('recognize_speech', {
    audioPath: audioFilePath,
    funasrUrl: config.url,
    apiKey: config.apiKey,
    model: config.model,
  });

  return parseAsrResponse(jsonStr);
}
