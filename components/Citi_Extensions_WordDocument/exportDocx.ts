/**
 * exportDocx.ts
 * Converts the editor's DOM content to a genuine .docx file and triggers a download.
 */
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun, AlignmentType,
} from 'docx';

// ─── Internal helpers ─────────────────────────────────────────────────────────

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return arr;
}

function imgMimeType(src: string): 'png' | 'jpg' | 'gif' | 'bmp' {
  if (src.includes('image/png')) return 'png';
  if (src.includes('image/gif')) return 'gif';
  if (src.includes('image/bmp')) return 'bmp';
  return 'jpg';
}

function getAlignment(el: HTMLElement): (typeof AlignmentType)[keyof typeof AlignmentType] {
  const ta = el.style.textAlign || el.getAttribute('align') || '';
  if (ta === 'center')  return AlignmentType.CENTER;
  if (ta === 'right')   return AlignmentType.RIGHT;
  if (ta === 'justify' || ta === 'justify-all' || ta === 'both') return AlignmentType.JUSTIFIED;
  return AlignmentType.LEFT;
}

type RunFmt = { bold?: boolean; italics?: boolean; underline?: { type: 'single' }; strike?: boolean };

function nodeToRunItems(node: Node, fmt: RunFmt): Array<TextRun | ImageRun> {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    if (!text) return [];
    return [new TextRun({ text, ...fmt })];
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return [];

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (tag === 'img') {
    const src = (el as HTMLImageElement).src;
    if (src.startsWith('data:')) {
      try {
        const data = dataUrlToUint8Array(src);
        const type = imgMimeType(src);
        const w = (el as HTMLImageElement).naturalWidth  || (el as HTMLImageElement).width  || 400;
        const h = (el as HTMLImageElement).naturalHeight || (el as HTMLImageElement).height || 300;
        const scale = w > 500 ? 500 / w : 1;
        return [new ImageRun({ data, transformation: { width: Math.round(w * scale), height: Math.round(h * scale) }, type })];
      } catch { return []; }
    }
    return [];
  }

  if (tag === 'sup' && el.hasAttribute('data-comment-badge')) return [];
  if (tag === 'br') return [new TextRun({ break: 1 })];

  const next: RunFmt = { ...fmt };
  if (tag === 'strong' || tag === 'b')                              next.bold = true;
  if (tag === 'em'     || tag === 'i')                              next.italics = true;
  if (tag === 'u')                                                  next.underline = { type: 'single' };
  if (tag === 's' || tag === 'strike' || tag === 'del')             next.strike = true;
  if (el.style.fontWeight === 'bold' || Number(el.style.fontWeight) >= 700) next.bold = true;
  if (el.style.fontStyle === 'italic')                              next.italics = true;
  if (el.style.textDecoration?.includes('underline'))               next.underline = { type: 'single' };
  if (el.style.textDecoration?.includes('line-through'))            next.strike = true;

  const items: Array<TextRun | ImageRun> = [];
  el.childNodes.forEach(child => items.push(...nodeToRunItems(child, next)));
  return items;
}

const HEADING_MAP: Record<string, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  h1: HeadingLevel.HEADING_1, h2: HeadingLevel.HEADING_2, h3: HeadingLevel.HEADING_3,
  h4: HeadingLevel.HEADING_4, h5: HeadingLevel.HEADING_5, h6: HeadingLevel.HEADING_6,
};

const BLOCK_CHILD_TAGS = new Set(['p','div','h1','h2','h3','h4','h5','h6','ul','ol','table','blockquote']);

function processNode(node: Node, out: (Paragraph | Table)[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent ?? '').trim();
    if (text) out.push(new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun(text)] }));
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (tag === 'img') {
    nodeToRunItems(el, {}).forEach(item =>
      out.push(new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 100, after: 100 }, children: [item as ImageRun] }))
    );
    return;
  }

  if (tag === 'table') {
    const rows: TableRow[] = [];
    el.querySelectorAll('tr').forEach(tr => {
      const cells: TableCell[] = [];
      tr.querySelectorAll('td, th').forEach(td => {
        cells.push(new TableCell({
          children: [new Paragraph({ children: nodeToRunItems(td as HTMLElement, {}) as (TextRun | ImageRun)[] })],
          width: { size: Math.floor(100 / Math.max(tr.children.length, 1)), type: WidthType.PERCENTAGE },
          borders: {
            top:    { style: BorderStyle.SINGLE, size: 4 },
            bottom: { style: BorderStyle.SINGLE, size: 4 },
            left:   { style: BorderStyle.SINGLE, size: 4 },
            right:  { style: BorderStyle.SINGLE, size: 4 },
          },
        }));
      });
      if (cells.length) rows.push(new TableRow({ children: cells }));
    });
    if (rows.length) out.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
    out.push(new Paragraph({}));
    return;
  }

  if (HEADING_MAP[tag]) {
    out.push(new Paragraph({
      heading: HEADING_MAP[tag],
      alignment: getAlignment(el),
      spacing: { before: 200, after: 100 },
      children: nodeToRunItems(el, {}) as (TextRun | ImageRun)[],
    }));
    return;
  }

  if (tag === 'ul' || tag === 'ol') {
    el.querySelectorAll(':scope > li').forEach((li, idx) => {
      out.push(new Paragraph({
        bullet:    tag === 'ul' ? { level: 0 } : undefined,
        numbering: tag === 'ol' ? { reference: 'default-numbering', level: 0 } : undefined,
        spacing: { before: 60, after: 60 },
        children: nodeToRunItems(li as HTMLElement, {}) as (TextRun | ImageRun)[],
      }));
      void idx;
    });
    return;
  }

  if (tag === 'p' || tag === 'div' || tag === 'li') {
    if (Array.from(el.children).some(c => BLOCK_CHILD_TAGS.has(c.tagName.toLowerCase()))) {
      el.childNodes.forEach(child => processNode(child, out));
      return;
    }
    const runItems = nodeToRunItems(el, {});
    const textContent = Array.from(el.childNodes)
      .filter(n => !(n.nodeType === Node.ELEMENT_NODE && (n as HTMLElement).hasAttribute('data-comment-badge')))
      .map(n => n.textContent ?? '').join('').trim();
    const hasImage = runItems.some(r => r instanceof ImageRun);

    if (hasImage && !textContent) {
      runItems.forEach(item =>
        out.push(new Paragraph({ alignment: getAlignment(el), spacing: { before: 100, after: 100 }, children: [item as ImageRun] }))
      );
      return;
    }
    out.push(new Paragraph({ alignment: getAlignment(el), spacing: { before: 80, after: 80 }, children: runItems as (TextRun | ImageRun)[] }));
    return;
  }

  if (tag === 'br') { out.push(new Paragraph({})); return; }

  el.childNodes.forEach(child => processNode(child, out));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Convert the editor element's DOM to a .docx blob and trigger a file download.
 * @param editorEl  The contentEditable div
 * @param title     Document title used for the filename
 */
export async function exportDocx(editorEl: HTMLDivElement, title: string): Promise<void> {
  const children: (Paragraph | Table)[] = [];
  editorEl.childNodes.forEach(node => processNode(node, children));

  if (children.length === 0) {
    children.push(new Paragraph({ children: [new TextRun(editorEl.innerText ?? '')] }));
  }

  const doc = new Document({
    numbering: {
      config: [{ reference: 'default-numbering', levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.LEFT }] }],
    },
    sections: [{ properties: {}, children }],
  });

  try {
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[exportDocx] failed:', err);
  }
}
