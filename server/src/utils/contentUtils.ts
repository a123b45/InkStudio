/** Count words/chars in Slate content */
export function countWordsInContent(content: any[]): number {
  const text = (content || [])
    .map((node) => (node.children || []).map((c: any) => c.text || '').join(''))
    .join('');
  const chineseChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const englishWords = text.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, ' ').split(/\s+/).filter(Boolean).length;
  return chineseChars + englishWords;
}

/** Extract plain text snippet around a match */
export function extractSnippet(text: string, query: string, radius = 40): string {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return text.slice(0, radius * 2);
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + query.length + radius);
  let snippet = text.slice(start, end);
  if (start > 0) snippet = '…' + snippet;
  if (end < text.length) snippet = snippet + '…';
  return snippet;
}

export function slateToPlainText(content: any[]): string {
  return (content || [])
    .map((node) => {
      if (node.type === 'divider') return '---';
      return (node.children || []).map((c: any) => c.text || '').join('');
    })
    .join('\n\n');
}
