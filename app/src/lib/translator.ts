import { fetch } from '@tauri-apps/plugin-http';
import type { AppConfig, SubtitleEntry } from './types';

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/** 移除 LLM 深度思考标签内容 */
function stripThinkingTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

/** 构建请求头，API Key 为空时不发送 Authorization */
function buildHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  return headers;
}

/**
 * 对一批字幕调用 LLM 翻译
 */
async function translateBatch(
  texts: string[],
  config: AppConfig['llm'],
  targetLanguage: string
): Promise<string[]> {
  const numberedTexts = texts.map((t, i) => `${i + 1}. ${t}`).join('\n');
  const userPrompt =
    `请将下列字幕内容翻译成${targetLanguage}，每行一条，保持原序，仅返回翻译结果（每行格式为"序号. 译文"）：\n${numberedTexts}`;

  const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const body = {
    model: config.model,
    messages: [
      { role: 'system', content: '你是专业字幕翻译助手。' },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(config.apiKey),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const content = stripThinkingTags(data.choices?.[0]?.message?.content || '');
  if (!content) {
    throw new Error('LLM returned empty response');
  }

  // 解析翻译结果：每行一条，支持 "1. 译文" 或纯文本格式
  const lines = content.trim().split('\n').filter((l) => l.trim());
  const results: string[] = [];

  for (const line of lines) {
    // 去掉行首的序号标记（如 "1. "）
    const cleaned = line.replace(/^\d+\.\s*/, '').trim();
    if (cleaned) {
      results.push(cleaned);
    }
  }

  // 如果返回行数与输入不匹配，尝试直接按行分割
  if (results.length !== texts.length) {
    console.warn(
      `Translation count mismatch: expected ${texts.length}, got ${results.length}`
    );
    // 补齐或截断
    while (results.length < texts.length) {
      results.push('');
    }
  }

  return results.slice(0, texts.length);
}

/**
 * 带重试的批量翻译
 */
async function translateBatchWithRetry(
  texts: string[],
  config: AppConfig['llm'],
  targetLanguage: string,
  maxRetries: number = 3
): Promise<string[]> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await translateBatch(texts, config, targetLanguage);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries - 1) {
        // 指数退避: 1s, 2s, 4s
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * 翻译所有字幕条目
 *
 * 按 batchSize 分批翻译，通过 onProgress 回调报告进度
 */
export async function translateAll(
  entries: SubtitleEntry[],
  config: AppConfig,
  onProgress?: (completed: number, total: number) => void
): Promise<SubtitleEntry[]> {
  const { batchSize, targetLanguage } = config.translation;
  const result = [...entries];
  const total = entries.length;

  for (let i = 0; i < total; i += batchSize) {
    const batch = result.slice(i, i + batchSize);
    const texts = batch.map((e) => e.originalText);

    const translations = await translateBatchWithRetry(
      texts,
      config.llm,
      targetLanguage
    );

    // 填充翻译结果
    for (let j = 0; j < batch.length; j++) {
      result[i + j] = {
        ...result[i + j],
        translatedText: translations[j] || '',
      };
    }

    onProgress?.(Math.min(i + batchSize, total), total);
  }

  return result;
}

export interface LLMTestResult {
  reply: string;
  hadThinkingTags: boolean;
}

/**
 * 测试 LLM API 连通性，发送 "hi" 并返回响应
 */
export async function testLLMConnection(
  config: AppConfig['llm']
): Promise<LLMTestResult> {
  const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const body = {
    model: config.model,
    messages: [
      { role: 'user', content: 'hi' },
    ],
    max_tokens: 50,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(config.apiKey),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const raw = data.choices?.[0]?.message?.content || '';
  const hadThinkingTags = /<think>[\s\S]*?<\/think>/i.test(raw);
  const reply = stripThinkingTags(raw);
  if (!reply) {
    throw new Error('Empty response');
  }

  return { reply, hadThinkingTags };
}
