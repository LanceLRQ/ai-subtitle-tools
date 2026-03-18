import type { FunASRSegment, FunASRWordToken, SubtitleEntry } from './types';

/** 标点拆分后的文本片段 */
interface TextFragment {
  text: string;
  sep: string;
  charCount: number;
}

/** 中英日韩常见标点 */
const PUNCTUATION_PATTERN = /([，。、？！,.?!;；:：…—·]+)/;

/** 标点及引号字符集 */
const PUNCT_QUOTES = /[，。、？！,.?!;；:：…—·"'"'「」『』【】（）()\s]/;
const LEADING_PUNCT = /^[，。、？！,.?!;；:：…—·"'"'「」『』【】（）()\s]+/;
const TRAILING_PERIOD = /[。.]+$/;
const TRAILING_ALL_PUNCT = /[，。、？！,.?!;；:：…—·"'"'「」『』【】（）()]+$/;
const SPLIT_PUNCT = /[，、？！,.?!;；:：…—·]+/;

/**
 * 清理字幕文本的标点符号
 *
 * 规则：
 * 1. 去掉开头的纯标点/引号
 * 2. 末尾句号（。.）始终去掉
 * 3. 只有单句内容时，去掉末尾所有标点
 * 4. 清理后无实际内容则返回 null（跳过该条字幕）
 */
function cleanPunctuation(text: string): string | null {
  // 去掉开头标点/引号
  let cleaned = text.replace(LEADING_PUNCT, '');

  // 检查是否还有实际内容
  if (!hasContent(cleaned)) return null;

  // 末尾句号始终去掉
  cleaned = cleaned.replace(TRAILING_PERIOD, '');

  // 判断是否为单句（按标点拆分后只有一段有效内容）
  const parts = cleaned.split(SPLIT_PUNCT);
  const contentParts = parts.filter((p) => p.replace(PUNCT_QUOTES, '').length > 0);
  if (contentParts.length <= 1) {
    cleaned = cleaned.replace(TRAILING_ALL_PUNCT, '');
  }

  return hasContent(cleaned) ? cleaned : null;
}

/** 检查文本是否包含非标点的实际内容 */
function hasContent(text: string): boolean {
  return text.split('').some((ch) => !PUNCT_QUOTES.test(ch));
}

/**
 * 按标点符号拆分文本为片段列表
 */
function splitByPunctuation(text: string): TextFragment[] {
  const parts = text.split(PUNCTUATION_PATTERN);
  const fragments: TextFragment[] = [];

  // split 产生交替的 [文本, 标点, 文本, 标点, ...]
  for (let i = 0; i < parts.length; i += 2) {
    const content = parts[i] || '';
    const sep = parts[i + 1] || '';
    if (content.length === 0 && sep.length === 0) continue;
    fragments.push({
      text: content,
      sep,
      charCount: content.length + sep.length,
    });
  }

  return fragments;
}

/**
 * 贪心合并片段为不超过 maxCharsPerLine 的行
 */
function mergeFragments(fragments: TextFragment[], maxCharsPerLine: number): string[] {
  if (fragments.length === 0) return [];

  const result: string[] = [];
  let buffer = '';

  for (const fragment of fragments) {
    const piece = fragment.text + fragment.sep;
    if (buffer.length === 0) {
      buffer = piece;
    } else if ((buffer + piece).length <= maxCharsPerLine) {
      buffer += piece;
    } else {
      result.push(buffer);
      buffer = piece;
    }
  }

  if (buffer.length > 0) {
    result.push(buffer);
  }

  return result;
}

/**
 * 根据 word_tokens 为合并后的每一行分配时间戳
 *
 * 构建字符位置→token 映射，找到每行对应的首尾 token
 */
function assignTimesWithTokens(
  lines: string[],
  wordTokens: FunASRWordToken[],
  segStart: number,
  segEnd: number,
): Array<{ startTime: number; endTime: number }> {
  // 构建字符位置 → token 索引映射
  // 将所有 token 文本拼接，记录每个字符归属哪个 token
  const charToToken: number[] = [];
  for (let ti = 0; ti < wordTokens.length; ti++) {
    const tokenText = wordTokens[ti].text;
    for (let ci = 0; ci < tokenText.length; ci++) {
      charToToken.push(ti);
    }
  }

  const results: Array<{ startTime: number; endTime: number }> = [];
  let charOffset = 0;

  for (const line of lines) {
    // 在 token 拼接文本中找到本行对应的字符范围
    const lineLen = line.length;
    const startCharIdx = Math.min(charOffset, charToToken.length - 1);
    const endCharIdx = Math.min(charOffset + lineLen - 1, charToToken.length - 1);

    if (startCharIdx >= 0 && startCharIdx < charToToken.length) {
      const firstTokenIdx = charToToken[Math.max(0, startCharIdx)];
      const lastTokenIdx = charToToken[Math.max(0, endCharIdx)];
      results.push({
        startTime: Math.round(wordTokens[firstTokenIdx].start_time * 1000),
        endTime: Math.round(wordTokens[lastTokenIdx].end_time * 1000),
      });
    } else {
      // fallback 到线性插值
      results.push({
        startTime: Math.round(segStart * 1000),
        endTime: Math.round(segEnd * 1000),
      });
    }

    charOffset += lineLen;
  }

  return results;
}

/**
 * 无 word_tokens 时使用线性插值分配时间
 */
function assignTimesLinear(
  lines: string[],
  segStart: number,
  segEnd: number,
): Array<{ startTime: number; endTime: number }> {
  const totalChars = lines.reduce((sum, l) => sum + l.length, 0);
  if (totalChars === 0) {
    return lines.map(() => ({
      startTime: Math.round(segStart * 1000),
      endTime: Math.round(segEnd * 1000),
    }));
  }

  const duration = segEnd - segStart;
  const results: Array<{ startTime: number; endTime: number }> = [];
  let charOffset = 0;

  for (const line of lines) {
    const lineStart = segStart + (charOffset / totalChars) * duration;
    const lineEnd = segStart + ((charOffset + line.length) / totalChars) * duration;
    results.push({
      startTime: Math.round(lineStart * 1000),
      endTime: Math.round(lineEnd * 1000),
    });
    charOffset += line.length;
  }

  return results;
}

/**
 * 将 ASR segments 按标点拆分并贪心合并为合理长度的字幕行
 *
 * @param segments ASR 返回的原始分段（含可选 word_tokens）
 * @param maxCharsPerLine 每行最大字符数，默认 30
 * @returns 拆分后的字幕条目列表
 */
export function splitSegments(
  segments: FunASRSegment[],
  maxCharsPerLine: number = 30,
): SubtitleEntry[] {
  const entries: SubtitleEntry[] = [];
  let entryIndex = 1;

  for (const segment of segments) {
    const text = segment.text.trim();
    if (text.length === 0) continue;

    // 如果文本已经足够短，直接作为一条字幕
    if (text.length <= maxCharsPerLine) {
      const cleaned = cleanPunctuation(text);
      if (cleaned) {
        entries.push({
          index: entryIndex++,
          startTime: Math.round(segment.start * 1000),
          endTime: Math.round(segment.end * 1000),
          originalText: cleaned,
          translatedText: '',
          speakerId: segment.speaker,
        });
      }
      continue;
    }

    // 标点拆分 + 贪心合并
    const fragments = splitByPunctuation(text);
    const lines = mergeFragments(fragments, maxCharsPerLine);

    // 如果拆分结果只有一行，直接使用
    if (lines.length <= 1) {
      const cleaned = cleanPunctuation(lines[0] || text);
      if (cleaned) {
        entries.push({
          index: entryIndex++,
          startTime: Math.round(segment.start * 1000),
          endTime: Math.round(segment.end * 1000),
          originalText: cleaned,
          translatedText: '',
          speakerId: segment.speaker,
        });
      }
      continue;
    }

    // 分配时间戳
    const times = segment.word_tokens && segment.word_tokens.length > 0
      ? assignTimesWithTokens(lines, segment.word_tokens, segment.start, segment.end)
      : assignTimesLinear(lines, segment.start, segment.end);

    for (let i = 0; i < lines.length; i++) {
      const cleaned = cleanPunctuation(lines[i]);
      if (!cleaned) continue;
      entries.push({
        index: entryIndex++,
        startTime: times[i].startTime,
        endTime: times[i].endTime,
        originalText: cleaned,
        translatedText: '',
        speakerId: segment.speaker,
      });
    }
  }

  return entries;
}
