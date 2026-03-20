/** 专有名词组 */
export interface GlossaryEntry {
  title: string;
  content: string;
}

/** ASR 服务提供方 */
export type AsrProvider = 'funasr' | 'lancelrq/qwen3-asr-service';

/** 应用配置 */
export interface AppConfig {
  language: 'zh' | 'en';
  ffmpeg: {
    path: string;
  };
  funasr: {
    provider: AsrProvider;
    url: string;
    apiKey: string;
    model: string;
  };
  llm: {
    baseUrl: string;
    apiKey: string;
    model: string;
  };
  translation: {
    enabled: boolean;
    batchSize: number;
    bilingual: boolean;
    targetLanguage: string;
    glossaries: GlossaryEntry[];
  };
  subtitle: {
    maxCharsPerLine: number;
  };
  debug: {
    enabled: boolean;
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

/** FunASR 逐字时间戳 */
export interface FunASRWordToken {
  text: string;
  start_time: number;
  end_time: number;
}

/** FunASR 响应中的分段 */
export interface FunASRSegment {
  id: number;
  text: string;
  start: number;
  end: number;
  speaker?: string;
  word_tokens?: FunASRWordToken[];
}

/** FunASR API 响应（verbose_json 格式） */
export interface FunASRResponse {
  text: string;
  segments: FunASRSegment[];
  duration: number;
}

/** 日志级别 */
export type LogLevel = 'info' | 'warn' | 'error';

/** 日志条目 */
export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  /** LLM 流式响应内容，实时更新 */
  streamContent?: string;
  /** 是否正在流式接收中 */
  streaming?: boolean;
}

/** FFmpeg 检测结果 */
export interface FFmpegDetectResult {
  path: string;
  version: string;
  source: 'config' | 'local' | 'system';
}

/** Qwen3 ASR 提交响应 */
export interface Qwen3SubmitResponse {
  task_id: string;
}

/** Qwen3 ASR 逐字时间戳 */
export interface Qwen3Word {
  text: string;
  start: number;
  end: number;
}

/** Qwen3 ASR 分段 */
export interface Qwen3Segment {
  text: string;
  start: number;
  end: number;
  words: Qwen3Word[];
}

/** Qwen3 ASR 识别结果 */
export interface Qwen3AsrResult {
  text: string;
  segments: Qwen3Segment[];
  duration: number;
}

/** Qwen3 ASR 轮询响应 */
export interface Qwen3PollResponse {
  task_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: Qwen3AsrResult;
  error?: string;
}

/** Qwen3 ASR 健康检查响应 */
export interface Qwen3HealthResponse {
  status: string;
  device: string;
  model_size: string;
  align_enabled: boolean;
  punc_enabled: boolean;
  asr_backend: string;
  vad_backend: string;
  punc_backend: string;
}
