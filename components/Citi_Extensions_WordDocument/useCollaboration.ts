/**
 * useCollaboration.ts
 * Manages BroadcastChannel-based real-time collaboration:
 * join/leave session, heartbeat, presence pruning, typing indicators,
 * and broadcasting content / comment / revision snapshots.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import type { CollabUser, CollabMessage, Comment, Revision } from './types';
import { COLLAB_CHANNEL, HEARTBEAT_INTERVAL, USER_TIMEOUT, randomColor } from './helpers';

interface UseCollaborationOptions {
  documentTitle: string;
  myNameRef: React.MutableRefObject<string>;
  meRef: React.MutableRefObject<CollabUser | null>;
  editorRef: React.RefObject<HTMLDivElement>;
  commentsRef: React.MutableRefObject<Comment[]>;
  revisionsRef: React.MutableRefObject<Revision[]>;
  initialHtmlRef: React.MutableRefObject<string>;
  setComments: React.Dispatch<React.SetStateAction<Comment[]>>;
  setRevisions: React.Dispatch<React.SetStateAction<Revision[]>>;
}

export interface CollaborationHandle {
  collabEnabled: boolean;
  collabUsers: CollabUser[];
  typingUsers: string[];
  broadcast: (msg: CollabMessage) => void;
  broadcastContent: () => void;
  handleTypingStart: () => void;
}

export function useCollaboration({
  documentTitle,
  myNameRef,
  meRef,
  editorRef,
  commentsRef,
  revisionsRef,
  initialHtmlRef,
  setComments,
  setRevisions,
}: UseCollaborationOptions): CollaborationHandle {
  const channelName = `${COLLAB_CHANNEL}-${documentTitle.replace(/\s+/g, '-').toLowerCase()}`;

  const channelRef = useRef<BroadcastChannel | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pruneTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [collabEnabled, setCollabEnabled] = useState(false);
  const [collabUsers, setCollabUsers] = useState<CollabUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const broadcast = useCallback((msg: CollabMessage) => {
    channelRef.current?.postMessage(msg);
  }, []);

  const broadcastContent = useCallback(() => {
    if (!collabEnabled || !meRef.current || !editorRef.current) return;
    const html = editorRef.current.innerHTML;
    if (!html || html === '<br>' || html === '<p><br></p>' || html.trim() === '') return;
    broadcast({ type: 'content', html, fromId: meRef.current.id });
  }, [collabEnabled, broadcast, meRef, editorRef]);

  const broadcastTyping = useCallback((isTyping: boolean) => {
    if (!collabEnabled || !meRef.current) return;
    broadcast({ type: 'typing', userId: meRef.current.id, isTyping });
  }, [collabEnabled, broadcast, meRef]);

  const handleTypingStart = useCallback(() => {
    broadcastTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => broadcastTyping(false), 2000);
  }, [broadcastTyping]);

  const joinSession = useCallback((name: string) => {
    const me: CollabUser = {
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      name: name.trim() || 'Anonymous',
      color: randomColor(),
      lastSeen: Date.now(),
    };
    meRef.current = me;
    myNameRef.current = me.name;

    const channel = new BroadcastChannel(channelName);
    channelRef.current = channel;

    channel.onmessage = (evt: MessageEvent<CollabMessage>) => {
      const msg = evt.data;
      switch (msg.type) {
        case 'join':
        case 'heartbeat':
          setCollabUsers(prev => {
            const without = prev.filter(u => u.id !== msg.user.id);
            return [...without, { ...msg.user, lastSeen: Date.now() }];
          });
          if (msg.type === 'join' && meRef.current) {
            channel.postMessage({ type: 'heartbeat', user: { ...meRef.current, lastSeen: Date.now() } } satisfies CollabMessage);
            if (editorRef.current) {
              channel.postMessage({ type: 'content', html: editorRef.current.innerHTML, fromId: meRef.current.id } satisfies CollabMessage);
            }
            channel.postMessage({ type: 'comment', comments: commentsRef.current } satisfies CollabMessage);
            channel.postMessage({ type: 'revision', revisions: revisionsRef.current } satisfies CollabMessage);
          }
          break;
        case 'leave':
          setCollabUsers(prev => prev.filter(u => u.id !== msg.userId));
          break;
        case 'typing':
          setCollabUsers(prev => prev.map(u => u.id === msg.userId ? { ...u, isTyping: msg.isTyping } : u));
          break;
        case 'content':
          if (msg.fromId !== meRef.current?.id && editorRef.current) {
            const wasActive = document.activeElement === editorRef.current;
            editorRef.current.innerHTML = msg.html;
            editorRef.current.setAttribute('dir', 'ltr');
            editorRef.current.querySelectorAll('p,div,li,h1,h2,h3,h4,h5,h6,td,th,blockquote').forEach(el => {
              (el as HTMLElement).setAttribute('dir', 'ltr');
            });
            initialHtmlRef.current = msg.html;
            if (wasActive) editorRef.current.focus();
          }
          break;
        case 'comment':
          setComments(msg.comments);
          break;
        case 'revision':
          setRevisions(msg.revisions);
          break;
      }
    };

    channel.postMessage({ type: 'join', user: me } satisfies CollabMessage);

    heartbeatRef.current = setInterval(() => {
      if (meRef.current) {
        meRef.current.lastSeen = Date.now();
        channel.postMessage({ type: 'heartbeat', user: meRef.current } satisfies CollabMessage);
      }
    }, HEARTBEAT_INTERVAL);

    pruneTimerRef.current = setInterval(() => {
      const cutoff = Date.now() - USER_TIMEOUT;
      setCollabUsers(prev => prev.filter(u => u.lastSeen > cutoff));
    }, HEARTBEAT_INTERVAL);

    setCollabEnabled(true);
  }, [channelName, meRef, myNameRef, editorRef, commentsRef, revisionsRef, setComments, setRevisions, initialHtmlRef]);

  const leaveSession = useCallback(() => {
    if (meRef.current && channelRef.current) {
      channelRef.current.postMessage({ type: 'leave', userId: meRef.current.id } satisfies CollabMessage);
      channelRef.current.close();
      channelRef.current = null;
    }
    if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
    if (pruneTimerRef.current) { clearInterval(pruneTimerRef.current); pruneTimerRef.current = null; }
    meRef.current = null;
    setCollabEnabled(false);
    setCollabUsers([]);
    setTypingUsers([]);
  }, [meRef]);

  // Auto-join on mount, auto-leave on unmount
  useEffect(() => {
    joinSession(myNameRef.current);
    return () => leaveSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derive typingUsers from collabUsers
  useEffect(() => {
    const names = collabUsers
      .filter(u => u.isTyping && u.id !== meRef.current?.id)
      .map(u => u.name);
    setTypingUsers(names);
  }, [collabUsers, meRef]);

  return { collabEnabled, collabUsers, typingUsers, broadcast, broadcastContent, handleTypingStart };
}
