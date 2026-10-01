import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Text, Button, withConfiguration } from '@pega/cosmos-react-core';
import type { PConnFieldProps } from './PConnProps';
import StyledCitiExtensionsWordDocumentWrapper from './styles';

import type {
  DocMetadata, Comment, Revision, TableConfig, CollabUser,
} from './types';
import { exportDocx } from './exportDocx';
import { usePersistComments, usePersistVersions } from './usePegaPersistence';
import { useCollaboration } from './useCollaboration';
import { useEditorCss, useLtrObserver, useMountLoad, useOrphanPruner } from './useEditorSetup';
import { createTableActions } from './useTableActions';
import { makeAddComment, useHandleReply, useHandleDeleteComment } from './useCommentActions';
import { useAutoSave } from './useAutoSave';
import { useDocxUpload } from './useDocxUpload';
import { useMarkers } from './useMarkers';
import { useEditorInput } from './useEditorInput';
import { useEditorMouseUp } from './useEditorMouseUp';
import { CommentsPanel } from './CommentsPanel';
import { HistoryTab } from './HistoryTab';
import { CollaborateTab } from './CollaborateTab';
import { MetadataTab } from './MetadataTab';
import { DocumentHeader } from './DocumentHeader';
import { EditorToolbar } from './EditorToolbar';

// ─── Component props ──────────────────────────────────────────────────────────

