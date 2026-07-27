/** 书籍导入解析：TXT / Markdown / JSON */

export interface ParsedChapter {
  key: string;
  title: string;
  content: string;
  /** JSON 导入若含 Slate 节点则保留原结构 */
  slateContent?: any[];
}

export interface ParsedVolume {
  key: string;
  title: string;
  chapters: ParsedChapter[];
}

export interface ParsedBook {
  title: string;
  description: string;
  category?: string;
  tags?: string[];
  cover?: string;
  volumes: ParsedVolume[];
  stats: {
    volumeCount: number;
    chapterCount: number;
    usedChapterSplit: boolean;
    format: ImportFileFormat;
  };
}

export type ImportFileFormat = 'txt' | 'md' | 'json';

const VOLUME_RE =
  /^(?:第\s*[0-9０-９一二三四五六七八九十百千万零]+\s*卷|卷\s*[0-9０-９一二三四五六七八九十百千万零]+|Volume\s+\d+)(?:[\s:：\-—]*(.+))?$/i;

const CHAPTER_RE =
  /^(?:第\s*[0-9０-９一二三四五六七八九十百千万零]+\s*[章节回节]|Chapter\s+\d+|第\s*[0-9０-９]+\s*[章节回节])(?:[\s:：\-—]*(.+))?$/i;

const BOOK_TITLE_RE = /^(?:书名|作品名|书籍名称)[：:]\s*(.+)$/;
const DESC_START_RE = /^(?:简介|内容简介|作品简介|书籍简介)[：:]?\s*(.*)$/;

const MD_HEADING_RE = /^(#{1,3})\s+(.+)$/;

let idCounter = 0;
const nextKey = (prefix: string) => `${prefix}-${++idCounter}`;

const resetKeys = () => {
  idCounter = 0;
};

const normalizeText = (text: string) =>
  text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/^\uFEFF/, '');

const trimLine = (line: string) => line.trim();

const isVolumeTitle = (title: string) => VOLUME_RE.test(title) || /^卷[\s:：]/i.test(title);

const isChapterTitle = (title: string) => CHAPTER_RE.test(title) || /^Chapter\s+\d+/i.test(title);

const fileBaseName = (fileName?: string) =>
  fileName?.replace(/\.(txt|md|markdown|json)$/i, '').trim() || '';

const buildStats = (
  volumes: ParsedVolume[],
  usedChapterSplit: boolean,
  format: ImportFileFormat
): ParsedBook['stats'] => ({
  volumeCount: volumes.length,
  chapterCount: volumes.reduce((n, v) => n + v.chapters.length, 0),
  usedChapterSplit,
  format,
});

const flushChapter = (
  volumes: ParsedVolume[],
  currentVolume: ParsedVolume | null,
  chapterTitle: string,
  contentLines: string[],
  slateContent?: any[]
) => {
  const body = contentLines.join('\n').trim();
  if (!body && !chapterTitle && !slateContent?.length) return currentVolume;

  let vol = currentVolume;
  if (!vol) {
    vol = { key: nextKey('v'), title: '正文', chapters: [] };
    volumes.push(vol);
  }

  vol.chapters.push({
    key: nextKey('c'),
    title: chapterTitle || `第${vol.chapters.length + 1}章`,
    content: body,
    ...(slateContent?.length ? { slateContent } : {}),
  });
  return vol;
};

const finalizeBook = (
  partial: Omit<ParsedBook, 'stats'>,
  usedChapterSplit: boolean,
  format: ImportFileFormat,
  fileName?: string
): ParsedBook => {
  const chapterCount = partial.volumes.reduce((n, v) => n + v.chapters.length, 0);
  return {
    ...partial,
    title:
      partial.title ||
      fileBaseName(fileName) ||
      partial.volumes[0]?.chapters[0]?.title?.slice(0, 30) ||
      '未命名书籍',
    stats: buildStats(partial.volumes, usedChapterSplit, format),
  };
};

/* ── TXT ── */

const isMarkerLine = (line: string) => VOLUME_RE.test(line) || CHAPTER_RE.test(line);

