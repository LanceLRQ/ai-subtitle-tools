import { invoke } from '@tauri-apps/api/core';
import { fetch } from '@tauri-apps/plugin-http';
import type { AppConfig, AsrResult, FunASRSegment, FunASRWordToken } from './types';

/** 阿里云转写任务状态 */
interface AliyunTaskOutput {
  task_id: string;
  task_status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  task_metrics?: {
    TOTAL: number;
    SUCCEEDED: number;
    FAILED: number;
  };
  results?: Array<{
    file_url: string;
    transcription_url: string;
    subtask_status: string;
  }>;
}

/** 阿里云转写结果中的句子 */
interface AliyunSentence {
  text: string;
  begin_time: number;
  end_time: number;
  sentence_id?: number;
  words?: Array<{
    text: string;
    punctuation: string;
    begin_time: number;
    end_time: number;
  }>;
}

/** 阿里云转写结果 */
interface AliyunTranscript {
  sentences: AliyunSentence[];
}

/**
 * 上传音频文件到阿里云 DashScope
 * 返回 file://file-xxx 格式的 URL
 */
async function uploadFile(
  audioFilePath: string,
  config: AppConfig['aliyunAsr']
): Promise<string> {
  const audioBytes = await invoke<number[]>('read_file_bytes', { path: audioFilePath });
  const audioData = new Uint8Array(audioBytes);

  const formData = new FormData();
  const audioBlob = new Blob([audioData], { type: 'audio/wav' });
  formData.append('file', audioBlob, 'audio.wav');
  formData.append('purpose', 'file-extract');

  const url = `${config.baseUrl.replace(/\/+$/, '')}/compatible-mode/v1/files`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Aliyun file upload failed (${response.status}): ${errorText}`);
  }

  const data = await response.json() as { id: string };
  return `file://${data.id}`;
}

/** 判断是否为 qwen3 系列模型 */
function isQwen3Model(model: string): boolean {
  return model.startsWith('qwen3-asr') || model.startsWith('qwen-audio');
}

/**
 * 提交转写任务
 * 返回 task_id
 */
async function submitTask(
  fileUrl: string,
  config: AppConfig['aliyunAsr']
): Promise<string> {
  const url = `${config.baseUrl.replace(/\/+$/, '')}/services/audio/asr/transcription`;
  const isQwen3 = isQwen3Model(config.model);

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${config.apiKey}`,
    'Content-Type': 'application/json',
  };
  if (isQwen3) {
    headers['X-DashScope-Async'] = 'enable';
  }

  const body = isQwen3
    ? {
        model: config.model,
        input: { file_url: fileUrl },
        parameters: { channel_id: [0], enable_itn: false, enable_words: true },
      }
    : {
        model: config.model,
        input: { file_urls: [fileUrl] },
        parameters: { language_hints: ['zh', 'en'] },
      };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Aliyun ASR task submission failed (${response.status}): ${errorText}`);
  }

  const data = await response.json() as { output: AliyunTaskOutput };
  if (!data.output?.task_id) {
    throw new Error('Aliyun ASR: no task_id in response');
  }
  return data.output.task_id;
}

/**
 * 轮询任务状态，指数退避
 * 2s → 4s → 8s → 10s（上限），最长等待 10 分钟
 */
