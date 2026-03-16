import { invoke } from '@tauri-apps/api/core';

/**
 * 调试模式：将 ASR 原始 JSON 写入视频同目录
 */
export async function writeAsrDebugLog(
  videoPath: string,
  asrResponse: unknown
): Promise<void> {
  const logPath = videoPath.replace(/\.[^.]+$/, '_asr_debug.json');
  const content = JSON.stringify(asrResponse, null, 2);
  await invoke('save_debug_file', { path: logPath, content });
}

/**
 * 调试模式：追加 LLM 翻译请求/响应日志到视频同目录
 */
export async function appendLlmDebugLog(
  videoPath: string,
  batchIndex: number,
  request: { texts: string[]; prompt: string },
  response: string,
  hadThinkingTags: boolean
): Promise<void> {
  const logPath = videoPath.replace(/\.[^.]+$/, '_llm_debug.log');

  const separator = `\n${'='.repeat(60)}\n`;
  const entry = [
    separator,
    `[Batch #${batchIndex + 1}] ${new Date().toISOString()}`,
    `--- Request (${request.texts.length} subtitles) ---`,
    request.prompt,
    `--- Response ---`,
    response,
    hadThinkingTags ? '(<think> tags were stripped)' : '',
    separator,
  ].filter(Boolean).join('\n');

  await invoke('append_debug_file', { path: logPath, content: entry });
}
