'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { AppConfig, PipelineState, PipelineStage, FFmpegDetectResult } from '@/lib/types';
import type { PipelineLogCallbacks } from '@/hooks/useLog';
import { loadConfig, saveConfig, getDefaultConfig } from '@/lib/config';
import { detectFFmpeg } from '@/lib/ffmpegDetector';
import { extractAudio, getTempAudioPath, cleanupTempFiles } from '@/lib/ffmpeg';
import { recognizeSpeech } from '@/lib/funasr';
import { splitSegments } from '@/lib/subtitleSplitter';
import { translateAll } from '@/lib/translator';
import { generateSRT } from '@/lib/subtitle';
import { writeAsrDebugLog, appendLlmDebugLog } from '@/lib/debugLog';
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

export function usePipeline(logCallbacks?: PipelineLogCallbacks) {
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
  const logRef = useRef(logCallbacks);
  logRef.current = logCallbacks;

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
    const log = logRef.current;

    // 清空旧日志
    log?.clearLogs();

    try {
      // 阶段 1: 检测 FFmpeg
      updatePipeline({ stage: 'detecting-ffmpeg', progress: 0, message: '正在检测 FFmpeg...', error: undefined });
      log?.addLog('info', '正在检测 FFmpeg...');
      const ffmpeg = ffmpegInfo || (await detectFFmpeg(config.ffmpeg.path || undefined));
      if (!ffmpeg) throw new Error('FFmpeg not available');
      setFFmpegInfo(ffmpeg);
      log?.addLog('info', `FFmpeg 已就绪: ${ffmpeg.version} (${ffmpeg.source})`);
      if (cancelledRef.current) return;

      // 阶段 2: 提取音频
      updatePipeline({ stage: 'extracting-audio', progress: 0, message: '正在提取音频...' });
      log?.addLog('info', '开始提取音频...');
      tempAudioPath = await getTempAudioPath(videoPath);
      await extractAudio(videoPath, tempAudioPath, ffmpeg.path, (payload) => {
        updatePipeline({ message: `提取音频: ${payload.line.slice(-80)}` });
      });
      log?.addLog('info', '音频提取完成');
      if (cancelledRef.current) return;

      // 阶段 3: 语音识别
      updatePipeline({ stage: 'recognizing', progress: 0, message: '正在进行语音识别...' });
      log?.addLog('info', '开始语音识别...');
      const asrResult = await recognizeSpeech(tempAudioPath, config.funasr);
      const entries = splitSegments(asrResult.segments, config.subtitle.maxCharsPerLine);
      updatePipeline({ entries, progress: 100 });
      log?.addLog('info', `语音识别完成，共 ${entries.length} 条字幕`);

      // 调试模式：保存 ASR 原始 JSON
      if (config.debug.enabled) {
        writeAsrDebugLog(videoPath, asrResult.rawResponse).catch(console.error);
      }
      if (cancelledRef.current) return;

      // 阶段 4: 翻译（仅在启用翻译时执行）
      let finalEntries = entries;
      if (config.translation.enabled) {
        updatePipeline({ stage: 'translating', progress: 0, message: '正在翻译字幕...' });
        log?.addLog('info', '开始翻译字幕...');
        const debugEnabled = config.debug.enabled;
        finalEntries = await translateAll(
          entries,
          config,
          (completed, total) => {
            const percent = Math.round((completed / total) * 100);
            updatePipeline({
              progress: percent,
              message: `翻译进度: ${completed}/${total}`,
            });
          },
          debugEnabled ? (info) => {
            appendLlmDebugLog(
              videoPath,
              info.batchIndex,
              { texts: info.texts, prompt: info.prompt },
              info.rawResponse,
              info.hadThinkingTags
            ).catch(console.error);
          } : undefined,
          // 流式回调
          (batchIndex, totalBatches) => {
            const streamId = `stream_batch_${batchIndex}_${Date.now()}`;
            log?.addStreamEntry(streamId, `翻译批次 ${batchIndex + 1}/${totalBatches}...`);
            return {
              onChunk: (chunk: string) => {
                log?.appendStream(streamId, chunk);
              },
              onDone: () => {
                log?.finalizeStream(streamId);
              },
            };
          }
        );
        updatePipeline({ entries: finalEntries, progress: 100 });
        log?.addLog('info', '翻译完成');
        if (cancelledRef.current) return;
      }

      // 阶段 5: 导出
      updatePipeline({ stage: 'exporting', progress: 0, message: '正在导出字幕...' });
      const isBilingual = config.translation.enabled && config.translation.bilingual;
      const srtContent = generateSRT(finalEntries, isBilingual);
      const srtPath = videoPath.replace(/\.[^.]+$/, '.srt');
      await invoke('save_file', { path: srtPath, content: srtContent });
      updatePipeline({ stage: 'done', progress: 100, message: `字幕已导出: ${srtPath}` });
      log?.addLog('info', `字幕已导出: ${srtPath}`);
    } catch (err) {
      if (!cancelledRef.current) {
        const msg = err instanceof Error ? err.message : String(err);
        updatePipeline({ stage: 'error', message: `处理失败: ${msg}`, error: msg });
        log?.addLog('error', msg);
      }
    } finally {
      // 清理临时文件
      cleanupTempFiles().catch(console.error);
    }
  }, [videoPath, config, ffmpegInfo, updatePipeline]);

  // 取消处理
  const cancelProcessing = useCallback(() => {
    cancelledRef.current = true;
    cleanupTempFiles().catch(console.error);
    updatePipeline({ stage: 'idle', progress: 0, message: '已取消' });
  }, [updatePipeline]);

  // 重新翻译（仅翻译阶段）
  const retranslate = useCallback(async () => {
    if (pipeline.entries.length === 0) return;
    if (!config.translation.enabled) {
      updatePipeline({ stage: 'error', message: '请先启用翻译功能', error: '翻译未启用' });
      return;
    }

    cancelledRef.current = false;
    const log = logRef.current;
    log?.clearLogs();

    try {
      updatePipeline({ stage: 'translating', progress: 0, message: '正在重新翻译字幕...', error: undefined });
      log?.addLog('info', '开始重新翻译字幕...');

      // 清除旧译文
      const cleanEntries = pipeline.entries.map((e) => ({ ...e, translatedText: '' }));
      const debugEnabled = config.debug.enabled;

      const finalEntries = await translateAll(
        cleanEntries,
        config,
        (completed, total) => {
          const percent = Math.round((completed / total) * 100);
          updatePipeline({ progress: percent, message: `翻译进度: ${completed}/${total}` });
        },
        debugEnabled ? (info) => {
          appendLlmDebugLog(
            videoPath,
            info.batchIndex,
            { texts: info.texts, prompt: info.prompt },
            info.rawResponse,
            info.hadThinkingTags
          ).catch(console.error);
        } : undefined,
        (batchIndex, totalBatches) => {
          const streamId = `stream_batch_${batchIndex}_${Date.now()}`;
          log?.addStreamEntry(streamId, `翻译批次 ${batchIndex + 1}/${totalBatches}...`);
          return {
            onChunk: (chunk: string) => { log?.appendStream(streamId, chunk); },
            onDone: () => { log?.finalizeStream(streamId); },
          };
        }
      );

      updatePipeline({ entries: finalEntries, progress: 100 });
      log?.addLog('info', '翻译完成');

      if (cancelledRef.current) return;

      // 自动导出
      updatePipeline({ stage: 'exporting', progress: 0, message: '正在导出字幕...' });
      const isBilingual = config.translation.bilingual;
      const srtContent = generateSRT(finalEntries, isBilingual);
      const srtPath = videoPath.replace(/\.[^.]+$/, '.srt');
      await invoke('save_file', { path: srtPath, content: srtContent });
      updatePipeline({ stage: 'done', progress: 100, message: `字幕已导出: ${srtPath}` });
      log?.addLog('info', `字幕已导出: ${srtPath}`);
    } catch (err) {
      if (!cancelledRef.current) {
        const msg = err instanceof Error ? err.message : String(err);
        updatePipeline({ stage: 'error', message: `翻译失败: ${msg}`, error: msg });
        log?.addLog('error', msg);
      }
    }
  }, [pipeline.entries, videoPath, config, updatePipeline]);

  // 导出到自定义路径
  const exportSRT = useCallback(async (path: string) => {
    try {
      const srtContent = generateSRT(pipeline.entries, config.translation.bilingual);
      await invoke('save_file', { path, content: srtContent });
      updatePipeline({ message: `字幕已导出: ${path}` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      updatePipeline({ stage: 'error', message: `导出失败: ${msg}`, error: msg });
    }
  }, [pipeline.entries, config.translation.bilingual, updatePipeline]);

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
    retranslate,
    runDetectFFmpeg,
    exportSRT,
  };
}
