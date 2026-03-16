/** 应用配置 */
export interface AppConfig {
  ffmpeg: {
    path: string;
  };
  funasr: {
    url: string;
    apiKey: string;
    model: string;
  };
  llm: {
    baseUrl: string;
    apiKey: string;
    model: string;
  };
  subtitle: {
    batchSize: number;
    bilingual: boolean;
    targetLanguage: string;
  };
}

/** 字幕条目 */
export interface SubtitleEntry {
  index: number;
  startTime: number;
  endTime: number;
  originalText: string;
  translatedText: string;
  speakerId?: string;
}

/** 流水线阶段 */
export type PipelineStage =
  | 'idle'
  | 'detecting-ffmpeg'
  | 'extracting-audio'
  | 'recognizing'
  | 'translating'
  | 'exporting'
  | 'done'
  | 'error';

/** 流水线状态 */
export interface PipelineState {
  stage: PipelineStage;
  progress: number;
  message: string;
  entries: SubtitleEntry[];
  error?: string;
}

/** FunASR 响应中的分段 */
export interface FunASRSegment {
  text: string;
  start_time: number;
  end_time: number;
  speaker_id?: string;
}

/** FunASR API 响应（verbose_json 格式） */
export interface FunASRResponse {
  text: string;
  segments: FunASRSegment[];
  duration: number;
}

/** FFmpeg 检测结果 */
export interface FFmpegDetectResult {
  path: string;
  version: string;
  source: 'config' | 'local' | 'system';
}
