/**
 * CollaborateTab.tsx
 * Shows real-time collaboration status and active users list.
 */
import type React from 'react';
import { Text } from '@pega/cosmos-react-core';
import type { CollabUser } from './types';
import { HEARTBEAT_INTERVAL, USER_TIMEOUT, MAX_REVISIONS, initials } from './helpers';

interface Props {
  collabEnabled: boolean;
  allUsers:      CollabUser[];
  meRef:         React.MutableRefObject<CollabUser | null>;
  myNameRef:     React.MutableRefObject<string>;
  documentTitle: string;
}

export function CollaborateTab({ collabEnabled, allUsers, meRef, myNameRef, documentTitle }: Props) {
  return (
    <div style={{ padding: 24, maxWidth: 580 }}>
      <Text variant='h3' style={{ marginBottom: 4 }}>Real-time Collaboration</Text>
      <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: 20 }}>
        Collaboration is always active. Open this document in multiple browser tabs — all users share edits, comments, and history live.
      </p>

      <div style={{ background: collabEnabled ? '#e8f5e9' : '#fff3e0', borderRadius: 8, padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: '1.1rem' }}>{collabEnabled ? '🟢' : '🟡'}</span>
        <div>
          <div style={{ fontWeight: 700, color: collabEnabled ? '#2e7d32' : '#e65100' }}>
            {collabEnabled ? 'Live — collaboration active' : 'Connecting…'}
          </div>
          <div style={{ fontSize: '0.82rem', color: '#555', marginTop: 2 }}>
            You are editing as <strong style={{ color: meRef.current?.color ?? '#1565c0' }}>{myNameRef.current}</strong>
          </div>
        </div>
      </div>

      <Text variant='h4' style={{ marginBottom: 10 }}>Active Users ({allUsers.length})</Text>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {allUsers.map(u => (
          <div key={u.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 6,
            background: u.id === meRef.current?.id ? '#f0f4ff' : '#fafafa',
            border: `1.5px solid ${u.id === meRef.current?.id ? '#90caf9' : '#e0e0e0'}`,
          }}>
            <span style={{
              width: 34, height: 34, borderRadius: '50%', background: u.color,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: '0.82rem', flexShrink: 0,
            }}>{initials(u.name)}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                {u.name}
                {u.id === meRef.current?.id && (
                  <span style={{ marginLeft: 6, fontSize: '0.73rem', background: '#1565c0', color: '#fff', borderRadius: 8, padding: '1px 6px' }}>You</span>
                )}
              </div>
              {u.isTyping && u.id !== meRef.current?.id && (
                <div style={{ fontSize: '0.75rem', color: '#888', fontStyle: 'italic' }}>✏️ typing…</div>
              )}
            </div>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#43a047', display: 'inline-block', flexShrink: 0 }} title='Online' />
          </div>
        ))}
        {allUsers.length === 1 && (
          <div style={{ fontSize: '0.83rem', color: '#aaa', padding: '8px 4px' }}>
            No other users online yet. Open this document in another tab to collaborate.
          </div>
        )}
      </div>

      <div style={{ marginTop: 20, background: '#fff8e1', borderRadius: 6, padding: '12px 16px', fontSize: '0.82rem', color: '#555', borderLeft: '3px solid #ffc107' }}>
        <strong>How it works:</strong>
        <ul style={{ margin: '6px 0 0 16px', lineHeight: 1.8 }}>
          <li>No login needed — collaboration starts automatically.</li>
          <li>All tabs showing <em>"{documentTitle}"</em> are connected.</li>
          <li>Edits, comments, and history sync in real time.</li>
          <li>History entries are created 2 s after each edit burst (max {MAX_REVISIONS}).</li>
          <li>Presence updates every {HEARTBEAT_INTERVAL / 1000}s; idle users drop off after {USER_TIMEOUT / 1000}s.</li>
        </ul>
      </div>
    </div>
  );
}
