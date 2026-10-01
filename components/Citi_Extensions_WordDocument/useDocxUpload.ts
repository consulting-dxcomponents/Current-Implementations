/**
 * useDocxUpload.ts
 * Handles .docx file upload (via mammoth) and image insertion.
 */
import { useCallback } from 'react';
import mammoth from 'mammoth';
import type { CollabUser, CollabMessage } from './types';

interface UseDocxUploadOptions {
  editorRef: React.RefObject<HTMLDivElement>;
  initialHtmlRef: React.MutableRefObject<string>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  imageInputRef: React.RefObject<HTMLInputElement>;
  meRef: React.MutableRefObject<CollabUser | null>;
  collabEnabled: boolean;
  broadcast: (msg: CollabMessage) => void;
  updateWordCount: () => void;
  scheduleEditBurst: () => void;
  setMetadata: React.Dispatch<React.SetStateAction<any>>;
  setUploadStatus: React.Dispatch<React.SetStateAction<'idle' | 'loading' | 'error'>>;
  setActiveTab: (tab: 'editor' | 'history' | 'comments' | 'collaborate' | 'metadata') => void;
}

export function useDocxUpload({
  editorRef, initialHtmlRef, fileInputRef, imageInputRef,
  meRef, collabEnabled, broadcast,
  updateWordCount, scheduleEditBurst,
  setMetadata, setUploadStatus, setActiveTab,
}: UseDocxUploadOptions) {

  const handleDocxUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.docx')) {
      setUploadStatus('error');
      setTimeout(() => setUploadStatus('idle'), 3000);
      return;
    }

    setUploadStatus('loading');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml(
        { arrayBuffer },
        {
          styleMap: [
            "p[style-name='Table Contents'] => p:fresh",
            "p[style-name='Table Heading'] => b:fresh",
            "b => strong", "i => em", "u => u", "strike => s", "del => s",
          ],
          convertImage: mammoth.images.dataUri,
        }
      );
      const html = result.value;

      if (editorRef.current) {
        editorRef.current.innerHTML = html;
        editorRef.current.setAttribute('dir', 'ltr');
        editorRef.current.querySelectorAll('p,div,li,h1,h2,h3,h4,h5,h6,td,th,blockquote').forEach(el => {
          (el as HTMLElement).setAttribute('dir', 'ltr');
        });
        initialHtmlRef.current = html;
      }

      const docTitle = file.name.replace(/\.docx?$/i, '').replace(/[_-]+/g, ' ');
      setMetadata((m: any) => ({ ...m, title: docTitle }));

      updateWordCount();
      scheduleEditBurst();

      if (collabEnabled && meRef.current) {
        broadcast({ type: 'content', html, fromId: meRef.current.id });
      }

      setUploadStatus('idle');
      setActiveTab('editor');
    } catch {
      setUploadStatus('error');
      setTimeout(() => setUploadStatus('idle'), 3000);
    }
  }, [editorRef, initialHtmlRef, fileInputRef, meRef, collabEnabled,
      broadcast, updateWordCount, scheduleEditBurst, setMetadata, setUploadStatus, setActiveTab]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!imageInputRef.current) return;
    imageInputRef.current.value = '';
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      if (!dataUrl || !editorRef.current) return;
      editorRef.current.focus();
      document.execCommand('insertHTML', false,
        `<img src="${dataUrl}" alt="${file.name}" style="max-width:100%;height:auto;display:block;margin:4px 0;" />`
      );
      updateWordCount();
    };
    reader.readAsDataURL(file);
  }, [editorRef, imageInputRef, updateWordCount]);

  return { handleDocxUpload, handleImageUpload };
}
