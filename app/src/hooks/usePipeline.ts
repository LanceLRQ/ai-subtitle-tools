'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { AppConfig, PipelineState, PipelineStage, FFmpegDetectResult } from '@/lib/types';
import type { PipelineLogCallbacks } from '@/hooks/useLog';
import { loadConfig, saveConfig, getDefaultConfig } from '@/lib/config';
import { detectFFmpeg } from '@/lib/ffmpegDetector';
import { extractAudio, getTempAudioPath, cleanupTempFiles } from '@/lib/ffmpeg';
import { recognizeSpeech, parseAsrResponse } from '@/lib/funasr';
import { checkAsrCache, readAsrCache, writeAsrCache } from '@/lib/asrCache';
import { ask } from '@tauri-apps/plugin-dialog';
import { splitSegments } from '@/lib/subtitleSplitter';
import { translateAll } from '@/lib/translator';
import { generateSRT } from '@/lib/subtitle';
import { writeAsrDebugLog, appendLlmDebugLog } from '@/lib/debugLog';
import { invoke } from '@tauri-apps/api/core';
import { useI18n } from '@/i18n';

const STAGE_KEY_MAP: Record<PipelineStage, string> = {
  'idle': 'idle',
  'detecting-ffmpeg': 'detectingFfmpeg',
  'extracting-audio': 'extractingAudio',
  'recognizing': 'recognizing',
  'translating': 'translating',
  'exporting': 'exporting',
  'done': 'done',
  'error': 'error',
};

