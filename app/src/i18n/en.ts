import type { TranslationDict } from './types';

const en: TranslationDict = {
  // App
  'app.title': 'AI Video Subtitle Generator',
  'app.description': 'Video subtitle generation and translation tool',
  'app.startButton': 'Generate Subtitles',
  'app.cancelButton': 'Cancel',

  'app.saveAsButton': 'Save As...',
  'app.settingsTooltip': 'Settings',

  // Stage labels
  'stage.idle': 'Ready',
  'stage.detectingFfmpeg': 'Detecting FFmpeg...',
  'stage.extractingAudio': 'Extracting audio...',
  'stage.recognizing': 'Recognizing speech...',
  'stage.translating': 'Translating...',
  'stage.exporting': 'Exporting subtitles...',
  'stage.done': 'Done',
  'stage.error': 'Error',

  // Pipeline messages
  'pipeline.detectingFfmpeg': 'Detecting FFmpeg...',
  'pipeline.ffmpegReady': 'FFmpeg ready: {version}',
  'pipeline.ffmpegReadyWithSource': 'FFmpeg ready: {version} ({source})',
  'pipeline.ffmpegFailed': 'FFmpeg detection failed: {error}',
  'pipeline.extractingAudio': 'Extracting audio...',
  'pipeline.extractingLine': 'Extracting audio: {line}',
  'pipeline.audioExtracted': 'Audio extraction complete',
  'pipeline.recognizing': 'Starting speech recognition...',
  'pipeline.recognitionDone': 'Recognition complete, {count} subtitles generated',
  'pipeline.translating': 'Translating subtitles...',
  'pipeline.retranslating': 'Re-translating subtitles...',
  'pipeline.translationProgress': 'Translation progress: {completed}/{total}',
  'pipeline.translationBatch': 'Translation batch {current}/{total}...',
  'pipeline.translationDone': 'Translation complete',
  'pipeline.exporting': 'Exporting subtitles...',
  'pipeline.exported': 'Subtitles exported: {path}',
  'pipeline.processFailed': 'Processing failed: {error}',
  'pipeline.translationFailed': 'Translation failed: {error}',
  'pipeline.exportFailed': 'Export failed: {error}',
  'pipeline.selectVideoFirst': 'Please select a video file first',
  'pipeline.noVideoSelected': 'No video file selected',
  'pipeline.enableTranslationFirst': 'Please enable translation first',
  'pipeline.translationNotEnabled': 'Translation not enabled',
  'pipeline.cacheFound': 'ASR cache found for this video. Use cached results?',
  'pipeline.cacheUseButton': 'Use Cache',
  'pipeline.cacheRegenerateButton': 'Regenerate',
  'pipeline.usingCache': 'Using cached ASR results',
  'pipeline.cacheSaved': 'ASR results cached',
  'pipeline.cancelled': 'Cancelled',

  // Settings panel
  'settings.language.label': 'Language',
  'settings.ffmpeg.legend': 'FFmpeg',
  'settings.ffmpeg.pathPlaceholder': 'FFmpeg path (leave empty for auto-detection)',
  'settings.ffmpeg.detect': 'Detect',
  'settings.ffmpeg.sourceConfig': 'User config',
  'settings.ffmpeg.sourceLocal': 'Local directory',
  'settings.ffmpeg.sourceSystem': 'System PATH',
  'settings.funasr.legend': 'FunASR Speech Recognition',
  'settings.funasr.apiKeyPlaceholder': 'API Key (optional)',
  'settings.funasr.modelPlaceholder': 'Model',
  'settings.llm.legend': 'LLM Translation',
  'settings.llm.testConnection': 'Test Connection',
  'settings.llm.testing': 'Testing...',
  'settings.llm.success': 'Success',
  'settings.llm.thinkingTagFiltered': '(<think> tags auto-filtered)',
  'settings.llm.modelPlaceholder': 'Model',
  'settings.translation.legend': 'Translation Settings',
  'settings.translation.enabled': 'Enable translation',
  'settings.translation.bilingual': 'Bilingual subtitles',
  'settings.translation.targetLanguage': 'Target language',
  'settings.translation.targetPlaceholder': 'Type or select a language',
  'settings.translation.batchSize': 'Batch size',
  'settings.subtitle.legend': 'Subtitle Settings',
  'settings.subtitle.maxCharsPerLine': 'Max characters per line',
  'settings.subtitle.maxCharsHint': 'Long ASR text will be split by punctuation and merged into subtitle lines not exceeding this length',
  'settings.debug.legend': 'Debug',
  'settings.debug.enabled': 'Debug mode',
  'settings.debug.hint': 'When enabled, saves raw ASR JSON and LLM request logs to the video directory',

  // Storage
  'settings.storage.legend': 'Storage',
  'settings.storage.asrCache': 'ASR Recognition Cache',
  'settings.storage.tempFiles': 'Temporary Files',
  'settings.storage.configDir': 'Config Directory',
  'settings.storage.clear': 'Clear',
  'settings.storage.clearing': 'Clearing...',
  'settings.storage.openDir': 'Open Directory',
  'settings.storage.cleared': 'Cleared',
  'settings.storage.clearCacheConfirm': 'Clear all ASR recognition cache? Next recognition will re-request the ASR service.',
  'settings.storage.clearTempConfirm': 'Clear all temporary files?',

  // Settings modal
  'settingsModal.title': 'Settings',

  // File picker
  'filePicker.selectVideo': 'Select Video',
  'filePicker.supportedFormats': 'Supports {formats} formats',

  // Subtitle preview
  'subtitlePreview.empty': 'No subtitle data',
  'subtitlePreview.index': '#',
  'subtitlePreview.time': 'Time',
  'subtitlePreview.original': 'Original',
  'subtitlePreview.translated': 'Translated',
  'subtitlePreview.speaker': 'Speaker',

  // Log panel
  'logPanel.empty': 'No logs yet',

  // Glossary panel
  'glossary.title': 'Glossary',
  'glossary.placeholder': 'One entry per line:\nsource -> translation\n\ne.g.\nフリーレン -> Frieren',
  'glossary.hint': 'Terms will be included in LLM prompts during translation',
  'glossary.add': 'Add',
  'glossary.defaultTitle': 'Default',
  'glossary.untitled': 'Untitled {index}',
  'glossary.empty': 'Click "Add" to create a glossary group',
  'glossary.deleteConfirm': 'Delete "{title}"?',
  'glossary.rename': 'Rename',
  'glossary.delete': 'Delete',

  // Log tabs
  'logTabs.glossary': 'Glossary',
  'logTabs.log': 'Logs',
  'logTabs.preview': 'Preview',
  'logTabs.previewCount': 'Preview ({count})',

  // Theme toggle
  'theme.system': 'System',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
};

export default en;
