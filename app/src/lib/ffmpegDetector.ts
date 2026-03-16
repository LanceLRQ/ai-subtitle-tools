import { invoke } from '@tauri-apps/api/core';
import type { FFmpegDetectResult } from './types';

/**
 * 验证指定路径的 FFmpeg 是否可用
 * 返回版本字符串，失败则抛出异常
 */
async function checkFFmpeg(path: string): Promise<string> {
  return invoke<string>('check_ffmpeg_version', { path });
}

/**
 * 获取应用程序所在目录（用于检测本地 ffmpeg）
 */
async function getAppDir(): Promise<string> {
  return invoke<string>('get_app_dir');
}

/**
 * 三级优先级检测 FFmpeg
 * 1. 用户配置路径
 * 2. 程序目录下的 ffmpeg
 * 3. 系统 PATH
 */
export async function detectFFmpeg(configPath?: string): Promise<FFmpegDetectResult> {
  // 优先级 1: 用户配置路径
  if (configPath) {
    try {
      const version = await checkFFmpeg(configPath);
      return { path: configPath, version, source: 'config' };
    } catch {
      // 配置路径无效，继续检测
    }
  }

  // 优先级 2: 程序目录下的 ffmpeg
  try {
    const appDir = await getAppDir();
    const localPaths = [
      `${appDir}/ffmpeg`,
      `${appDir}/ffmpeg.exe`,
    ];

    for (const localPath of localPaths) {
      try {
        const version = await checkFFmpeg(localPath);
        return { path: localPath, version, source: 'local' };
      } catch {
        // 继续尝试下一个
      }
    }
  } catch {
    // 获取应用目录失败，跳过
  }

  // 优先级 3: 系统 PATH
  try {
    const version = await checkFFmpeg('ffmpeg');
    return { path: 'ffmpeg', version, source: 'system' };
  } catch {
    throw new Error(
      'FFmpeg not found. Please install FFmpeg or configure the path in settings.'
    );
  }
}
