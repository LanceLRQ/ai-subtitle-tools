import type { SubtitleEntry } from './types';

/**
 * 毫秒转 SRT 时间戳格式 HH:MM:SS,mmm
 */
export function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const milliseconds = Math.floor(ms % 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return (
    String(hours).padStart(2, '0') +
    ':' +
    String(minutes).padStart(2, '0') +
    ':' +
    String(seconds).padStart(2, '0') +
    ',' +
    String(milliseconds).padStart(3, '0')
  );
}

/**
 * 解析 SRT 时间戳为毫秒
 */
export function parseTimestamp(str: string): number {
  const match = str.trim().match(/^(\d{2}):(\d{2}):(\d{2})[,.](\d{3})$/);
  if (!match) {
    throw new Error(`Invalid timestamp format: ${str}`);
  }

  const [, hours, minutes, seconds, milliseconds] = match;
  return (
    parseInt(hours) * 3600000 +
    parseInt(minutes) * 60000 +
    parseInt(seconds) * 1000 +
    parseInt(milliseconds)
  );
}

/**
 * 生成 SRT 字幕内容
 */
export function generateSRT(entries: SubtitleEntry[], bilingual: boolean, translationEnabled: boolean = false): string {
  return entries
    .map((entry, i) => {
      const index = i + 1;
      const timeRange = `${formatTimestamp(entry.startTime)} --> ${formatTimestamp(entry.endTime)}`;

      let text = entry.originalText;
      if (bilingual && entry.translatedText) {
        text = `${entry.originalText}\n${entry.translatedText}`;
      } else if (translationEnabled && entry.translatedText) {
        text = entry.translatedText;
      }

      return `${index}\n${timeRange}\n${text}`;
    })
    .join('\n\n') + '\n';
}

/**
 * 解析 SRT 文件内容为字幕条目列表
 */
export function parseSRT(content: string): SubtitleEntry[] {
  const entries: SubtitleEntry[] = [];
  // 按空行分割字幕块
  const blocks = content.trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;

    // 第一行: 序号
    const index = parseInt(lines[0]);
    if (isNaN(index)) continue;

    // 第二行: 时间戳
    const timeMatch = lines[1].match(
      /(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/
    );
    if (!timeMatch) continue;

    const startTime = parseTimestamp(timeMatch[1]);
    const endTime = parseTimestamp(timeMatch[2]);

    // 第三行起: 字幕文本（可能多行）
    const textLines = lines.slice(2);
    const originalText = textLines[0] || '';
    const translatedText = textLines.length > 1 ? textLines.slice(1).join('\n') : '';

    entries.push({
      index,
      startTime,
      endTime,
      originalText,
      translatedText,
    });
  }

  return entries;
}