interface CitiExtensionsWordDocumentProps extends PConnFieldProps {
  documentTitle?: string;
  authorName?: string;
  initialReadOnly?: boolean;
  /**
   * Page List property backed by Data-WordComment (e.g. ".DocumentComments").
   * See usePegaPersistence.ts for the expected Pega data class structure.
   */
  commentsPropName?: string;
  /**
   * Page List property backed by Data-WordVersion (e.g. ".DocumentVersions").
   * Each version holds a full HTML snapshot to support version restore.
   */
  versionsPropName?: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────

function CitiExtensionsWordDocument(props: CitiExtensionsWordDocumentProps) {
  const {
    getPConnect,
    documentTitle = 'Untitled Document',
    authorName = '',
    initialReadOnly = false,
    commentsPropName,
    versionsPropName
  } = props;

  const pConn = getPConnect();
  const actions = pConn.getActionsApi();
  const stateProps = pConn.getStateProps() as { value: string };
  const propName = stateProps.value;

  // ── Pega persistence — delegated to usePegaPersistence.ts ──
  const persistComments = usePersistComments({ actions, pConn, commentsPropName });
  const persistVersions = usePersistVersions({ actions, pConn, versionsPropName });

  // ── Refs ──
  const editorRef = useRef<HTMLDivElement>(null);
  const meRef = useRef<CollabUser | null>(null);
  const commentsRef = useRef<Comment[]>([]);
  const revisionsRef = useRef<Revision[]>([]);
  const savedSelectionRef = useRef<Range | null>(null);
  const initialHtmlRef = useRef('<p dir="ltr">Start typing your document here\u2026</p>');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const myNameRef = useRef<string>(authorName || 'User-' + Math.random().toString(36).slice(2, 6));

  useEffect(() => {
    myNameRef.current = authorName || myNameRef.current;
    if (meRef.current) meRef.current.name = myNameRef.current;
  }, [authorName]);

  // ── State ──
  const [metadata, setMetadata] = useState<DocMetadata>({
    title: documentTitle, author: authorName, subject: '', createdAt: new Date().toLocaleDateString()
  });
  const [editingMeta, setEditingMeta] = useState(false);
  const [readOnly, setReadOnly] = useState(initialReadOnly);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [markerPositions, setMarkerPositions] = useState<Array<{ id: string; top: number }>>([]);
  const [selectionPos, setSelectionPos] = useState<{ top: number; left: number } | null>(null);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [pendingSelText, setPendingSelText] = useState('');
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const commentPanelRef = useRef<HTMLDivElement>(null);
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [tableConfig, setTableConfig] = useState<TableConfig>({ rows: 3, cols: 3 });
  const [autosaveStatus, setAutosaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [activeTab, setActiveTab] = useState<'editor' | 'history' | 'comments' | 'collaborate' | 'metadata'>('editor');
  const [activeTableCell, setActiveTableCell] = useState<HTMLTableCellElement | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [pendingImageEl, setPendingImageEl] = useState<HTMLImageElement | null>(null);
  const [pendingImageXY, setPendingImageXY] = useState<{ x: number; y: number } | null>(null);
  const [, setPinRenderTick] = useState(0); // incremented on scroll to reposition image pins
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);

  // Keep myNameRef / meRef in sync when the user edits Author in the Metadata tab
  useEffect(() => {
    if (!metadata.author) return;
    myNameRef.current = metadata.author;
    if (meRef.current) meRef.current.name = metadata.author;
  }, [metadata.author]);

  // Highlight the active comment's mark in the editor
  useEffect(() => {    const editor = editorRef.current;
    if (!editor) return;
    editor.querySelectorAll('mark[data-comment-id]').forEach(m => m.classList.remove('active-comment'));
    if (activeCommentId) {
      editor.querySelector(`mark[data-comment-id="${activeCommentId}"]`)?.classList.add('active-comment');
    }
  }, [activeCommentId]);

  // Keep refs in sync
  useEffect(() => { commentsRef.current = comments; }, [comments]);
  useEffect(() => { revisionsRef.current = revisions; }, [revisions]);

  // ── Collaboration (BroadcastChannel) ──
  const { collabEnabled, collabUsers, typingUsers, broadcast, broadcastContent, handleTypingStart } =
    useCollaboration({ documentTitle, myNameRef, meRef, editorRef, commentsRef, revisionsRef, initialHtmlRef, setComments, setRevisions });

  // ── Editor setup (CSS, LTR observer, mount load) ──
  useEditorCss();
  useLtrObserver(editorRef);
  useMountLoad({ editorRef, initialHtmlRef, pConn, propName, commentsPropName, versionsPropName, setComments, setRevisions });

  // ── Auto-save, restore, submit ──
  const { scheduleEditBurst, handleRestoreVersion, handleSubmit } = useAutoSave({
    editorRef, initialHtmlRef, myNameRef, meRef,
    actions, propName, collabEnabled,
    broadcast, persistVersions,
    setAutosaveStatus, setRevisions, setActiveTab,
  });

  // ── Insert Table (declared early so useEditorInput can reference tableAddRow) ──
  const { insertTable, tableAddRow, tableDeleteRow, tableAddCol, tableDeleteCol, tableDeleteTable } =
    createTableActions({
      readOnly, tableConfig, activeTableCell,
      setActiveTableCell, setShowTableDialog,
      execCommand: (cmd: string, val?: string) => editorInput.exec(cmd, val, initialHtmlRef),
      onMutation: () => editorInput.updateWordCount(initialHtmlRef),
    });

  // ── Editor input / formatting ──
  const editorInput = useEditorInput({
    editorRef,
    savedSelectionRef,
    readOnly,
    broadcastContent,
    handleTypingStart,
    scheduleEditBurst,
    tableAddRow,
  });

  const {
    formatState, wordCount,
    fontSize, setFontSize, fontFamily, setFontFamily, textColor, setTextColor,
    findText, setFindText, replaceText, setReplaceText,
    showFindReplace, setShowFindReplace,
    refreshFormatState, updateWordCount,
    saveSelection, exec, applyHeading, applyAlignment,
    handleFindReplace, handleKeyDown,
  } = editorInput;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { updateWordCount(initialHtmlRef); }, []);

  // ── Watch for marks removed by typing/backspace and auto-clean comment state ──
  useOrphanPruner(editorRef, broadcast, setComments);

  // ── Marker positions (right-gutter pins + panel scroll) ──
  const { recomputeMarkers, scrollCardIntoPanel } = useMarkers({
    editorRef, editorWrapperRef, commentPanelRef,
    commentsRef, comments, setMarkerPositions,
  });

  // ── Comment actions ──
  const handleAddComment = useCallback(() => makeAddComment({
    newComment, pendingSelText, pendingImageEl, pendingImageXY,
    savedSelectionRef, editorRef, myName: myNameRef.current,
    broadcast, persistComments, setComments,
    setNewComment, setShowCommentInput, setSelectionPos,
    setPendingSelText, setPendingImageEl, setPendingImageXY,
    setShowComments, setActiveCommentId,
    updateWordCount, recomputeMarkers,
  }), [newComment, pendingSelText, pendingImageEl, pendingImageXY, broadcast, persistComments, updateWordCount, recomputeMarkers]);

