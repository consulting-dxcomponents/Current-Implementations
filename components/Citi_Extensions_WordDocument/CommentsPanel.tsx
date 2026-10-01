/**
 * CommentsPanel.tsx
 * The right-side floating comment panel shown when showComments = true.
 */
import type React from 'react';
import type { Comment } from './types';
import { USER_COLORS, initials } from './helpers';

interface Props {
  comments:           Comment[];
  activeCommentId:    string | null;
  replyingTo:         string | null;
  replyText:          string;
  editorRef:          React.RefObject<HTMLDivElement>;
  commentPanelRef:    React.RefObject<HTMLDivElement>;
  setActiveCommentId: (id: string | null) => void;
  setShowComments:    (v: boolean) => void;
  setReplyingTo:      (id: string | null) => void;
  setReplyText:       (t: string) => void;
  handleReply:        (commentId: string) => void;
  handleDeleteComment:(id: string) => void;
}

export function CommentsPanel({
  comments, activeCommentId, replyingTo, replyText, editorRef, commentPanelRef,
  setActiveCommentId, setShowComments, setReplyingTo, setReplyText,
  handleReply, handleDeleteComment,
}: Props) {
  return (
    <div ref={commentPanelRef} style={{
      width: 300, flexShrink: 0,
      borderLeft: '2px solid #ffe082',
      background: '#fffdf5',
      display: 'flex', flexDirection: 'column',
      alignSelf: 'stretch', overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        padding: '8px 12px', background: '#fff8e1',
        borderBottom: '1px solid #ffe082',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#e65100' }}>
          💬 Comments <span style={{ fontWeight: 400, color: '#bbb', fontSize: '0.78rem' }}>({comments.length})</span>
        </span>
        <button onClick={() => { setShowComments(false); setActiveCommentId(null); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: '1rem', lineHeight: 1 }}>✕</button>
      </div>

      {comments.length === 0 ? (
        <div style={{ padding: '24px 16px', color: '#bbb', fontSize: '0.82rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>💬</div>
          Select text or click an image,<br />then click <strong>Add comment</strong>.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {comments.map(c => {
            const isActive    = activeCommentId === c.id;
            const avatarColor = USER_COLORS[Math.abs(c.author.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0)) % USER_COLORS.length];
            return (
              <div
                key={c.id}
                data-comment-card={c.id}
                onClick={() => {
                  setActiveCommentId(c.id);
                  setTimeout(() => {
                    if (c.imgId) {
                      const img = editorRef.current?.querySelector(`img[data-img-id="${c.imgId}"]`) as HTMLElement | null;
                      img?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    } else {
                      const mark = editorRef.current?.querySelector(`mark[data-comment-id="${c.id}"]`) as HTMLElement | null;
                      mark?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                  }, 30);
                }}
                style={{
                  padding: '10px 12px', borderBottom: '1px solid #f0e6c8',
                  background: isActive ? '#fff9e6' : '#fff',
                  borderLeft: `3px solid ${isActive ? '#e6a800' : 'transparent'}`,
                  cursor: 'pointer', transition: 'background 0.12s, border-color 0.12s',
                }}>

                {c.selection && (
                  <div style={{
                    fontSize: '0.73rem', color: '#a08060', fontStyle: 'italic',
                    background: 'rgba(255,200,0,0.25)', borderLeft: '3px solid #e6a800',
                    padding: '2px 7px', marginBottom: 7,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    borderRadius: '0 3px 3px 0',
                  }}>
                    ❝ {c.selection.slice(0, 55)}{c.selection.length > 55 ? '…' : ''}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                  <span style={{
                    width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: avatarColor,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: '0.63rem', fontWeight: 700,
                  }}>{initials(c.author)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#333' }}>{c.author}</span>
                      <span style={{ fontSize: '0.67rem', color: '#ccc', marginLeft: 'auto', whiteSpace: 'nowrap' }}>{c.ts}</span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#333', marginTop: 2, wordBreak: 'break-word' }}>{c.text}</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); handleDeleteComment(c.id); }} title='Resolve & delete'
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ddd', fontSize: '0.75rem', padding: '1px 3px', flexShrink: 0 }}>✕</button>
                </div>

                {c.replies.length > 0 && (
                  <div style={{ marginLeft: 33, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {c.replies.map(r => {
                      const rColor = USER_COLORS[Math.abs(r.author.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0)) % USER_COLORS.length];
                      return (
                        <div key={r.id} style={{ background: '#f7f3e9', borderRadius: 5, padding: '5px 8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                            <span style={{
                              width: 18, height: 18, borderRadius: '50%', flexShrink: 0, background: rColor,
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              color: '#fff', fontSize: '0.54rem', fontWeight: 700,
                            }}>{initials(r.author)}</span>
                            <span style={{ fontWeight: 600, fontSize: '0.73rem', color: '#555' }}>{r.author}</span>
                            <span style={{ fontSize: '0.64rem', color: '#ccc', marginLeft: 'auto' }}>{r.ts}</span>
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#444', paddingLeft: 22 }}>{r.text}</div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {replyingTo === c.id ? (
                  <div style={{ marginLeft: 33, marginTop: 7, display: 'flex', gap: 4 }}>
                    <input autoFocus value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      onKeyDown={e => {
                        e.stopPropagation();
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(c.id); }
                        if (e.key === 'Escape') { setReplyingTo(null); setReplyText(''); }
                      }}
                      onClick={e => e.stopPropagation()}
                      placeholder='Reply…'
                      style={{ flex: 1, fontSize: '0.78rem', padding: '3px 7px', border: '1px solid #ccc', borderRadius: 4, outline: 'none' }}
                    />
                    <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); handleReply(c.id); }}
                      disabled={!replyText.trim()}
                      style={{ padding: '3px 8px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.73rem' }}>↩</button>
                    <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setReplyingTo(null); setReplyText(''); }}
                      style={{ padding: '3px 6px', background: 'none', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: '0.73rem', color: '#888' }}>✕</button>
                  </div>
                ) : (
                  <button onClick={e => { e.stopPropagation(); setReplyingTo(c.id); setReplyText(''); }}
                    style={{ marginLeft: 33, marginTop: 5, background: 'none', border: 'none', cursor: 'pointer', color: '#1565c0', fontSize: '0.73rem', padding: 0, display: 'block' }}>
                    ↩ Reply
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}