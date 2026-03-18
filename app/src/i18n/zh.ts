import type { TranslationDict } from './types';

const zh: TranslationDict = {
  // App
  'app.title': 'AI视频字幕生成工具',
  'app.description': '视频字幕生成与翻译工具',
  'app.startButton': '生成字幕',
  'app.cancelButton': '取消',

  'app.saveAsButton': '另存为...',
  'app.settingsTooltip': '设置',

  // Stage labels
  'stage.idle': '就绪',
  'stage.detectingFfmpeg': '检测 FFmpeg...',
  'stage.extractingAudio': '提取音频...',
  'stage.recognizing': '语音识别中...',
  'stage.translating': '翻译中...',
  'stage.exporting': '导出字幕...',
  'stage.done': '完成',
  'stage.error': '出错',

  // Pipeline messages
  'pipeline.detectingFfmpeg': '正在检测 FFmpeg...',
  'pipeline.ffmpegReady': 'FFmpeg 已就绪: {version}',
  'pipeline.ffmpegReadyWithSource': 'FFmpeg 已就绪: {version} ({source})',
  'pipeline.ffmpegFailed': 'FFmpeg 检测失败: {error}',
  'pipeline.extractingAudio': '正在提取音频...',
  'pipeline.extractingLine': '提取音频: {line}',
  'pipeline.audioExtracted': '音频提取完成',
  'pipeline.recognizing': '正在进行语音识别...',
  'pipeline.recognitionDone': '语音识别完成，共 {count} 条字幕',
  'pipeline.translating': '正在翻译字幕...',
  'pipeline.retranslating': '正在重新翻译字幕...',
  'pipeline.translationProgress': '翻译进度: {completed}/{total}',
  'pipeline.translationBatch': '翻译批次 {current}/{total}...',
  'pipeline.translationDone': '翻译完成',
  'pipeline.exporting': '正在导出字幕...',
  'pipeline.exported': '字幕已导出: {path}',
  'pipeline.processFailed': '处理失败: {error}',
  'pipeline.translationFailed': '翻译失败: {error}',
  'pipeline.exportFailed': '导出失败: {error}',
  'pipeline.selectVideoFirst': '请先选择视频文件',
  'pipeline.noVideoSelected': '未选择视频文件',
  'pipeline.enableTranslationFirst': '请先启用翻译功能',
  'pipeline.translationNotEnabled': '翻译未启用',
  'pipeline.cacheFound': '检测到该视频的语音识别缓存，是否使用缓存结果？',
  'pipeline.cacheUseButton': '使用缓存',
  'pipeline.cacheRegenerateButton': '重新生成',
  'pipeline.usingCache': '使用缓存的语音识别结果',
  'pipeline.cacheSaved': '语音识别结果已缓存',
  'pipeline.cancelled': '已取消',

  // Settings panel
  'settings.language.label': '界面语言',
  'settings.ffmpeg.legend': 'FFmpeg',
  'settings.ffmpeg.pathPlaceholder': 'FFmpeg 路径（留空自动检测）',
  'settings.ffmpeg.detect': '检测',
  'settings.ffmpeg.sourceConfig': '用户配置',
  'settings.ffmpeg.sourceLocal': '本地目录',
  'settings.ffmpeg.sourceSystem': '系统 PATH',
  'settings.funasr.legend': 'FunASR 语音识别',
  'settings.funasr.apiKeyPlaceholder': 'API Key（可选）',
  'settings.funasr.modelPlaceholder': '模型',
  'settings.llm.legend': 'LLM 翻译',
  'settings.llm.testConnection': '测试连接',
  'settings.llm.testing': '测试中...',
  'settings.llm.success': '成功',
  'settings.llm.thinkingTagFiltered': '(<think> 标签已自动过滤)',
  'settings.llm.modelPlaceholder': '模型',
  'settings.translation.legend': '翻译设置',
  'settings.translation.enabled': '启用翻译',
  'settings.translation.bilingual': '双语字幕',
  'settings.translation.targetLanguage': '目标语言',
  'settings.translation.targetPlaceholder': '输入或选择语言',
  'settings.translation.batchSize': '每批数量',
  'settings.subtitle.legend': '字幕设置',
  'settings.subtitle.maxCharsPerLine': '每行最大字符数',
  'settings.subtitle.maxCharsHint': 'ASR 长文本将按标点拆分并合并为不超过此长度的字幕行',
  'settings.debug.legend': '调试',
  'settings.debug.enabled': '调试模式',
  'settings.debug.hint': '开启后将 ASR 原始 JSON 和 LLM 请求日志保存到视频所在目录',

  // Settings modal
  'settingsModal.title': '设置',

  // File picker
  'filePicker.selectVideo': '选择视频文件',
  'filePicker.supportedFormats': '支持 {formats} 格式',

  // Subtitle preview
  'subtitlePreview.empty': '暂无字幕数据',
  'subtitlePreview.index': '#',
  'subtitlePreview.time': '时间',
  'subtitlePreview.original': '原文',
  'subtitlePreview.translated': '译文',
  'subtitlePreview.speaker': '说话人',

  // Log panel
  'logPanel.empty': '暂无日志',

  // Glossary panel
  'glossary.title': '专有名词',
  'glossary.placeholder': '每行一个词条，格式：\n原文 -> 译文\n\n例如：\nフリーレン -> 芙莉莲',
  'glossary.hint': '翻译时将提醒 LLM 使用指定译名',
  'glossary.add': '新增',
  'glossary.defaultTitle': '默认',
  'glossary.untitled': '未命名{index}',
  'glossary.empty': '点击「新增」添加专有名词组',
  'glossary.deleteConfirm': '确定删除「{title}」？',
  'glossary.rename': '重命名',
  'glossary.delete': '删除',

  // Log tabs
  'logTabs.glossary': '专有名词',
  'logTabs.log': '运行日志',
  'logTabs.preview': '字幕预览',
  'logTabs.previewCount': '字幕预览 ({count} 条)',

  // Theme toggle
  'theme.system': '跟随系统',
  'theme.light': '亮色模式',
  'theme.dark': '暗色模式',
};

export default zh;
