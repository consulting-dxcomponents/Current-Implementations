/**
 * useEditorSetup.ts
 * One-time editor setup effects:
 *  - Inject global CSS overrides (LTR, semantics, comment marks, tables…)
 *  - MutationObserver that stamps dir="ltr" on every new block element
 *  - Load persisted HTML / comments / versions from Pega on mount
 *  - MutationObserver that prunes orphaned comment state when marks are deleted
 */
import { useEffect, useRef } from 'react';
import type { Comment, Revision, CollabMessage } from './types';

const EDITOR_CSS = `
  [data-testid="word-doc-editor"],
  [data-testid="word-doc-editor"] * { direction: ltr !important; unicode-bidi: embed !important; }
  [data-testid="word-doc-editor"] img { max-width:100% !important; height:auto !important; display:block; box-sizing:border-box; cursor:pointer; }
  [data-testid="word-doc-editor"] strong, [data-testid="word-doc-editor"] b { font-weight:bold !important; }
  [data-testid="word-doc-editor"] em,     [data-testid="word-doc-editor"] i { font-style:italic !important; }
  [data-testid="word-doc-editor"] u  { text-decoration:underline !important; }
  [data-testid="word-doc-editor"] s, [data-testid="word-doc-editor"] strike, [data-testid="word-doc-editor"] del { text-decoration:line-through !important; }
  [data-testid="word-doc-editor"] h1 { font-size:2em !important;    font-weight:bold !important; margin:.67em 0 !important; }
  [data-testid="word-doc-editor"] h2 { font-size:1.5em !important;  font-weight:bold !important; margin:.75em 0 !important; }
  [data-testid="word-doc-editor"] h3 { font-size:1.17em !important; font-weight:bold !important; margin:.83em 0 !important; }
  [data-testid="word-doc-editor"] h4 { font-size:1em !important;    font-weight:bold !important; margin:1.12em 0 !important; }
  [data-testid="word-doc-editor"] h5 { font-size:.83em !important;  font-weight:bold !important; margin:1.5em 0 !important; }
  [data-testid="word-doc-editor"] h6 { font-size:.75em !important;  font-weight:bold !important; margin:1.67em 0 !important; }
  [data-testid="word-doc-editor"] ul { list-style-type:disc !important;    padding-left:2em !important; margin:.5em 0 !important; }
  [data-testid="word-doc-editor"] ol { list-style-type:decimal !important; padding-left:2em !important; margin:.5em 0 !important; }
  [data-testid="word-doc-editor"] li { display:list-item !important; }
  [data-testid="word-doc-editor"] table { border-collapse:collapse !important; width:100% !important; margin:8px 0 !important; }
  [data-testid="word-doc-editor"] td,
  [data-testid="word-doc-editor"] th { border:1px solid #ccc !important; padding:6px 10px !important; }
  [data-testid="word-doc-editor"] th { font-weight:bold !important; background:#f5f5f5 !important; }
  [data-testid="word-doc-editor"] mark[data-comment-id] {
    background:rgba(255,200,0,0.55) !important; border-bottom:2px solid #e6a800 !important;
    border-radius:2px; padding:0 1px; cursor:pointer; transition:background .15s; }
  [data-testid="word-doc-editor"] mark[data-comment-id]:hover,
  [data-testid="word-doc-editor"] mark[data-comment-id].active-comment {
    background:rgba(255,160,0,0.70) !important; border-bottom-color:#c67c00 !important; }
  [data-testid="word-doc-editor"] img.has-img-comment { outline:3px solid #e6a800; border-radius:3px; }
  [data-testid="word-doc-editor"] img.has-img-comment:hover { outline-color:#c67c00; }
`;

const BLOCK_SELECTOR = 'p,div,li,h1,h2,h3,h4,h5,h6,td,th,blockquote';
const BLOCK_TAGS_UC = new Set(['P','DIV','LI','H1','H2','H3','H4','H5','H6','TD','TH','BLOCKQUOTE']);

function stampAllLtr(root: HTMLElement) {
  root.setAttribute('dir', 'ltr');
  root.querySelectorAll(BLOCK_SELECTOR).forEach(el => (el as HTMLElement).setAttribute('dir', 'ltr'));
}

// ─── Global CSS injection ─────────────────────────────────────────────────────

export function useEditorCss() {
  useEffect(() => {
    const style = document.createElement('style');
    style.setAttribute('data-word-doc-ltr', '1');
    style.textContent = EDITOR_CSS;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);
}

// ─── LTR MutationObserver ─────────────────────────────────────────────────────

export function useLtrObserver(editorRef: React.RefObject<HTMLDivElement>) {
  const observerRef = useRef<MutationObserver | null>(null);
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    stampAllLtr(editor);

    const observer = new MutationObserver(mutations => {
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          const el = node as HTMLElement;
          if (BLOCK_TAGS_UC.has(el.tagName)) el.setAttribute('dir', 'ltr');
          el.querySelectorAll(BLOCK_SELECTOR).forEach(c => (c as HTMLElement).setAttribute('dir', 'ltr'));
        });
        if (m.type === 'attributes' && m.attributeName === 'dir') {
          const el = m.target as HTMLElement;
          if (el.getAttribute('dir') !== 'ltr') el.setAttribute('dir', 'ltr');
        }
      });
    });
    observer.observe(editor, { childList: true, subtree: true, attributes: true, attributeFilter: ['dir'] });
    observerRef.current = observer;
    return () => { observer.disconnect(); observerRef.current = null; };
  }, [editorRef]);
}