const extractTxtMetadata = (lines: string[]) => {
  let title = '';
  let description = '';
  let startIndex = 0;
  let inDescription = false;
  const descLines: string[] = [];

  for (let i = 0; i < Math.min(lines.length, 80); i++) {
    const line = trimLine(lines[i]);
    if (!line) {
      if (inDescription && descLines.length > 0) {
        startIndex = i + 1;
        break;
      }
      continue;
    }

    if (isMarkerLine(line)) {
      startIndex = i;
      break;
    }

    const titleMatch = line.match(BOOK_TITLE_RE);
    if (titleMatch) {
      title = titleMatch[1].trim();
      startIndex = i + 1;
      continue;
    }

    const descMatch = line.match(DESC_START_RE);
    if (descMatch) {
      inDescription = true;
      if (descMatch[1]?.trim()) descLines.push(descMatch[1].trim());
      startIndex = i + 1;
      continue;
    }

    if (inDescription) {
      descLines.push(line);
      startIndex = i + 1;
      continue;
    }

    if (!description && !title && i < 30) {
      descLines.push(line);
      startIndex = i + 1;
      continue;
    }

    startIndex = i;
    break;
  }

  description = descLines.join('\n').trim().slice(0, 800);
  return { title, description, startIndex };
};

export const parseTxtBook = (rawText: string, fileName?: string): ParsedBook => {
  resetKeys();
  const text = normalizeText(rawText);
  const lines = text.split('\n');

  const { title: metaTitle, description, startIndex } = extractTxtMetadata(lines);

  const volumes: ParsedVolume[] = [];
  let currentVolume: ParsedVolume | null = null;
  let currentChapterTitle = '';
  let contentLines: string[] = [];
  let usedChapterSplit = false;

  for (const rawLine of lines.slice(startIndex)) {
    const line = trimLine(rawLine);

    if (VOLUME_RE.test(line)) {
      if (currentChapterTitle || contentLines.length > 0) {
        currentVolume = flushChapter(volumes, currentVolume, currentChapterTitle, contentLines);
        contentLines = [];
        currentChapterTitle = '';
      }
      currentVolume = { key: nextKey('v'), title: line.trim(), chapters: [] };
      volumes.push(currentVolume);
      usedChapterSplit = true;
      continue;
    }

    if (CHAPTER_RE.test(line)) {
      usedChapterSplit = true;
      if (currentChapterTitle || contentLines.length > 0) {
        currentVolume = flushChapter(volumes, currentVolume, currentChapterTitle, contentLines);
        contentLines = [];
      }
      currentChapterTitle = line.trim();
      continue;
    }

    contentLines.push(rawLine);
  }

  if (currentChapterTitle || contentLines.some((l) => l.trim())) {
    currentVolume = flushChapter(volumes, currentVolume, currentChapterTitle, contentLines);
  }

  if (volumes.length === 0) {
    const allContent = lines.slice(startIndex).join('\n').trim() || text.trim();
    volumes.push({
      key: nextKey('v'),
      title: '正文',
      chapters: [{ key: nextKey('c'), title: '全文', content: allContent }],
    });
  }

  return finalizeBook(
    { title: metaTitle, description, volumes },
    usedChapterSplit,
    'txt',
    fileName
  );
};

/* ── Markdown ── */

const parseSimpleFrontmatter = (text: string) => {
  if (!text.startsWith('---')) return { meta: {} as Record<string, string>, body: text };

  const end = text.indexOf('\n---', 3);
  if (end === -1) return { meta: {} as Record<string, string>, body: text };

  const fmBlock = text.slice(3, end).trim();
  const body = text.slice(end + 4).replace(/^\n/, '');
  const meta: Record<string, string> = {};

  for (const line of fmBlock.split('\n')) {
    const m = line.match(/^([\w-]+):\s*(.+)$/);
    if (m) meta[m[1].toLowerCase()] = m[2].trim().replace(/^["']|["']$/g, '');
  }

  return { meta, body };
};

const parseTagsValue = (raw?: string): string[] | undefined => {
  if (!raw) return undefined;
  if (raw.startsWith('[')) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.map(String);
    } catch {
      /* fall through */
    }
  }
  return raw.split(/[,，]/).map((t) => t.trim()).filter(Boolean);
};

