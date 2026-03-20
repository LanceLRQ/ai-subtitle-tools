import { invoke } from '@tauri-apps/api/core';
import type {
  AppConfig,
  Qwen3SubmitResponse,
  Qwen3PollResponse,
  Qwen3HealthResponse,
  FunASRResponse,
  FunASRSegment,
  FunASRWordToken,
} from './types';

/**
 * 提交音频文件到 Qwen3-ASR-Service
 */
export async function submitQwen3Asr(
  audioPath: string,
  config: AppConfig['funasr']
): Promise<string> {
  const jsonStr = await invoke<string>('qwen3_submit_asr', {
    audioPath,
    baseUrl: config.url,
    apiKey: config.apiKey,
  });

  const data = JSON.parse(jsonStr) as Qwen3SubmitResponse;
  if (!data.task_id) {
    throw new Error('Qwen3 ASR submit response missing task_id');
  }
  return data.task_id;
}

/**
 * 轮询 Qwen3-ASR-Service 任务状态
 */
export async function pollQwen3Asr(
  taskId: string,
  baseUrl: string,
  apiKey: string
): Promise<Qwen3PollResponse> {
  const jsonStr = await invoke<string>('qwen3_poll_asr', {
    baseUrl,
    taskId,
    apiKey,
  });

  return JSON.parse(jsonStr) as Qwen3PollResponse;
}

/**
 * Qwen3-ASR-Service 健康检查
 */
export async function checkQwen3Health(
  baseUrl: string,
  apiKey: string
): Promise<Qwen3HealthResponse> {
  const jsonStr = await invoke<string>('qwen3_health_check', {
    baseUrl,
    apiKey,
  });

  return JSON.parse(jsonStr) as Qwen3HealthResponse;
}

/** 轮询超时上限：30 分钟 */
const MAX_POLL_TIMEOUT = 30 * 60 * 1000;

/**
 * 轮询循环：每秒查询一次任务状态，直到完成或失败
 */
export async function qwen3PollLoop(
  taskId: string,
  baseUrl: string,
  apiKey: string,
  onProgress: (progress: number) => void,
  cancelledRef: { current: boolean }
): Promise<Qwen3PollResponse> {
  const startTime = Date.now();
  for (;;) {
    if (cancelledRef.current) {
      throw new Error('Cancelled');
    }
    if (Date.now() - startTime > MAX_POLL_TIMEOUT) {
      throw new Error('ASR task timed out');
    }

    const poll = await pollQwen3Asr(taskId, baseUrl, apiKey);

    if (poll.status === 'completed') {
      onProgress(1.0);
      return poll;
    }

    if (poll.status === 'failed') {
      throw new Error(poll.error || 'ASR task failed');
    }

    // 更新进度（0.0 - 1.0）
    onProgress(poll.progress ?? 0);

    // 等待 1 秒后再次轮询
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

/**
 * 将 Qwen3 ASR 结果转换为 FunASR 格式的 JSON 字符串
 * 用于缓存兼容和复用现有解析逻辑
 */
export function convertQwen3ToFunAsrFormat(result: Qwen3PollResponse): string {
  const qwen3Result = result.result;
  if (!qwen3Result) {
    throw new Error('Qwen3 ASR result is empty');
  }

  const segments: FunASRSegment[] = qwen3Result.segments.map((seg, index) => {
    const wordTokens: FunASRWordToken[] = (seg.words || []).map((w) => ({
      text: w.text,
      start_time: w.start,
      end_time: w.end,
    }));

    return {
      id: index,
      text: seg.text,
      start: seg.start,
      end: seg.end,
      word_tokens: wordTokens.length > 0 ? wordTokens : undefined,
    };
  });

  const funasrResponse: FunASRResponse = {
    text: qwen3Result.text,
    segments,
    duration: qwen3Result.duration,
  };

  return JSON.stringify(funasrResponse);
}