  const handleReply = useHandleReply(
    replyText, myNameRef.current, editorRef,
    broadcast, persistComments, setComments, setReplyText, setReplyingTo,
  );

  const handleDeleteComment = useHandleDeleteComment(
    activeCommentId, editorRef, broadcast, persistComments,
    setComments, setActiveCommentId, recomputeMarkers,
  );

  // ── Editor mouseUp handler ──
  const handleMouseUp = useEditorMouseUp({
    editorRef, editorWrapperRef, savedSelectionRef, commentsRef, readOnly,
    saveSelection, refreshFormatState, scrollCardIntoPanel,
    setActiveTableCell, setActiveCommentId, setShowComments,
    setShowCommentInput, setSelectionPos, setPendingSelText,
    setPendingImageEl, setPendingImageXY,
  });
  const { handleDocxUpload, handleImageUpload } = useDocxUpload({
    editorRef, initialHtmlRef, fileInputRef, imageInputRef,
    meRef, collabEnabled, broadcast,
    updateWordCount, scheduleEditBurst,
    setMetadata, setUploadStatus, setActiveTab,
  });

  const handleExport = async () => {
    const editorEl = editorRef.current;
    if (!editorEl) return;
    await exportDocx(editorEl, metadata.title);
  };

  // ─── Render helpers ──────────────────────────────────────────────────────────
  const tabStyle = (tab: string): React.CSSProperties => ({
    padding: '6px 16px', border: 'none',
    borderBottom: activeTab === tab ? '2px solid #1565c0' : '2px solid transparent',
    background: 'none', cursor: 'pointer',
    fontWeight: activeTab === tab ? 700 : 400,
    color: activeTab === tab ? '#1565c0' : '#555', fontSize: '0.85rem'
  });

  const allUsers = useMemo<CollabUser[]>(
    () => meRef.current
      ? [{ ...meRef.current, lastSeen: Date.now() }, ...collabUsers.filter(u => u.id !== meRef.current!.id)]
      : collabUsers,
    [collabUsers]
  );

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <StyledCitiExtensionsWordDocumentWrapper>
      <div style={{ border: '1px solid #ddd', borderRadius: 6, overflow: 'hidden', fontFamily: 'sans-serif' }}>

        {/* ── Document Header ── */}
        <DocumentHeader
          metadata={metadata}
          editingMeta={editingMeta}
          readOnly={readOnly}
          collabEnabled={collabEnabled}
          allUsers={allUsers}
          meRef={meRef}
          wordCount={wordCount}
          uploadStatus={uploadStatus}
          autosaveStatus={autosaveStatus}
          fileInputRef={fileInputRef}
          imageInputRef={imageInputRef}
          setMetadata={setMetadata}
          setEditingMeta={setEditingMeta}
          setReadOnly={setReadOnly}
          handleDocxUpload={handleDocxUpload}
          handleImageUpload={handleImageUpload}
          handleExport={handleExport}
          handleSubmit={handleSubmit}
        />

