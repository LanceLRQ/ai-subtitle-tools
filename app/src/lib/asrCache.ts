import { invoke } from '@tauri-apps/api/core';

/** 检查是否存在 ASR 缓存 */
export async function checkAsrCache(videoPath: string): Promise<boolean> {
  return invoke<boolean>('check_asr_cache', { videoPath });
}

/** 读取 ASR 缓存 */
export async function readAsrCache(videoPath: string): Promise<string> {
  return invoke<string>('read_asr_cache', { videoPath });
}

/** 写入 ASR 缓存 */
export async function writeAsrCache(videoPath: string, asrJson: string): Promise<void> {
  return invoke<void>('write_asr_cache', { videoPath, asrJson });
}
