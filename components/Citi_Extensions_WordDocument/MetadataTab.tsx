/**
 * MetadataTab.tsx
 * Document properties panel.
 */
import React from 'react';
import { Input, Text } from '@pega/cosmos-react-core';
import type { DocMetadata, Comment, Revision, CollabUser } from './types';
import { MAX_REVISIONS } from './helpers';

interface Props {
  metadata:      DocMetadata;
  readOnly:      boolean;
  wordCount:     { words: number; chars: number };
  comments:      Comment[];
  revisions:     Revision[];
  collabEnabled: boolean;
  allUsers:      CollabUser[];
  setMetadata:   React.Dispatch<React.SetStateAction<DocMetadata>>;
}

export function MetadataTab({
  metadata, readOnly, wordCount, comments, revisions,
  collabEnabled, allUsers, setMetadata,
}: Props) {
  return (
    <div style={{ padding: 24, maxWidth: 520 }}>
      <Text variant='h3' style={{ marginBottom: 16 }}>Document Properties</Text>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Input label='Document Title' value={metadata.title} readOnly={readOnly}
          onChange={(e: any) => setMetadata(m => ({ ...m, title: e.target.value }))} />
        <Input label='Author' value={metadata.author} readOnly={readOnly}
          onChange={(e: any) => setMetadata(m => ({ ...m, author: e.target.value }))} />
        <Input label='Subject' value={metadata.subject} readOnly={readOnly}
          onChange={(e: any) => setMetadata(m => ({ ...m, subject: e.target.value }))} />
        <Input label='Created On' value={metadata.createdAt} readOnly />
        <div style={{ background: '#f5f5f5', borderRadius: 4, padding: '10px 14px', fontSize: '0.85rem', color: '#555' }}>
          <div><strong>Words:</strong> {wordCount.words}</div>
          <div><strong>Characters:</strong> {wordCount.chars}</div>
          <div><strong>Comments:</strong> {comments.length}</div>
          <div><strong>History entries:</strong> {revisions.length} / {MAX_REVISIONS}</div>
          <div><strong>Collaborators online:</strong> {collabEnabled ? allUsers.length : 'N/A'}</div>
        </div>
      </div>
    </div>
  );
}
