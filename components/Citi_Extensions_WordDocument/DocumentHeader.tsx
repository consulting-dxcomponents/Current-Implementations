/**
 * DocumentHeader.tsx
 * Blue top bar: document title, collaborator avatars, word count,
 * file-upload inputs, toolbar action buttons and autosave indicator.
 */
import type React from 'react';
import { Button } from '@pega/cosmos-react-core';
import type { CollabUser, DocMetadata } from './types';
import { initials } from './helpers';

interface Props {
  metadata:        DocMetadata;
  editingMeta:     boolean;
  readOnly:        boolean;
  collabEnabled:   boolean;
  allUsers:        CollabUser[];
  meRef:           React.MutableRefObject<CollabUser | null>;
  wordCount:       { words: number; chars: number };
  uploadStatus:    'idle' | 'loading' | 'error';
  autosaveStatus:  'saved' | 'saving' | 'unsaved';
  fileInputRef:    React.RefObject<HTMLInputElement>;
  imageInputRef:   React.RefObject<HTMLInputElement>;
  setMetadata:     React.Dispatch<React.SetStateAction<DocMetadata>>;
  setEditingMeta:  (v: boolean) => void;
  setReadOnly:     React.Dispatch<React.SetStateAction<boolean>>;
  handleDocxUpload:(e: React.ChangeEvent<HTMLInputElement>) => void;
  handleImageUpload:(e: React.ChangeEvent<HTMLInputElement>) => void;
  handleExport:    () => void;
  handleSubmit:    () => void;
}

export function DocumentHeader({
  metadata, editingMeta, readOnly, collabEnabled, allUsers, meRef,
  wordCount, uploadStatus, autosaveStatus,
  fileInputRef, imageInputRef,
  setMetadata, setEditingMeta, setReadOnly,
  handleDocxUpload, handleImageUpload, handleExport, handleSubmit,
}: Props) {
  return (
    <div style={{ background: '#1565c0', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 700 }}>📄</span>
        {editingMeta ? (
          <input autoFocus value={metadata.title}
            onChange={e => setMetadata(m => ({ ...m, title: e.target.value }))}
            onBlur={() => setEditingMeta(false)}
            style={{ fontSize: '1rem', fontWeight: 700, background: 'transparent', border: 'none', borderBottom: '1px solid #90caf9', color: '#fff', outline: 'none', width: 300 }} />
        ) : (
          <span style={{ color: '#fff', fontWeight: 700, cursor: 'pointer' }}
            onDoubleClick={() => !readOnly && setEditingMeta(true)} title='Double-click to rename'>
            {metadata.title}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {collabEnabled && allUsers.length > 0 && (
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {allUsers.slice(0, 6).map(u => (
              <span key={u.id} title={u.name + (u.id === meRef.current?.id ? ' (you)' : '')}
                style={{
                  width: 26, height: 26, borderRadius: '50%', background: u.color,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: '0.68rem', fontWeight: 700,
                  border: u.id === meRef.current?.id ? '2px solid #fff' : '2px solid transparent',
                  cursor: 'default', flexShrink: 0,
                }}>{initials(u.name)}</span>
            ))}
            {allUsers.length > 6 && <span style={{ color: '#90caf9', fontSize: '0.75rem' }}>+{allUsers.length - 6}</span>}
          </div>
        )}

        <span style={{ color: '#90caf9', fontSize: '0.78rem' }}>{wordCount.words} words · {wordCount.chars} chars</span>

        <input ref={fileInputRef} type='file'
          accept='.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          style={{ display: 'none' }} onChange={handleDocxUpload} />
        <input ref={imageInputRef} type='file' accept='image/*'
          style={{ display: 'none' }} onChange={handleImageUpload} />

        {!readOnly && (
          <button onClick={() => fileInputRef.current?.click()} title='Upload a Word document (.docx)'
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: uploadStatus === 'error' ? '#c62828' : 'rgba(255,255,255,0.15)',
              color: '#fff', border: '1px solid rgba(255,255,255,0.35)',
              borderRadius: 5, padding: '4px 12px',
              fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
              whiteSpace: 'nowrap', transition: 'background 0.15s',
            }}>
            {uploadStatus === 'loading' ? '⏳ Loading…' : uploadStatus === 'error' ? '❌ Invalid file' : '📂 Upload .docx'}
          </button>
        )}

        <Button variant='secondary' onClick={() => setReadOnly((r: boolean) => !r)}>
          {readOnly ? '✏️ Edit' : '👁 Read Only'}
        </Button>
        <Button variant='secondary' onClick={handleExport}>⬇️ Export .docx</Button>
        {!readOnly && <Button variant='primary' onClick={handleSubmit}>✅ Submit</Button>}

        {!readOnly && (
          <span style={{
            fontSize: '0.78rem', marginLeft: 8,
            color: autosaveStatus === 'saved' ? '#90caf9' : autosaveStatus === 'saving' ? '#fff176' : '#ffcc80',
          }}>
            {autosaveStatus === 'saved' ? '✔ Saved' : autosaveStatus === 'saving' ? '💾 Saving…' : '● Unsaved'}
          </span>
        )}
      </div>
    </div>
  );
}