export const parseMarkdownBook = (rawText: string, fileName?: string): ParsedBook => {
  resetKeys();
  const text = normalizeText(rawText);
  const { meta, body } = parseSimpleFrontmatter(text);
  const lines = body.split('\n');

  let bookTitle = meta.title || meta.name || '';
  let description = meta.description || meta.desc || meta.summary || '';
  const category = meta.category;
  const tags = parseTagsValue(meta.tags);
  const cover = meta.cover;

  const volumes: ParsedVolume[] = [];
  let currentVolume: ParsedVolume | null = null;
  let currentChapterTitle = '';
  let contentLines: string[] = [];
  let usedChapterSplit = false;
  let gotBookTitle = !!bookTitle;
  const introLines: string[] = [];
  let passedIntro = gotBookTitle;

  for (const rawLine of lines) {
    const heading = rawLine.match(MD_HEADING_RE);
    if (heading) {
      const level = heading[1].length;
      const headingText = heading[2].trim();

      if (!gotBookTitle && level === 1 && !isVolumeTitle(headingText) && !isChapterTitle(headingText)) {
        if (introLines.length > 0 && !description) {
          description = introLines.join('\n').trim().slice(0, 800);
        }
        bookTitle = headingText;
        gotBookTitle = true;
        passedIntro = true;
        continue;
      }

      if (currentChapterTitle || contentLines.length > 0) {
        currentVolume = flushChapter(volumes, currentVolume, currentChapterTitle, contentLines);
        contentLines = [];
        currentChapterTitle = '';
      }

      usedChapterSplit = true;
      passedIntro = true;

      const isVol = isVolumeTitle(headingText) || (level <= 2 && /卷/.test(headingText) && !isChapterTitle(headingText));
      const isChap = isChapterTitle(headingText) || level >= 2;

      if (isVol && (level === 1 || level === 2)) {
        currentVolume = { key: nextKey('v'), title: headingText, chapters: [] };
        volumes.push(currentVolume);
        continue;
      }

      if (isChap || level >= 2) {
        currentChapterTitle = headingText;
        continue;
      }

      if (level === 1) {
        currentChapterTitle = headingText;
        continue;
      }
    }

    if (!passedIntro && !description) {
      if (rawLine.trim()) introLines.push(rawLine.trim());
      continue;
    }

    contentLines.push(rawLine);
  }

  if (!description && introLines.length > 0) {
    description = introLines.join('\n').trim().slice(0, 800);
  }

  if (currentChapterTitle || contentLines.some((l) => l.trim())) {
    currentVolume = flushChapter(volumes, currentVolume, currentChapterTitle, contentLines);
  }

  if (volumes.length === 0) {
    volumes.push({
      key: nextKey('v'),
      title: '正文',
      chapters: [{ key: nextKey('c'), title: '全文', content: body.trim() }],
    });
  }

  return finalizeBook(
    { title: bookTitle, description, category, tags, cover, volumes },
    usedChapterSplit,
    'md',
    fileName
  );
};

/* ── JSON ── */

const isSlateNodeArray = (val: unknown): val is any[] =>
  Array.isArray(val) &&
  val.length > 0 &&
  val.every((n) => n && typeof n === 'object' && ('type' in n || 'text' in n));

const slateToPlainText = (nodes: any[]): string =>
  nodes
    .map((node) => {
      if (node.text !== undefined) return String(node.text);
      if (Array.isArray(node.children)) return slateToPlainText(node.children);
      return '';
    })
    .join('')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');

const normalizeChapterContent = (
  content: unknown
): { text: string; slate?: any[] } => {
  if (typeof content === 'string') return { text: content };
  if (isSlateNodeArray(content)) {
    return { text: slateToPlainText(content), slate: content };
  }
  if (content == null) return { text: '' };
  return { text: String(content) };
};

const normalizeJsonTags = (tags: unknown): string[] | undefined => {
  if (!tags) return undefined;
  if (Array.isArray(tags)) return tags.map(String).filter(Boolean);
  if (typeof tags === 'string') return parseTagsValue(tags);
  return undefined;
};