async function pollTask(
  taskId: string,
  config: AppConfig['aliyunAsr'],
  isCancelled: () => boolean,
  onProgress?: (message: string) => void
): Promise<AliyunTaskOutput> {
  const maxWait = 10 * 60 * 1000; // 10 分钟
  const startTime = Date.now();
  let interval = 2000;

  while (Date.now() - startTime < maxWait) {
    if (isCancelled()) {
      throw new Error('ASR task cancelled');
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
    interval = Math.min(interval * 2, 10000);

    const url = `${config.baseUrl.replace(/\/+$/, '')}/tasks/${taskId}`;
    const pollHeaders: Record<string, string> = {
      'Authorization': `Bearer ${config.apiKey}`,
    };
    if (isQwen3Model(config.model)) {
      pollHeaders['X-DashScope-Async'] = 'enable';
    }
    const response = await fetch(url, {
      method: 'GET',
      headers: pollHeaders,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Aliyun ASR poll failed (${response.status}): ${errorText}`);
    }

    const data = await response.json() as { output: AliyunTaskOutput };
    const status = data.output.task_status;

    if (status === 'SUCCEEDED') {
      return data.output;
    }
    if (status === 'FAILED') {
      throw new Error('Aliyun ASR task failed');
    }

    onProgress?.(`${status}...`);
  }

  throw new Error('Aliyun ASR task timed out (10 minutes)');
}

/**
 * 下载并解析转写结果
 */
async function downloadResult(transcriptionUrl: string): Promise<AliyunTranscript[]> {
  const response = await fetch(transcriptionUrl, { method: 'GET' });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to download transcription result (${response.status}): ${errorText}`);
  }

  const data = await response.json() as { transcripts: AliyunTranscript[] };
  return data.transcripts ?? [];
}

/**
 * 将阿里云转写结果转换为 FunASRSegment 通用格式
 * 时间单位：阿里云毫秒 → FunASRSegment 秒
 */
function convertToSegments(transcripts: AliyunTranscript[]): FunASRSegment[] {
  const segments: FunASRSegment[] = [];
  let idCounter = 0;

  for (const transcript of transcripts) {
    if (!transcript.sentences) continue;
    for (const sentence of transcript.sentences) {
      const wordTokens: FunASRWordToken[] | undefined = sentence.words?.map((w) => ({
        text: w.text + (w.punctuation || ''),
        start_time: w.begin_time / 1000,
        end_time: w.end_time / 1000,
      }));

      segments.push({
        id: sentence.sentence_id ?? idCounter,
        text: sentence.text,
        start: sentence.begin_time / 1000,
        end: sentence.end_time / 1000,
        word_tokens: wordTokens,
      });
      idCounter++;
    }
  }

  return segments;
}

/**
 * 阿里云 DashScope ASR 主函数
 * 异步工作流：上传文件 → 提交任务 → 轮询状态 → 下载结果 → 转换格式
 */
export async function recognizeSpeechAliyun(
  audioFilePath: string,
  config: AppConfig['aliyunAsr'],
  onProgress?: (message: string) => void,
  isCancelled?: () => boolean
): Promise<AsrResult> {
  const cancelled = isCancelled ?? (() => false);

  // 1. 上传文件
  onProgress?.('pipeline.uploadingAudio');
  const fileUrl = await uploadFile(audioFilePath, config);
  if (cancelled()) throw new Error('ASR task cancelled');

  // 2. 提交转写任务
  onProgress?.('pipeline.asrTaskSubmitted');
  const taskId = await submitTask(fileUrl, config);
  if (cancelled()) throw new Error('ASR task cancelled');

  // 3. 轮询任务状态
  onProgress?.('pipeline.asrTaskPolling');
  const taskOutput = await pollTask(taskId, config, cancelled, onProgress);

  // 4. 下载结果
  onProgress?.('pipeline.asrTaskDownloading');
  const results = taskOutput.results ?? [];
  if (results.length === 0 || !results[0].transcription_url) {
    throw new Error('Aliyun ASR: no transcription result');
  }
  const transcripts = await downloadResult(results[0].transcription_url);

  // 5. 转换为通用格式
  const segments = convertToSegments(transcripts);
  if (segments.length === 0) {
    throw new Error('Aliyun ASR returned no segments');
  }

  const entries = segments.map((segment, index) => ({
    index: index + 1,
    startTime: Math.round(segment.start * 1000),
    endTime: Math.round(segment.end * 1000),
    originalText: segment.text.trim(),
    translatedText: '',
    speakerId: segment.speaker,
  }));

  return { entries, segments, rawResponse: { taskOutput, transcripts } };
}
