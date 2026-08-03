/** Slate content → plain text */
export function slateToText(content: any[]): string {
  return (content || [])
    .map((node) => {
      if (node.type === 'divider') return '---';
      return (node.children || []).map((c: any) => c.text || '').join('');
    })
    .join('\n\n');
}

/** Slate content → Markdown */
export function slateToMarkdown(content: any[]): string {
  return (content || [])
    .map((node) => {
      const text = (node.children || []).map((c: any) => {
        let t = c.text || '';
        if (c.bold) t = `**${t}**`;
        if (c.italic) t = `*${t}*`;
        if (c.underline) t = `<u>${t}</u>`;
        return t;
      }).join('');

      switch (node.type) {
        case 'heading-one': return `# ${text}`;
        case 'heading-two': return `## ${text}`;
        case 'block-quote': return `> ${text}`;
        case 'divider': return '---';
        case 'list-item': return `- ${text}`;
        default: return text;
      }
    })
    .join('\n\n');
}

export function countWords(text: string): number {
  const chinese = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const english = text.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, ' ').split(/\s+/).filter(Boolean).length;
  return chinese + english;
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadText(filename: string, text: string) {
  downloadBlob(filename.endsWith('.txt') ? filename : `${filename}.txt`, new Blob([text], { type: 'text/plain;charset=utf-8' }));
}

export function downloadMarkdown(filename: string, content: any[]) {
  downloadBlob(`${filename}.md`, new Blob([slateToMarkdown(content)], { type: 'text/markdown;charset=utf-8' }));
}

export async function downloadDocx(filename: string, title: string, content: any[]) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');

  const paragraphs = (content || []).map((node) => {
    const runs = (node.children || []).map((c: any) =>
      new TextRun({ text: c.text || '', bold: !!c.bold, italics: !!c.italic, underline: c.underline ? {} : undefined })
    );
    if (node.type === 'heading-one') {
      return new Paragraph({ text: (node.children || []).map((c: any) => c.text || '').join(''), heading: HeadingLevel.HEADING_1 });
    }
    if (node.type === 'heading-two') {
      return new Paragraph({ text: (node.children || []).map((c: any) => c.text || '').join(''), heading: HeadingLevel.HEADING_2 });
    }
    return new Paragraph({ children: runs.length ? runs : [new TextRun('')] });
  });

  const doc = new Document({
    sections: [{ properties: {}, children: [
      new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
      ...paragraphs,
    ] }],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(`${filename}.docx`, blob);
}

export async function downloadEpub(bookTitle: string, chapters: { title: string; volumeTitle: string; content: any[] }[]) {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const chapterItems = chapters.map((ch, i) => {
    const id = `chapter-${i + 1}`;
    const html = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${esc(ch.title)}</title></head>
<body>
  <h2>${esc(ch.volumeTitle)}</h2>
  <h1>${esc(ch.title)}</h1>
  ${slateToText(ch.content).split('\n\n').map(p => `<p>${esc(p)}</p>`).join('\n')}
</body>
</html>`;
    zip.file(`OEBPS/${id}.xhtml`, html);
    return `<item id="${id}" href="${id}.xhtml" media-type="application/xhtml+xml"/>`;
  });

  const spineItems = chapters.map((_, i) => `<itemref idref="chapter-${i + 1}"/>`).join('\n');
  const navPoints = chapters.map((ch, i) =>
    `<navPoint id="nav${i + 1}" playOrder="${i + 1}"><navLabel><text>${esc(ch.title)}</text></navLabel><content src="chapter-${i + 1}.xhtml"/></navPoint>`
  ).join('\n');

  zip.file('mimetype', 'application/epub+zip');
  zip.file('META-INF/container.xml', `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`);

  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${esc(bookTitle)}</dc:title>
    <dc:language>zh-CN</dc:language>
    <dc:identifier id="uid">urn:uuid:${crypto.randomUUID()}</dc:identifier>
  </metadata>
  <manifest>
    <item id="nav" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    ${chapterItems.join('\n    ')}
  </manifest>
  <spine toc="nav">${spineItems}</spine>
</package>`);

  zip.file('OEBPS/toc.ncx', `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="urn:uuid:${crypto.randomUUID()}"/></head>
  <docTitle><text>${esc(bookTitle)}</text></docTitle>
  <navMap>${navPoints}</navMap>
</ncx>`);

  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
  downloadBlob(`${bookTitle}.epub`, blob);
}

export function downloadPdf(title: string, content: any[]) {
  const text = slateToText(content);
  const win = window.open('', '_blank');
  if (!win) {
    alert('请允许弹出窗口以导出 PDF');
    return;
  }
  win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body { font-family: "Noto Serif SC", serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.8; font-size: 16px; }
  h1 { text-align: center; margin-bottom: 2rem; }
  p { text-indent: 2em; margin: 0 0 1em; }
</style></head><body>
<h1>${title}</h1>
${text.split('\n\n').map(p => `<p>${p.replace(/</g, '&lt;')}</p>`).join('\n')}
<script>window.onload = () => { window.print(); }</script>
</body></html>`);
  win.document.close();
}

export async function downloadBookBackup(bookTitle: string, data: object) {
  const json = JSON.stringify(data, null, 2);
  downloadBlob(`${bookTitle}-backup.json`, new Blob([json], { type: 'application/json;charset=utf-8' }));
}