const mapJsonChapters = (chapters: unknown[]): ParsedChapter[] =>
  chapters.map((ch: any, i) => {
    const { text, slate } = normalizeChapterContent(ch.content ?? ch.body ?? ch.text ?? '');
    return {
      key: nextKey('c'),
      title: String(ch.title || ch.name || `第${i + 1}章`).trim(),
      content: text,
      ...(slate?.length ? { slateContent: slate } : {}),
    };
  });

export const parseJsonBook = (rawText: string, fileName?: string): ParsedBook => {
  resetKeys();

  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error('JSON 格式无效，请检查文件内容');
  }

  if (Array.isArray(data)) {
    if (data.length === 0) throw new Error('JSON 数组为空');
    data = data[0];
  }

  if (!data || typeof data !== 'object') {
    throw new Error('JSON 结构无效');
  }

  const title = String(data.title || data.name || data.bookTitle || '').trim();
  const description = String(data.description || data.desc || data.summary || '').trim();
  const category = data.category ? String(data.category) : undefined;
  const tags = normalizeJsonTags(data.tags);
  const cover = data.cover ? String(data.cover) : undefined;

  const volumes: ParsedVolume[] = [];

  if (Array.isArray(data.volumes) && data.volumes.length > 0) {
    for (const vol of data.volumes) {
      const chapters = Array.isArray(vol.chapters) ? mapJsonChapters(vol.chapters) : [];
      if (chapters.length === 0) continue;
      volumes.push({
        key: nextKey('v'),
        title: String(vol.title || vol.name || '正文').trim(),
        chapters,
      });
    }
  } else if (Array.isArray(data.chapters) && data.chapters.length > 0) {
    volumes.push({
      key: nextKey('v'),
      title: String(data.volumeTitle || '正文').trim(),
      chapters: mapJsonChapters(data.chapters),
    });
  } else if (data.content !== undefined) {
    const { text, slate } = normalizeChapterContent(data.content);
    volumes.push({
      key: nextKey('v'),
      title: '正文',
      chapters: [
        {
          key: nextKey('c'),
          title: '全文',
          content: text,
          ...(slate?.length ? { slateContent: slate } : {}),
        },
      ],
    });
  }

  if (volumes.length === 0) {
    throw new Error('JSON 中未找到 volumes、chapters 或 content 字段');
  }

  return finalizeBook(
    { title, description, category, tags, cover, volumes },
    true,
    'json',
    fileName
  );
};

/* ── 统一入口 ── */

export const detectImportFormat = (fileName: string): ImportFileFormat | null => {
  if (/\.txt$/i.test(fileName)) return 'txt';
  if (/\.(?:md|markdown)$/i.test(fileName)) return 'md';
  if (/\.json$/i.test(fileName)) return 'json';
  return null;
};

export const parseBookFile = (rawText: string, fileName: string): ParsedBook => {
  const format = detectImportFormat(fileName);
  if (!format) throw new Error('不支持的文件格式，请选择 .txt / .md / .json');

  switch (format) {
    case 'txt':
      return parseTxtBook(rawText, fileName);
    case 'md':
      return parseMarkdownBook(rawText, fileName);
    case 'json':
      return parseJsonBook(rawText, fileName);
    default:
      throw new Error('不支持的文件格式');
  }
};

export const formatImportLabel = (format: ImportFileFormat) => {
  switch (format) {
    case 'txt':
      return 'TXT';
    case 'md':
      return 'Markdown';
    case 'json':
      return 'JSON';
  }
};

/** 纯文本段落 → Slate 段落节点 */
export const textToSlateContent = (text: string) => {
  const paragraphs = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return [{ type: 'paragraph', children: [{ text: '' }] }];
  }

  return paragraphs.map((line) => ({
    type: 'paragraph',
    children: [{ text: line }],
  }));
};

/** 章节内容：优先使用 JSON 中的 Slate 结构 */
export const chapterToSlateContent = (chapter: ParsedChapter) =>
  chapter.slateContent?.length ? chapter.slateContent : textToSlateContent(chapter.content);
