/**
 * usePegaPersistence.ts
 * React hooks for reading/writing comments and versions to Pega embedded Page Lists.
 */
import { useCallback } from 'react';
import type { Comment, Revision } from './types';

// ─── Comments ─────────────────────────────────────────────────────────────────

interface UseCommentsArgs {
  actions: any;
  pConn: any;
  commentsPropName?: string;
}

/**
 * Returns a stable `persistComments` callback that writes the full comments
 * list to a Pega Page List (Data-WordComment) using a full-replace strategy.
 */
export function usePersistComments({ actions, pConn, commentsPropName }: UseCommentsArgs) {
  return useCallback((next: Comment[]) => {
    if (!commentsPropName) return;
    try {
      const existing = (typeof pConn.getValue === 'function'
        ? (pConn.getValue(commentsPropName) as unknown[])
        : []) || [];
      const existingCount = Array.isArray(existing) ? existing.length : 0;

      for (let i = existingCount; i >= 1; i--) {
        actions.deleteItem?.(commentsPropName, { index: i });
      }

      next.forEach(c => {
        actions.addItem?.(commentsPropName);
        const base = `${commentsPropName}(Last)`;
        actions.updateFieldValue(`${base}.CommentID`,   c.id);
        actions.updateFieldValue(`${base}.Author`,      c.author);
        actions.updateFieldValue(`${base}.CommentText`, c.text);
        actions.updateFieldValue(`${base}.Selection`,   c.selection ?? '');
        actions.updateFieldValue(`${base}.Timestamp`,   c.ts);
        actions.updateFieldValue(`${base}.ImgID`,       c.imgId  ?? '');
        actions.updateFieldValue(`${base}.ImgX`,        String(c.imgX ?? ''));
        actions.updateFieldValue(`${base}.ImgY`,        String(c.imgY ?? ''));

        const repliesProp = `${base}.Replies`;
        c.replies.forEach(r => {
          actions.addItem?.(repliesProp);
          const rBase = `${repliesProp}(Last)`;
          actions.updateFieldValue(`${rBase}.ReplyID`,   r.id);
          actions.updateFieldValue(`${rBase}.Author`,    r.author);
          actions.updateFieldValue(`${rBase}.ReplyText`, r.text);
          actions.updateFieldValue(`${rBase}.Timestamp`, r.ts);
        });
      });
    } catch { /* non-critical — comments still work in-session */ }
  }, [actions, pConn, commentsPropName]);
}

/**
 * Reads comments from a Pega Page List on mount.
 * Returns undefined if no prop is configured or no pages exist.
 */
export function loadCommentsFromPega(pConn: any, commentsPropName?: string): Comment[] | undefined {
  if (!commentsPropName || typeof pConn.getValue !== 'function') return undefined;
  try {
    const pages = pConn.getValue(commentsPropName) as Array<Record<string, unknown>>;
    if (!Array.isArray(pages) || pages.length === 0) return undefined;
    const loaded: Comment[] = pages.map(p => ({
      id:        String(p['CommentID']   ?? ''),
      author:    String(p['Author']      ?? ''),
      text:      String(p['CommentText'] ?? ''),
      selection: String(p['Selection']   ?? ''),
      ts:        String(p['Timestamp']   ?? ''),
      imgId:     p['ImgID']  ? String(p['ImgID'])  : undefined,
      imgX:      p['ImgX']   ? Number(p['ImgX'])   : undefined,
      imgY:      p['ImgY']   ? Number(p['ImgY'])   : undefined,
      replies: Array.isArray(p['Replies'])
        ? (p['Replies'] as Array<Record<string, unknown>>).map(r => ({
            id:     String(r['ReplyID']   ?? ''),
            author: String(r['Author']    ?? ''),
            text:   String(r['ReplyText'] ?? ''),
            ts:     String(r['Timestamp'] ?? ''),
          }))
        : [],
    })).filter(c => c.id);
    return loaded.length > 0 ? loaded : undefined;
  } catch { return undefined; }
}

// ─── Versions ─────────────────────────────────────────────────────────────────

interface UseVersionsArgs {
  actions: any;
  pConn: any;
  versionsPropName?: string;
}

/**
 * Returns a stable `persistVersions` callback that writes the full revision
 * list to a Pega Page List (Data-WordVersion) using a full-replace strategy.
 */
export function usePersistVersions({ actions, pConn, versionsPropName }: UseVersionsArgs) {
  return useCallback((next: Revision[]) => {
    if (!versionsPropName) return;
    try {
      const existing = (typeof pConn.getValue === 'function'
        ? (pConn.getValue(versionsPropName) as unknown[])
        : []) || [];
      const existingCount = Array.isArray(existing) ? existing.length : 0;

      for (let i = existingCount; i >= 1; i--) {
        actions.deleteItem?.(versionsPropName, { index: i });
      }

      next.forEach(v => {
        actions.addItem?.(versionsPropName);
        const base = `${versionsPropName}(Last)`;
        actions.updateFieldValue(`${base}.VersionID`,    v.id);
        actions.updateFieldValue(`${base}.Author`,       v.author);
        actions.updateFieldValue(`${base}.Summary`,      v.summary);
        actions.updateFieldValue(`${base}.HtmlSnapshot`, v.html ?? '');
        actions.updateFieldValue(`${base}.WordsBefore`,  String(v.wordsBefore));
        actions.updateFieldValue(`${base}.WordsAfter`,   String(v.wordsAfter));
        actions.updateFieldValue(`${base}.Timestamp`,    v.ts);
      });
    } catch { /* non-critical */ }
  }, [actions, pConn, versionsPropName]);
}

/**
 * Reads versions from a Pega Page List on mount.
 * Returns undefined if no prop is configured or no pages exist.
 */
export function loadVersionsFromPega(pConn: any, versionsPropName?: string): Revision[] | undefined {
  if (!versionsPropName || typeof pConn.getValue !== 'function') return undefined;
  try {
    const pages = pConn.getValue(versionsPropName) as Array<Record<string, unknown>>;
    if (!Array.isArray(pages) || pages.length === 0) return undefined;
    const loaded: Revision[] = pages.map(p => ({
      id:          String(p['VersionID']    ?? ''),
      author:      String(p['Author']       ?? ''),
      summary:     String(p['Summary']      ?? ''),
      html:        String(p['HtmlSnapshot'] ?? ''),
      added:       '',
      removed:     '',
      wordsBefore: Number(p['WordsBefore']  ?? 0),
      wordsAfter:  Number(p['WordsAfter']   ?? 0),
      ts:          String(p['Timestamp']    ?? ''),
    })).filter(v => v.id);
    return loaded.length > 0 ? loaded : undefined;
  } catch { return undefined; }
}
