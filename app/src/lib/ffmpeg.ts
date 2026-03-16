import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface FFmpegProgressPayload {
  line: string;
  percent?: number;
}

export interface FFmpegDonePayload {
  success: boolean;
  message: string;
}

/**
 * 获取视频对应的临时音频文件路径
 */
export async function getTempAudioPath(videoPath: string): Promise<string> {
  return invoke<string>('get_temp_audio_path', { videoPath });
}

/**
 * 提取视频音频为 16kHz 单声道 WAV
 *
 * 通过 Tauri 事件 ffmpeg-progress / ffmpeg-done 推送进度和完成通知
 */
export async function extractAudio(
  videoPath: string,
  outputPath: string,
  ffmpegPath: string,
  onProgress?: (payload: FFmpegProgressPayload) => void
): Promise<void> {
  // 监听进度事件
  const unlistenProgress = onProgress
    ? await listen<FFmpegProgressPayload>('ffmpeg-progress', (event) => {
        onProgress(event.payload);
      })
    : null;

  // 监听完成事件，通过 Promise 等待
  const result = await new Promise<FFmpegDonePayload>((resolve, reject) => {
    let unlistenDone: (() => void) | null = null;

    listen<FFmpegDonePayload>('ffmpeg-done', (event) => {
      unlistenDone?.();
      unlistenProgress?.();
      if (event.payload.success) {
        resolve(event.payload);
      } else {
        reject(new Error(event.payload.message));
      }
    }).then((fn) => {
      unlistenDone = fn;
    });

    // 调用 Rust 命令启动 FFmpeg
    const args = [
      '-i', videoPath,
      '-vn',
      '-acodec', 'pcm_s16le',
      '-ar', '16000',
      '-ac', '1',
      '-y',
      outputPath,
    ];

    invoke('run_ffmpeg', { ffmpegPath, args }).catch((err) => {
      unlistenDone?.();
      unlistenProgress?.();
      reject(new Error(String(err)));
    });
  });

  if (!result.success) {
    throw new Error(result.message);
  }
}

/**
 * 删除临时音频文件
 */
export async function removeTempFile(path: string): Promise<void> {
  try {
    await invoke('remove_file', { path });
  } catch {
    // 删除失败不阻塞流程
  }
}
