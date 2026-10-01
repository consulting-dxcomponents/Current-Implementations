/**
 * HistoryTab.tsx
 * Displays the version-history timeline in the History tab.
 */
import React from 'react';
import { Button, Text } from '@pega/cosmos-react-core';
import type { Revision } from './types';
import { USER_COLORS, MAX_REVISIONS, initials } from './helpers';

interface Props {
  revisions:          Revision[];
  readOnly:           boolean;
  confirmRestoreId:   string | null;
  setRevisions:       (r: Revision[]) => void;
  setConfirmRestoreId:(id: string | null) => void;
  handleRestoreVersion: (r: Revision) => void;
  broadcast:          (msg: any) => void;
}

export function HistoryTab({
  revisions, readOnly, confirmRestoreId,
  setRevisions, setConfirmRestoreId,
  handleRestoreVersion, broadcast,
}: Props) {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Text variant='h3' style={{ margin: 0 }}>Edit History</Text>
          <p style={{ fontSize: '0.8rem', color: '#888', margin: '4px 0 0' }}>
            Content changes only · recorded 2 s after each edit burst · max {MAX_REVISIONS}
          </p>
        </div>
        {revisions.length > 0 && (
          <Button variant='secondary' onClick={() => {
            setRevisions([]);
            broadcast({ type: 'revision', revisions: [] });
          }}>Clear All</Button>
        )}
      </div>

      {revisions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#aaa' }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>📝</div>
          <div style={{ fontSize: '0.9rem' }}>No edits recorded yet.</div>
          <div style={{ fontSize: '0.8rem', marginTop: 4 }}>Start typing — changes appear here 2 s after you stop.</div>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: 17, top: 0, bottom: 0, width: 2, background: '#e0e0e0', zIndex: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {revisions.map((r, i) => {
              const delta       = r.wordsAfter - r.wordsBefore;
              const isAdd       = delta > 0 || (!r.removed && !!r.added);
              const isDel       = delta < 0 || (!r.added  && !!r.removed);
              const dotColor    = isAdd ? '#2e7d32' : isDel ? '#c62828' : '#1565c0';
              const dotIcon     = isAdd ? '+' : isDel ? '−' : '~';
              const authorColor = USER_COLORS[Math.abs(r.author.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % USER_COLORS.length];

              return (
                <div key={r.id} style={{ display: 'flex', gap: 12, paddingBottom: 20, position: 'relative', zIndex: 1 }}>
                  {/* timeline dot */}
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: dotColor, border: '3px solid #fff',
                    boxShadow: '0 0 0 2px ' + dotColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 700, fontSize: '1rem', zIndex: 2,
                  }}>{dotIcon}</div>

                  {/* card */}
                  <div style={{
                    flex: 1, background: '#fff', border: '1px solid #e0e0e0',
                    borderRadius: 8, padding: '10px 14px',
                    boxShadow: i === 0 ? '0 2px 8px rgba(21,101,192,0.10)' : 'none',
                  }}>
                    {/* header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{
                        width: 26, height: 26, borderRadius: '50%', background: authorColor,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: '0.68rem', fontWeight: 700, flexShrink: 0,
                      }}>{initials(r.author)}</span>
                      <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{r.author}</span>
                      {i === 0 && (
                        <span style={{ fontSize: '0.7rem', background: '#1565c0', color: '#fff', borderRadius: 8, padding: '1px 7px', marginLeft: 2 }}>latest</span>
                      )}
                      <span style={{ marginLeft: 'auto', color: '#aaa', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{r.ts}</span>
                    </div>

                    {/* diff lines */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontFamily: 'Georgia, serif', fontSize: '0.85rem' }}>
                      {r.removed && (
                        <div style={{ background: '#fff5f5', border: '1px solid #ffcdd2', borderRadius: 4, padding: '5px 10px', color: '#b71c1c', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0, marginTop: 1 }}>−</span>
                          <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', textDecoration: 'line-through', opacity: 0.8 }}>
                            {r.removed.length > 300 ? r.removed.slice(0, 300) + '…' : r.removed}
                          </span>
                        </div>
                      )}
                      {r.added && (
                        <div style={{ background: '#f1f8e9', border: '1px solid #c5e1a5', borderRadius: 4, padding: '5px 10px', color: '#1b5e20', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0, marginTop: 1 }}>+</span>
                          <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {r.added.length > 300 ? r.added.slice(0, 300) + '…' : r.added}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* word delta */}
                    {delta !== 0 && (
                      <div style={{ marginTop: 6, fontSize: '0.75rem', color: delta > 0 ? '#2e7d32' : '#c62828' }}>
                        {delta > 0 ? `+${delta}` : delta} word{Math.abs(delta) !== 1 ? 's' : ''}
                        <span style={{ color: '#bbb', marginLeft: 6 }}>{r.wordsBefore} → {r.wordsAfter} total</span>
                      </div>
                    )}

                    {/* restore */}
                    {r.html && !readOnly && (
                      <div style={{ marginTop: 10, borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
                        {confirmRestoreId === r.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: '0.78rem', color: '#555' }}>Overwrite current content?</span>
                            <button
                              onClick={() => { setConfirmRestoreId(null); handleRestoreVersion(r); }}
                              style={{ padding: '3px 10px', fontSize: '0.78rem', fontWeight: 700, background: '#1565c0', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                              Yes, restore
                            </button>
                            <button
                              onClick={() => setConfirmRestoreId(null)}
                              style={{ padding: '3px 8px', fontSize: '0.78rem', background: 'none', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', color: '#666' }}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmRestoreId(r.id)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '4px 12px', fontSize: '0.78rem', fontWeight: 600,
                              background: '#fff', border: '1px solid #1565c0', borderRadius: 5,
                              color: '#1565c0', cursor: 'pointer', transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#e3f2fd')}
                            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                          >
                            ↩ Restore this version
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
