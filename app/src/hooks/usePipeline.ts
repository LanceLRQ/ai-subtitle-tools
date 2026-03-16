'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { AppConfig, PipelineState, PipelineStage, FFmpegDetectResult } from '@/lib/types';
import { loadConfig, saveConfig, getDefaultConfig } from '@/lib/config';
import { detectFFmpeg } from '@/lib/ffmpegDetector';
import { extractAudio, getTempAudioPath, removeTempFile } from '@/lib/ffmpeg';
import { recognizeSpeech } from '@/lib/funasr';
import { translateAll } from '@/lib/translator';
import { generateSRT } from '@/lib/subtitle';
import { invoke } from '@tauri-apps/api/core';

const STAGE_LABELS: Record<PipelineStage, string> = {
  'idle': '就绪',
  'detecting-ffmpeg': '检测 FFmpeg...',
  'extracting-audio': '提取音频...',
  'recognizing': '语音识别中...',
  'translating': '翻译中...',
  'exporting': '导出字幕...',
  'done': '完成',
  'error': '出错',
};

export function usePipeline() {
  const [config, setConfig] = useState<AppConfig>(getDefaultConfig());
  const [pipeline, setPipeline] = useState<PipelineState>({
    stage: 'idle',
    progress: 0,
    message: '',
    entries: [],
  });
  const [ffmpegInfo, setFFmpegInfo] = useState<FFmpegDetectResult | null>(null);
  const [videoPath, setVideoPath] = useState<string>('');
  const cancelledRef = useRef(false);

  // 加载配置
  useEffect(() => {
    loadConfig().then(setConfig).catch(console.error);
  }, []);

  // 更新配置并保存
  const updateConfig = useCallback(async (newConfig: AppConfig) => {
    setConfig(newConfig);
    try {
      await saveConfig(newConfig);
    } catch (err) {
      console.error('Failed to save config:', err);
    }
  }, []);

  // 更新流水线状态
  const updatePipeline = useCallback((updates: Partial<PipelineState>) => {
    setPipeline((prev) => ({ ...prev, ...updates }));
  }, []);

  // 检测 FFmpeg
  const runDetectFFmpeg = useCallback(async () => {
    try {
      updatePipeline({ stage: 'detecting-ffmpeg', progress: 0, message: '正在检测 FFmpeg...' });
      const result = await detectFFmpeg(config.ffmpeg.path || undefined);
      setFFmpegInfo(result);
      updatePipeline({ stage: 'idle', progress: 0, message: `FFmpeg 已就绪: ${result.version}` });
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFFmpegInfo(null);
      updatePipeline({ stage: 'error', message: `FFmpeg 检测失败: ${msg}`, error: msg });
      return null;
    }
  }, [config.ffmpeg.path, updatePipeline]);

  // 开始处理流水线
  const startProcessing = useCallback(async () => {
    if (!videoPath) {
      updatePipeline({ stage: 'error', message: '请先选择视频文件', error: '未选择视频文件' });
      return;
    }

    cancelledRef.current = false;
    let tempAudioPath = '';

    try {
      // 阶段 1: 检测 FFmpeg
      updatePipeline({ stage: 'detecting-ffmpeg', progress: 0, message: '正在检测 FFmpeg...', error: undefined });
      const ffmpeg = ffmpegInfo || (await detectFFmpeg(config.ffmpeg.path || undefined));
      if (!ffmpeg) throw new Error('FFmpeg not available');
      setFFmpegInfo(ffmpeg);
      if (cancelledRef.current) return;

      // 阶段 2: 提取音频
      updatePipeline({ stage: 'extracting-audio', progress: 0, message: '正在提取音频...' });
      tempAudioPath = await getTempAudioPath(videoPath);
      await extractAudio(videoPath, tempAudioPath, ffmpeg.path, (payload) => {
        updatePipeline({ message: `提取音频: ${payload.line.slice(-80)}` });
      });
      if (cancelledRef.current) return;

      // 阶段 3: 语音识别
      updatePipeline({ stage: 'recognizing', progress: 0, message: '正在进行语音识别...' });
      const entries = await recognizeSpeech(tempAudioPath, config.funasr);
      updatePipeline({ entries, progress: 100 });
      if (cancelledRef.current) return;

      // 阶段 4: 翻译
      if (config.subtitle.bilingual && config.llm.apiKey) {
        updatePipeline({ stage: 'translating', progress: 0, message: '正在翻译字幕...' });
        const translated = await translateAll(entries, config, (completed, total) => {
          const percent = Math.round((completed / total) * 100);
          updatePipeline({
            progress: percent,
            message: `翻译进度: ${completed}/${total}`,
            entries: translated, // 实时更新已翻译的条目
          });
        });
        updatePipeline({ entries: translated, progress: 100 });
        if (cancelledRef.current) return;

        // 阶段 5: 导出
        updatePipeline({ stage: 'exporting', progress: 0, message: '正在导出字幕...' });
        const srtContent = generateSRT(translated, config.subtitle.bilingual);
        const srtPath = videoPath.replace(/\.[^.]+$/, '.srt');
        await invoke('save_file', { path: srtPath, content: srtContent });
        updatePipeline({ stage: 'done', progress: 100, message: `字幕已导出: ${srtPath}` });
      } else {
        // 无需翻译，直接导出
        updatePipeline({ stage: 'exporting', progress: 0, message: '正在导出字幕...' });
        const srtContent = generateSRT(entries, false);
        const srtPath = videoPath.replace(/\.[^.]+$/, '.srt');
        await invoke('save_file', { path: srtPath, content: srtContent });
        updatePipeline({ stage: 'done', progress: 100, message: `字幕已导出: ${srtPath}` });
      }
    } catch (err) {
      if (!cancelledRef.current) {
        const msg = err instanceof Error ? err.message : String(err);
        updatePipeline({ stage: 'error', message: `处理失败: ${msg}`, error: msg });
      }
    } finally {
      // 清理临时文件
      if (tempAudioPath) {
        removeTempFile(tempAudioPath).catch(console.error);
      }
    }
  }, [videoPath, config, ffmpegInfo, updatePipeline]);

  // 取消处理
  const cancelProcessing = useCallback(() => {
    cancelledRef.current = true;
    updatePipeline({ stage: 'idle', progress: 0, message: '已取消' });
  }, [updatePipeline]);

  // 导出到自定义路径
  const exportSRT = useCallback(async (path: string) => {
    try {
      const srtContent = generateSRT(pipeline.entries, config.subtitle.bilingual);
      await invoke('save_file', { path, content: srtContent });
      updatePipeline({ message: `字幕已导出: ${path}` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      updatePipeline({ stage: 'error', message: `导出失败: ${msg}`, error: msg });
    }
  }, [pipeline.entries, config.subtitle.bilingual, updatePipeline]);

  return {
    config,
    updateConfig,
    pipeline,
    ffmpegInfo,
    videoPath,
    setVideoPath,
    stageLabel: STAGE_LABELS[pipeline.stage],
    isProcessing: !['idle', 'done', 'error'].includes(pipeline.stage),
    startProcessing,
    cancelProcessing,
    runDetectFFmpeg,
    exportSRT,
  };
}