// ─── Mount: load persisted content + comments + versions ─────────────────────

interface MountLoadOptions {
  editorRef: React.RefObject<HTMLDivElement>;
  initialHtmlRef: React.MutableRefObject<string>;
  pConn: any;
  propName: string;
  commentsPropName?: string;
  versionsPropName?: string;
  setComments: (c: Comment[]) => void;
  setRevisions: (r: Revision[]) => void;
}

export function useMountLoad({
  editorRef, initialHtmlRef, pConn, propName,
  commentsPropName, versionsPropName, setComments, setRevisions,
}: MountLoadOptions) {
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const savedHtml = (typeof pConn.getValue === 'function' ? pConn.getValue(propName) as string : '') || '';
    if (savedHtml.trim()) initialHtmlRef.current = savedHtml;

    editor.innerHTML = initialHtmlRef.current;
    stampAllLtr(editor);

    // Load comments
    if (commentsPropName && typeof pConn.getValue === 'function') {
      try {
        const pages = pConn.getValue(commentsPropName) as Array<Record<string, unknown>>;
        if (Array.isArray(pages) && pages.length > 0) {
          const loaded: Comment[] = pages.map(p => ({
            id:        String(p['CommentID']   ?? ''),
            author:    String(p['Author']      ?? ''),
            text:      String(p['CommentText'] ?? ''),
            selection: String(p['Selection']   ?? ''),
            ts:        String(p['Timestamp']   ?? ''),
            imgId:     p['ImgID'] ? String(p['ImgID']) : undefined,
            imgX:      p['ImgX']  ? Number(p['ImgX'])  : undefined,
            imgY:      p['ImgY']  ? Number(p['ImgY'])  : undefined,
            replies: Array.isArray(p['Replies'])
              ? (p['Replies'] as Array<Record<string, unknown>>).map(r => ({
                  id: String(r['ReplyID'] ?? ''), author: String(r['Author'] ?? ''),
                  text: String(r['ReplyText'] ?? ''), ts: String(r['Timestamp'] ?? ''),
                }))
              : [],
          })).filter(c => c.id);
          if (loaded.length > 0) setComments(loaded);
        }
      } catch { /* ignore */ }
    }

    // Load versions
    if (versionsPropName && typeof pConn.getValue === 'function') {
      try {
        const pages = pConn.getValue(versionsPropName) as Array<Record<string, unknown>>;
        if (Array.isArray(pages) && pages.length > 0) {
          const loaded: Revision[] = pages.map(p => ({
            id:          String(p['VersionID']    ?? ''),
            author:      String(p['Author']       ?? ''),
            summary:     String(p['Summary']      ?? ''),
            html:        String(p['HtmlSnapshot'] ?? ''),
            added: '', removed: '',
            wordsBefore: Number(p['WordsBefore']  ?? 0),
            wordsAfter:  Number(p['WordsAfter']   ?? 0),
            ts:          String(p['Timestamp']    ?? ''),
          })).filter(v => v.id);
          if (loaded.length > 0) setRevisions(loaded);
        }
      } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// ─── Orphan-comment pruning observer ─────────────────────────────────────────

export function useOrphanPruner(
  editorRef: React.RefObject<HTMLDivElement>,
  broadcast: (msg: CollabMessage) => void,
  setComments: React.Dispatch<React.SetStateAction<Comment[]>>,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    function prune() {
      if (!editor) return;
      const markIds = new Set(
        Array.from(editor.querySelectorAll('mark[data-comment-id]'))
          .map(el => el.getAttribute('data-comment-id') as string)
      );
      const imgIds = new Set(
        Array.from(editor.querySelectorAll('img[data-img-id]'))
          .map(el => (el as HTMLElement).dataset.imgId as string)
      );
      setComments(prev => {
        const next = prev.filter(c =>
          (c.imgId === undefined && markIds.has(c.id)) ||
          (c.imgId !== undefined && imgIds.has(c.imgId))
        );
        if (next.length !== prev.length) {
          broadcast({ type: 'comment', comments: next });
          return next;
        }
        return prev;
      });
    }

    const observer = new MutationObserver(mutations => {
      const needsPrune = mutations.some(
        m => m.removedNodes.length > 0 ||
          (m.type === 'attributes' && m.attributeName === 'data-comment-id')
      );
      if (!needsPrune) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(prune, 120);
    });
    observer.observe(editor, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-comment-id'] });
    return () => {
      observer.disconnect();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [broadcast]);
}
