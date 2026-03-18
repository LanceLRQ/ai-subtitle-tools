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
 * 获取当前工作目录
 */
async function getCwd(): Promise<string> {
  return invoke<string>('get_cwd');
}

/**
 * 在指定目录中检测 ffmpeg，返回检测结果或 null
 */
async function tryDetectInDir(dir: string, source: FFmpegDetectResult['source']): Promise<FFmpegDetectResult | null> {
  const candidates = [
    `${dir}/ffmpeg`,
    `${dir}/ffmpeg.exe`,
  ];

  for (const candidate of candidates) {
    try {
      const version = await checkFFmpeg(candidate);
      return { path: candidate, version, source };
    } catch {
      // 继续尝试下一个
    }
  }
  return null;
}

/**
 * 四级优先级检测 FFmpeg
 * 1. 用户配置路径
 * 2. 程序目录下的 ffmpeg
 * 3. 当前工作目录下的 ffmpeg
 * 4. 系统 PATH
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

  // 优先级 2: 程序资源目录下的 ffmpeg
  try {
    const appDir = await getAppDir();
    const result = await tryDetectInDir(appDir, 'local');
    if (result) return result;
  } catch {
    // 获取应用目录失败，跳过
  }

  // 优先级 3: 当前工作目录下的 ffmpeg
  try {
    const cwd = await getCwd();
    const result = await tryDetectInDir(cwd, 'local');
    if (result) return result;
  } catch {
    // 获取工作目录失败，跳过
  }

  // 优先级 4: 系统 PATH
  try {
    const version = await checkFFmpeg('ffmpeg');
    return { path: 'ffmpeg', version, source: 'system' };
  } catch {
    throw new Error(
      'FFmpeg not found. Please install FFmpeg or configure the path in settings.'
    );
  }
}
