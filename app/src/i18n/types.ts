export type Locale = 'zh' | 'en';

export interface TranslationDict {
  // App
  'app.title': string;
  'app.description': string;
  'app.startButton': string;
  'app.cancelButton': string;

  'app.saveAsButton': string;
  'app.settingsTooltip': string;

  // Stage labels
  'stage.idle': string;
  'stage.detectingFfmpeg': string;
  'stage.extractingAudio': string;
  'stage.recognizing': string;
  'stage.translating': string;
  'stage.exporting': string;
  'stage.done': string;
  'stage.error': string;

  // Pipeline messages
  'pipeline.detectingFfmpeg': string;
  'pipeline.ffmpegReady': string;
  'pipeline.ffmpegReadyWithSource': string;
  'pipeline.ffmpegFailed': string;
  'pipeline.extractingAudio': string;
  'pipeline.extractingLine': string;
  'pipeline.audioExtracted': string;
  'pipeline.recognizing': string;
  'pipeline.recognitionDone': string;
  'pipeline.translating': string;
  'pipeline.retranslating': string;
  'pipeline.translationProgress': string;
  'pipeline.translationBatch': string;
  'pipeline.translationDone': string;
  'pipeline.exporting': string;
  'pipeline.exported': string;
  'pipeline.processFailed': string;
  'pipeline.translationFailed': string;
  'pipeline.exportFailed': string;
  'pipeline.selectVideoFirst': string;
  'pipeline.noVideoSelected': string;
  'pipeline.enableTranslationFirst': string;
  'pipeline.translationNotEnabled': string;
  'pipeline.cacheFound': string;
  'pipeline.cacheUseButton': string;
  'pipeline.cacheRegenerateButton': string;
  'pipeline.usingCache': string;
  'pipeline.cacheSaved': string;
  'pipeline.cancelled': string;

  // Settings panel
  'settings.language.label': string;
  'settings.ffmpeg.legend': string;
  'settings.ffmpeg.pathPlaceholder': string;
  'settings.ffmpeg.detect': string;
  'settings.ffmpeg.sourceConfig': string;
  'settings.ffmpeg.sourceLocal': string;
  'settings.ffmpeg.sourceSystem': string;
  'settings.funasr.legend': string;
  'settings.funasr.apiKeyPlaceholder': string;
  'settings.funasr.modelPlaceholder': string;
  'settings.llm.legend': string;
  'settings.llm.testConnection': string;
  'settings.llm.testing': string;
  'settings.llm.success': string;
  'settings.llm.thinkingTagFiltered': string;
  'settings.llm.modelPlaceholder': string;
  'settings.translation.legend': string;
  'settings.translation.enabled': string;
  'settings.translation.bilingual': string;
  'settings.translation.targetLanguage': string;
  'settings.translation.targetPlaceholder': string;
  'settings.translation.batchSize': string;
  'settings.subtitle.legend': string;
  'settings.subtitle.maxCharsPerLine': string;
  'settings.subtitle.maxCharsHint': string;
  'settings.debug.legend': string;
  'settings.debug.enabled': string;
  'settings.debug.hint': string;

  // Storage
  'settings.storage.legend': string;
  'settings.storage.asrCache': string;
  'settings.storage.tempFiles': string;
  'settings.storage.configDir': string;
  'settings.storage.clear': string;
  'settings.storage.clearing': string;
  'settings.storage.openDir': string;
  'settings.storage.cleared': string;
  'settings.storage.clearCacheConfirm': string;
  'settings.storage.clearTempConfirm': string;
  'settings.storage.viewCache': string;
  'settings.storage.cacheList': string;
  'settings.storage.cacheEmpty': string;
  'settings.storage.cacheVideoPath': string;
  'settings.storage.cacheDataSize': string;
  'settings.storage.cacheDeleteConfirm': string;

  // Settings modal
  'settingsModal.title': string;

  // File picker
  'filePicker.selectVideo': string;
  'filePicker.supportedFormats': string;

  // Subtitle preview
  'subtitlePreview.empty': string;
  'subtitlePreview.index': string;
  'subtitlePreview.time': string;
  'subtitlePreview.original': string;
  'subtitlePreview.translated': string;
  'subtitlePreview.speaker': string;

  // Log panel
  'logPanel.empty': string;

  // Glossary panel
  'glossary.title': string;
  'glossary.placeholder': string;
  'glossary.hint': string;
  'glossary.add': string;
  'glossary.defaultTitle': string;
  'glossary.untitled': string;
  'glossary.empty': string;
  'glossary.deleteConfirm': string;
  'glossary.rename': string;
  'glossary.delete': string;

  // Log tabs
  'logTabs.glossary': string;
  'logTabs.log': string;
  'logTabs.preview': string;
  'logTabs.previewCount': string;

  // Theme toggle
  'theme.system': string;
  'theme.light': string;
  'theme.dark': string;
}
