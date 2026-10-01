/**
 * useAutoSave.ts
 * Handles debounced autosave, revision audit entries, version restore, and submit.
 */
import { useCallback, useRef } from 'react';
import type { Revision, CollabUser, CollabMessage } from './types';
import { MAX_REVISIONS, wordCountOf, textDiff } from './helpers';

interface UseAutoSaveOptions {
  editorRef: React.RefObject<HTMLDivElement>;
  initialHtmlRef: React.MutableRefObject<string>;
  myNameRef: React.MutableRefObject<string>;
  meRef: React.MutableRefObject<CollabUser | null>;
  actions: any;
  propName: string;
  collabEnabled: boolean;
  broadcast: (msg: CollabMessage) => void;
  persistVersions: (v: Revision[]) => void;
  setAutosaveStatus: React.Dispatch<React.SetStateAction<'saved' | 'saving' | 'unsaved'>>;
  setRevisions: React.Dispatch<React.SetStateAction<Revision[]>>;
  setActiveTab: (tab: 'editor' | 'history' | 'comments' | 'collaborate' | 'metadata') => void;
}

export function useAutoSave({
  editorRef, initialHtmlRef, myNameRef, meRef,
  actions, propName, collabEnabled,
  broadcast, persistVersions,
  setAutosaveStatus, setRevisions, setActiveTab,
}: UseAutoSaveOptions) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wordCountBeforeRef = useRef<number>(0);
  const textBeforeRef = useRef<string>('');

  const doSaveAndAudit = useCallback((wordsBefore: number, textBefore: string) => {
    const html = editorRef.current?.innerHTML ?? '';
    const text = editorRef.current?.innerText ?? '';
    const wordsAfter = wordCountOf(text);
    const delta = wordsAfter - wordsBefore;
    const sign = delta > 0 ? '+' : '';
    const summary = delta === 0
      ? 'Formatting / no word change'
      : `${sign}${delta} word${Math.abs(delta) !== 1 ? 's' : ''}`;

    const { added, removed } = textDiff(textBefore, text);

    setAutosaveStatus('saving');
    actions.updateFieldValue(propName, html);
    setTimeout(() => setAutosaveStatus('saved'), 600);

    if (!added && !removed) return;

    const author = myNameRef.current || 'Anonymous';
    setRevisions(prev => {
      const entry: Revision = {
        id: Date.now().toString(), author, summary,
        added, removed, wordsBefore, wordsAfter,
        ts: new Date().toLocaleTimeString(),
        html,
      };
      const next = [entry, ...prev].slice(0, MAX_REVISIONS);
      broadcast({ type: 'revision', revisions: next });
      persistVersions(next);
      return next;
    });
  }, [editorRef, actions, propName, myNameRef, broadcast, persistVersions, setAutosaveStatus, setRevisions]);

  const scheduleEditBurst = useCallback(() => {
    setAutosaveStatus('unsaved');
    if (!saveTimerRef.current) {
      wordCountBeforeRef.current = wordCountOf(editorRef.current?.innerText ?? '');
      textBeforeRef.current = editorRef.current?.innerText ?? '';
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      doSaveAndAudit(wordCountBeforeRef.current, textBeforeRef.current);
    }, 2000);
  }, [doSaveAndAudit, editorRef, setAutosaveStatus]);

  const handleRestoreVersion = useCallback((revision: Revision) => {
    const html = revision.html;
    if (!html || !editorRef.current) return;

    editorRef.current.innerHTML = html;
    editorRef.current.setAttribute('dir', 'ltr');
    editorRef.current.querySelectorAll('p,div,li,h1,h2,h3,h4,h5,h6,td,th,blockquote').forEach(el => {
      (el as HTMLElement).setAttribute('dir', 'ltr');
    });
    initialHtmlRef.current = html;

    actions.updateFieldValue(propName, html);
    setAutosaveStatus('saved');

    if (collabEnabled && meRef.current) {
      broadcast({ type: 'content', html, fromId: meRef.current.id });
    }

    const restoreEntry: Revision = {
      id: Date.now().toString(),
      author: myNameRef.current || 'Anonymous',
      summary: `↩ Restored version from ${revision.ts}`,
      added: '', removed: '',
      wordsBefore: revision.wordsAfter,
      wordsAfter: wordCountOf(editorRef.current.innerText ?? ''),
      ts: new Date().toLocaleTimeString(),
      html,
    };
    setRevisions(prev => {
      const next = [restoreEntry, ...prev].slice(0, MAX_REVISIONS);
      broadcast({ type: 'revision', revisions: next });
      persistVersions(next);
      return next;
    });
    setActiveTab('editor');
  }, [editorRef, initialHtmlRef, actions, propName, collabEnabled, meRef, myNameRef,
      broadcast, persistVersions, setAutosaveStatus, setRevisions, setActiveTab]);

  const handleSubmit = useCallback(() => {
    const html = editorRef.current?.innerHTML ?? '';
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    setAutosaveStatus('saving');
    actions.updateFieldValue(propName, html);
    actions.triggerFieldChange(propName, html);
    (actions as any).submit?.();
    setTimeout(() => setAutosaveStatus('saved'), 600);
  }, [editorRef, actions, propName, setAutosaveStatus]);

  return { scheduleEditBurst, handleRestoreVersion, handleSubmit };
}