export function usePipeline(logCallbacks?: PipelineLogCallbacks) {
  const { t } = useI18n();
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
  const asrTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logRef = useRef(logCallbacks);
  logRef.current = logCallbacks;

  // Store t in a ref so callbacks always use the latest locale
  const tRef = useRef(t);
  tRef.current = t;

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
    const t = tRef.current;
    try {
      updatePipeline({ stage: 'detecting-ffmpeg', progress: 0, message: t('pipeline.detectingFfmpeg') });
      const result = await detectFFmpeg(config.ffmpeg.path || undefined);
      setFFmpegInfo(result);
      // 本地搜索到的 ffmpeg 自动保存路径到配置
      if (result.source === 'local' && result.path !== config.ffmpeg.path) {
        const newConfig = { ...config, ffmpeg: { ...config.ffmpeg, path: result.path } };
        setConfig(newConfig);
        saveConfig(newConfig).catch(console.error);
      }
      updatePipeline({ stage: 'idle', progress: 2.5, message: t('pipeline.ffmpegReady', { version: result.version }) });
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFFmpegInfo(null);
      updatePipeline({ stage: 'error', message: t('pipeline.ffmpegFailed', { error: msg }), error: msg });
      return null;
    }
  }, [config, updatePipeline]);

  // 开始处理流水线
  const startProcessing = useCallback(async () => {
    const t = tRef.current;
    if (!videoPath) {
      updatePipeline({ stage: 'error', message: t('pipeline.selectVideoFirst'), error: t('pipeline.noVideoSelected') });
      return;
    }

    cancelledRef.current = false;
    let tempAudioPath = '';
    const log = logRef.current;

    // 清空旧日志
    log?.clearLogs();

    try {
      // 阶段 1: 检测 FFmpeg
      updatePipeline({ stage: 'detecting-ffmpeg', progress: 0, message: t('pipeline.detectingFfmpeg'), error: undefined });
      log?.addLog('info', t('pipeline.detectingFfmpeg'));
      const ffmpeg = ffmpegInfo || (await detectFFmpeg(config.ffmpeg.path || undefined));
      if (!ffmpeg) throw new Error('FFmpeg not available');
      setFFmpegInfo(ffmpeg);
      updatePipeline({ progress: 2.5 });
      log?.addLog('info', t('pipeline.ffmpegReadyWithSource', { version: ffmpeg.version, source: ffmpeg.source }));
      if (cancelledRef.current) return;

      // 缓存检查：在提取音频之前检查是否有 ASR 缓存
      let useCachedAsr = false;
      let cachedAsrJson: string | null = null;
      try {
        const hasCache = await checkAsrCache(videoPath);
        if (hasCache) {
          const useCache = await ask(t('pipeline.cacheFound'), {
            kind: 'info',
            okLabel: t('pipeline.cacheUseButton'),
            cancelLabel: t('pipeline.cacheRegenerateButton'),
          });
          if (cancelledRef.current) return;
          if (useCache) {
            cachedAsrJson = await readAsrCache(videoPath);
            useCachedAsr = true;
          }
        }
      } catch {
        // 缓存检查失败不影响主流程
      }
      if (cancelledRef.current) return;

      let entries;
      if (useCachedAsr && cachedAsrJson) {
        // 使用缓存的 ASR 结果，跳过阶段 2 和阶段 3
        updatePipeline({ progress: 5, message: t('pipeline.usingCache') });
        log?.addLog('info', t('pipeline.usingCache'));
        const asrResult = parseAsrResponse(cachedAsrJson);
        entries = splitSegments(asrResult.segments, config.subtitle.maxCharsPerLine);
        updatePipeline({ entries, progress: 55 });
        log?.addLog('info', t('pipeline.recognitionDone', { count: entries.length }));
      } else {
        // 阶段 2: 提取音频
        updatePipeline({ stage: 'extracting-audio', progress: 2.5, message: t('pipeline.extractingAudio') });
        log?.addLog('info', t('pipeline.extractingAudio'));
        tempAudioPath = await getTempAudioPath(videoPath);
        await extractAudio(videoPath, tempAudioPath, ffmpeg.path, (payload) => {
          updatePipeline({ message: t('pipeline.extractingLine', { line: payload.line.slice(-80) }) });
        });
        updatePipeline({ progress: 5 });
        log?.addLog('info', t('pipeline.audioExtracted'));
        if (cancelledRef.current) return;

        // 阶段 3: 语音识别（双曲线假进度）
        updatePipeline({ stage: 'recognizing', progress: 5, message: t('pipeline.recognizing') });
        log?.addLog('info', t('pipeline.recognizing'));
        const asrStartTime = Date.now();
        const K = 30;
        asrTimerRef.current = setInterval(() => {
          const t = (Date.now() - asrStartTime) / 1000;
          const fakeProgress = Math.round(5 + 50 * t / (t + K));
          updatePipeline({ progress: fakeProgress });
        }, 1000);
        const asrResult = await recognizeSpeech(tempAudioPath, config.funasr);
        if (asrTimerRef.current) {
          clearInterval(asrTimerRef.current);
          asrTimerRef.current = null;
        }
        entries = splitSegments(asrResult.segments, config.subtitle.maxCharsPerLine);
        updatePipeline({ entries, progress: 55 });
        log?.addLog('info', t('pipeline.recognitionDone', { count: entries.length }));

        // 调试模式：保存 ASR 原始 JSON
        if (config.debug.enabled) {
          writeAsrDebugLog(videoPath, asrResult.rawResponse).catch(console.error);
        }

        // 缓存 ASR 结果（用原始 JSON 字符串）
        const asrJsonStr = JSON.stringify(asrResult.rawResponse);
        writeAsrCache(videoPath, asrJsonStr).then(() => {
          log?.addLog('info', t('pipeline.cacheSaved'));
        }).catch(console.error);
      }
      if (cancelledRef.current) return;

      // 阶段 4: 翻译（仅在启用翻译时执行）
      let finalEntries = entries;
      if (config.translation.enabled) {
        updatePipeline({ stage: 'translating', progress: 55, message: t('pipeline.translating') });
        log?.addLog('info', t('pipeline.translating'));
        const debugEnabled = config.debug.enabled;
        finalEntries = await translateAll(
          entries,
          config,
          (completed, total) => {
            const percent = Math.round(55 + 40 * (completed / total));
            updatePipeline({
              progress: percent,
              message: tRef.current('pipeline.translationProgress', { completed, total }),
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
            log?.addStreamEntry(streamId, tRef.current('pipeline.translationBatch', { current: batchIndex + 1, total: totalBatches }));
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
        updatePipeline({ entries: finalEntries, progress: 95 });
        log?.addLog('info', t('pipeline.translationDone'));
        if (cancelledRef.current) return;
      }

      // 阶段 5: 导出
      updatePipeline({ stage: 'exporting', progress: 95, message: t('pipeline.exporting') });
      const isBilingual = config.translation.enabled && config.translation.bilingual;
      const srtContent = generateSRT(finalEntries, isBilingual, config.translation.enabled);
      const srtPath = videoPath.replace(/\.[^.]+$/, '.srt');
      await invoke('save_file', { path: srtPath, content: srtContent });
      updatePipeline({ stage: 'done', progress: 100, message: t('pipeline.exported', { path: srtPath }) });
      log?.addLog('info', t('pipeline.exported', { path: srtPath }));
    } catch (err) {
      if (!cancelledRef.current) {
        const msg = err instanceof Error ? err.message : String(err);
        updatePipeline({ stage: 'error', message: t('pipeline.processFailed', { error: msg }), error: msg });
        log?.addLog('error', msg);
      }
    } finally {
      // 清理 ASR 假进度定时器
      if (asrTimerRef.current) {
        clearInterval(asrTimerRef.current);
        asrTimerRef.current = null;
      }
      // 清理临时文件
      cleanupTempFiles().catch(console.error);
    }
  }, [videoPath, config, ffmpegInfo, updatePipeline]);

  // 取消处理
  const cancelProcessing = useCallback(() => {
    cancelledRef.current = true;
    if (asrTimerRef.current) {
      clearInterval(asrTimerRef.current);
      asrTimerRef.current = null;
    }
    cleanupTempFiles().catch(console.error);
    updatePipeline({ stage: 'idle', progress: 0, message: tRef.current('pipeline.cancelled') });
  }, [updatePipeline]);

  // 重新翻译（仅翻译阶段）
  const retranslate = useCallback(async () => {
    const t = tRef.current;
    if (pipeline.entries.length === 0) return;
    if (!config.translation.enabled) {
      updatePipeline({ stage: 'error', message: t('pipeline.enableTranslationFirst'), error: t('pipeline.translationNotEnabled') });
      return;
    }

    cancelledRef.current = false;
    const log = logRef.current;
    log?.clearLogs();

    try {
      updatePipeline({ stage: 'translating', progress: 0, message: t('pipeline.retranslating'), error: undefined });
      log?.addLog('info', t('pipeline.retranslating'));

      // 清除旧译文
      const cleanEntries = pipeline.entries.map((e) => ({ ...e, translatedText: '' }));
      const debugEnabled = config.debug.enabled;

      const finalEntries = await translateAll(
        cleanEntries,
        config,
        (completed, total) => {
          const percent = Math.round(95 * (completed / total));
          updatePipeline({ progress: percent, message: tRef.current('pipeline.translationProgress', { completed, total }) });
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
          log?.addStreamEntry(streamId, tRef.current('pipeline.translationBatch', { current: batchIndex + 1, total: totalBatches }));
          return {
            onChunk: (chunk: string) => { log?.appendStream(streamId, chunk); },
            onDone: () => { log?.finalizeStream(streamId); },
          };
        }
      );

      updatePipeline({ entries: finalEntries, progress: 95 });
      log?.addLog('info', t('pipeline.translationDone'));

      if (cancelledRef.current) return;

      // 自动导出
      updatePipeline({ stage: 'exporting', progress: 95, message: t('pipeline.exporting') });
      const isBilingual = config.translation.bilingual;
      const srtContent = generateSRT(finalEntries, isBilingual, config.translation.enabled);
      const srtPath = videoPath.replace(/\.[^.]+$/, '.srt');
      await invoke('save_file', { path: srtPath, content: srtContent });
      updatePipeline({ stage: 'done', progress: 100, message: t('pipeline.exported', { path: srtPath }) });
      log?.addLog('info', t('pipeline.exported', { path: srtPath }));
    } catch (err) {
      if (!cancelledRef.current) {
        const msg = err instanceof Error ? err.message : String(err);
        updatePipeline({ stage: 'error', message: t('pipeline.translationFailed', { error: msg }), error: msg });
        log?.addLog('error', msg);
      }
    }
  }, [pipeline.entries, videoPath, config, updatePipeline]);

  // 导出到自定义路径
  const exportSRT = useCallback(async (path: string) => {
    const t = tRef.current;
    try {
      const srtContent = generateSRT(pipeline.entries, config.translation.bilingual, config.translation.enabled);
      await invoke('save_file', { path, content: srtContent });
      updatePipeline({ message: t('pipeline.exported', { path }) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      updatePipeline({ stage: 'error', message: t('pipeline.exportFailed', { error: msg }), error: msg });
    }
  }, [pipeline.entries, config.translation.bilingual, config.translation.enabled, updatePipeline]);

  const stageKey = STAGE_KEY_MAP[pipeline.stage];
  const stageLabel = t(`stage.${stageKey}` as keyof import('@/i18n/types').TranslationDict);

  return {
    config,
    updateConfig,
    pipeline,
    ffmpegInfo,
    videoPath,
    setVideoPath,
    stageLabel,
    isProcessing: !['idle', 'done', 'error'].includes(pipeline.stage),
    startProcessing,
    cancelProcessing,
    retranslate,
    runDetectFFmpeg,
    exportSRT,
  };
}