        {/* ── Typing Indicator ── */}
        {collabEnabled && typingUsers.length > 0 && (
          <div style={{ background: '#e3f2fd', padding: '3px 14px', fontSize: '0.78rem', color: '#1565c0', borderBottom: '1px solid #bbdefb' }}>
            ✏️ <em>{typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing…</em>
          </div>
        )}

        {/* ── Tabs ── */}
        <div style={{ borderBottom: '1px solid #ddd', display: 'flex', background: '#fafafa' }}>
          {(['editor', 'history', 'comments', 'collaborate', 'metadata'] as const).map(tab => (
            <button key={tab} style={tabStyle(tab)} onClick={() => { setActiveTab(tab); setConfirmRestoreId(null); }}>
              {tab === 'collaborate' ? '👥 Collaborate' : tab === 'history' ? '🕓 History' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'history' && revisions.length > 0 && (
                <span style={{ marginLeft: 4, background: '#1565c0', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: '0.72rem' }}>{revisions.length}</span>
              )}
              {tab === 'comments' && comments.length > 0 && (
                <span style={{ marginLeft: 4, background: '#f57c00', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: '0.72rem' }}>{comments.length}</span>
              )}
              {tab === 'collaborate' && collabEnabled && (
                <span style={{ marginLeft: 4, background: '#2e7d32', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: '0.72rem' }}>{allUsers.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* ══════════════ EDITOR TAB ══════════════ */}
        {/* Always keep the editor in the DOM — only toggle visibility via display.
            Unmounting it causes the content-restore useEffect to miss re-mounts. */}
        <div style={{ display: activeTab === 'editor' ? 'block' : 'none' }}>
            <EditorToolbar
              readOnly={readOnly}
              formatState={formatState}
              fontFamily={fontFamily}
              fontSize={fontSize}
              textColor={textColor}
              showFindReplace={showFindReplace}
              showTableDialog={showTableDialog}
              showComments={showComments}
              tableConfig={tableConfig}
              commentsCount={comments.length}
              imageInputRef={imageInputRef}
              saveSelection={saveSelection}
              exec={exec}
              applyHeading={applyHeading}
              applyAlignment={applyAlignment}
              setFontFamily={setFontFamily}
              setFontSize={setFontSize}
              setTextColor={setTextColor}
              setShowFindReplace={setShowFindReplace}
              setShowTableDialog={setShowTableDialog}
              setShowComments={setShowComments}
              setTableConfig={setTableConfig}
              findText={findText}
              replaceText={replaceText}
              setFindText={setFindText}
              setReplaceText={setReplaceText}
              handleFindReplace={handleFindReplace}
              insertTable={insertTable}
              activeTableCell={activeTableCell}
              tableAddRow={tableAddRow}
              tableDeleteRow={tableDeleteRow}
              tableAddCol={tableAddCol}
              tableDeleteCol={tableDeleteCol}
              tableDeleteTable={tableDeleteTable}
            />

            {/* ── Editor + right-gutter markers + Comments panel ── */}
            <div ref={editorWrapperRef} style={{ display: 'flex', alignItems: 'stretch', position: 'relative' }}>

              {/* Editor area */}
              <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                <div
                  ref={editorRef}
                  contentEditable={!readOnly}
                  suppressContentEditableWarning
                  dir="ltr"
                  onInput={() => { updateWordCount(initialHtmlRef); setTimeout(recomputeMarkers, 80); }}
                  onScroll={() => { recomputeMarkers(); setPinRenderTick(t => t + 1); }}
                  onKeyDown={e => handleKeyDown(e, initialHtmlRef)}
                  onKeyUp={() => { saveSelection(); refreshFormatState(); }}
                  onMouseUp={handleMouseUp}
                  onSelect={() => { saveSelection(); refreshFormatState(); }}
                  style={{
                    minHeight: 420, padding: '32px 48px', outline: 'none',
                    fontSize: '14px', fontFamily: 'Georgia', color: '#212121',
                    background: '#fff', lineHeight: 1.8,
                    cursor: readOnly ? 'default' : 'text',
                    direction: 'ltr', unicodeBidi: 'embed', textAlign: 'left'
                  }}
                  data-testid='word-doc-editor'
                />

                {/* ── Floating "Add Comment" bubble (appears near selection) ── */}
                {selectionPos && !readOnly && (
                  <div style={{
                    position: 'absolute',
                    top: selectionPos.top,
                    left: selectionPos.left,
                    zIndex: 200
                  }}>
                    {!showCommentInput ? (
                      <button
                        onMouseDown={e => { e.preventDefault(); setShowCommentInput(true); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          background: '#1565c0', color: '#fff', border: 'none',
                          borderRadius: 20, padding: '5px 14px 5px 10px',
                          fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                          boxShadow: '0 2px 10px rgba(21,101,192,0.30)',
                          whiteSpace: 'nowrap'
                        }}>
                        <span style={{ fontSize: '0.95rem' }}>💬</span> Add comment
                      </button>
                    ) : (
                      <div style={{
                        background: '#fff', border: '1px solid #ddd',
                        borderRadius: 8, padding: 10, width: 260,
                        boxShadow: '0 4px 18px rgba(0,0,0,0.14)'
                      }}>
                        <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: 5 }}>
                          Commenting as <strong style={{ color: '#333' }}>{myNameRef.current}</strong>
                        </div>
                        <textarea
                          autoFocus
                          value={newComment}
                          onChange={e => setNewComment(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); }
                            if (e.key === 'Escape') { setShowCommentInput(false); setNewComment(''); setSelectionPos(null); setPendingSelText(''); }
                          }}
                          placeholder='Add a comment… (Enter to submit, Esc to cancel)'
                          rows={3}
                          style={{
                            width: '100%', fontSize: '0.82rem', padding: '6px 8px',
                            border: '1px solid #ccc', borderRadius: 4, outline: 'none',
                            resize: 'none', fontFamily: 'sans-serif', boxSizing: 'border-box',
                            lineHeight: 1.5
                          }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 6 }}>
                          <button
                            onMouseDown={e => { e.preventDefault(); setShowCommentInput(false); setNewComment(''); setSelectionPos(null); setPendingSelText(''); }}
                            style={{ padding: '3px 10px', border: '1px solid #ddd', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: '0.78rem', color: '#666' }}>
                            Cancel
                          </button>
                          <button
                            onMouseDown={e => { e.preventDefault(); handleAddComment(); }}
                            disabled={!newComment.trim()}
                            style={{
                              padding: '3px 14px', border: 'none', borderRadius: 4,
                              background: newComment.trim() ? '#1565c0' : '#ccc',
                              color: '#fff', cursor: newComment.trim() ? 'pointer' : 'default',
                              fontSize: '0.78rem', fontWeight: 600
                            }}>
                            Comment
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Image comment pins — rendered over each image at the exact click position ── */}
                {comments.filter(c => c.imgId && c.imgX !== undefined && c.imgY !== undefined).map(c => {
                  const img = editorRef.current?.querySelector(`img[data-img-id="${c.imgId}"]`) as HTMLElement | null;
                  if (!img || !editorRef.current) return null;
                  const editorRect = editorRef.current.getBoundingClientRect();
                  const imgRect = img.getBoundingClientRect();
                  // Position relative to the editor div
                  const left = imgRect.left - editorRect.left + (imgRect.width * (c.imgX! / 100));
                  const top = imgRect.top - editorRect.top + (imgRect.height * (c.imgY! / 100));
                  const isActive = activeCommentId === c.id;
                  return (
                    <div
                      key={c.id}
                      title={`${c.author}: ${c.text}`}
                      onClick={() => {
                        setActiveCommentId(c.id);
                        setShowComments(true);
                        setTimeout(() => scrollCardIntoPanel(c.id), 50);
                      }}
                      style={{
                        position: 'absolute',
                        left: left - 10,
                        top: top - 10,
                        width: 20,
                        height: 20,
                        borderRadius: '50% 50% 50% 0',
                        transform: 'rotate(-45deg)',
                        background: isActive ? '#d32f2f' : '#e6a800',
                        border: `2px solid ${isActive ? '#fff' : '#fff'}`,
                        boxShadow: isActive ? '0 0 0 4px rgba(211,47,47,0.45), 0 2px 8px rgba(0,0,0,0.4)' : '0 1px 4px rgba(0,0,0,0.35)',
                        cursor: 'pointer',
                        zIndex: 30,
                        pointerEvents: 'all',
                        transition: 'background 0.15s, box-shadow 0.15s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <span style={{
                        transform: 'rotate(45deg)',
                        fontSize: '9px',
                        lineHeight: 1,
                        userSelect: 'none',
                        color: '#fff',
                        fontWeight: 700,
                      }}>💬</span>
                    </div>
                  );
                })}
              </div>

              {/* ── Right-gutter: comment position markers (absolutely placed inside wrapper) ── */}
              {markerPositions.map(m => {
                const comment = comments.find(c => c.id === m.id);
                if (!comment) return null;
                const isActive = activeCommentId === m.id;
                const replyCount = comment.replies.length;
                return (
                  <button
                    key={m.id}
                    title={`${comment.author}: ${comment.text}${replyCount ? ` · ${replyCount} repl${replyCount === 1 ? 'y' : 'ies'}` : ''}`}
                    onClick={() => {
                      // Just highlight — no scrollIntoView so the page stays put
                      setActiveCommentId(m.id);
                      setShowComments(true);
                    }}
                    style={{
                      position: 'absolute',
                      top: Math.max(0, m.top - 11),
                      right: showComments ? 308 : 4,
                      width: 24, height: 24,
                      borderRadius: '50%',
                      background: isActive ? '#d32f2f' : '#e57373',
                      border: isActive ? '2px solid #b71c1c' : '2px solid #fff',
                      boxShadow: isActive ? '0 0 0 3px rgba(211,47,47,0.35)' : '0 1px 5px rgba(0,0,0,0.22)',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: replyCount > 0 ? '0.6rem' : '0.75rem',
                      fontWeight: 700,
                      color: '#fff',
                      transition: 'all 0.15s',
                      zIndex: 20,
                      padding: 0,
                      lineHeight: 1
                    }}>
                    {replyCount > 0 ? replyCount : '💬'}
                  </button>
                );
              })}

              {/* ── Comments Side Panel ── */}
              {showComments && (
                <CommentsPanel
                  comments={comments}
                  activeCommentId={activeCommentId}
                  replyingTo={replyingTo}
                  replyText={replyText}
                  editorRef={editorRef}
                  commentPanelRef={commentPanelRef}
                  setActiveCommentId={setActiveCommentId}
                  setShowComments={setShowComments}
                  setReplyingTo={setReplyingTo}
                  setReplyText={setReplyText}
                  handleReply={handleReply}
                  handleDeleteComment={handleDeleteComment}
                />
              )}
            </div>

            <div style={{ background: '#e3f2fd', padding: '4px 12px', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#555' }}>
              <span>{readOnly ? '🔒 Read-only mode' : '✏️ Editing'}</span>
              <span>{collabEnabled ? `👥 ${allUsers.length} user${allUsers.length !== 1 ? 's' : ''} online` : '⏳ Connecting…'}</span>
              <span>{wordCount.words} words · {wordCount.chars} characters</span>
            </div>
        </div>

        {/* ══════════════ HISTORY TAB ══════════════ */}
        {activeTab === 'history' && (
          <HistoryTab
            revisions={revisions}
            readOnly={readOnly}
            confirmRestoreId={confirmRestoreId}
            setRevisions={setRevisions}
            setConfirmRestoreId={setConfirmRestoreId}
            handleRestoreVersion={handleRestoreVersion}
            broadcast={broadcast}
          />
        )}

        {/* ══════════════ COMMENTS TAB ══════════════ */}
        {activeTab === 'comments' && (
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text variant='h3'>Comments ({comments.length})</Text>
              {comments.length > 0 && <Button variant='secondary' onClick={() => setComments([])}>Clear All</Button>}
            </div>
            {comments.length === 0 ? (
              <Text style={{ color: '#999' }}>No comments yet. Select text in the editor and add a comment from the bar at the bottom.</Text>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {comments.map(c => (
                  <div key={c.id} style={{ padding: '10px 14px', background: '#fffde7', borderRadius: 6, border: '1px solid #ffe082' }}>
                    {c.selection && (
                      <div style={{ fontSize: '0.78rem', color: '#888', marginBottom: 4, fontStyle: 'italic' }}>
                        Re: "{c.selection.slice(0, 80)}{c.selection.length > 80 ? '…' : ''}"
                      </div>
                    )}
                    <div style={{ fontSize: '0.88rem' }}>{c.text}</div>
                    <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: 4 }}>{c.ts}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════ COLLABORATE TAB ══════════════ */}
        {activeTab === 'collaborate' && (
          <CollaborateTab
            collabEnabled={collabEnabled}
            allUsers={allUsers}
            meRef={meRef}
            myNameRef={myNameRef}
            documentTitle={documentTitle}
          />
        )}

        {/* ══════════════ METADATA TAB ══════════════ */}
        {activeTab === 'metadata' && (
          <MetadataTab
            metadata={metadata}
            readOnly={readOnly}
            wordCount={wordCount}
            comments={comments}
            revisions={revisions}
            collabEnabled={collabEnabled}
            allUsers={allUsers}
            setMetadata={setMetadata}
          />
        )}

      </div>
    </StyledCitiExtensionsWordDocumentWrapper>
  );
}

export default withConfiguration(CitiExtensionsWordDocument);
