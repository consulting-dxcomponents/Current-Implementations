// ─── Shared types for Citi_Extensions_WordDocument ───────────────────────────

export interface DocMetadata {
  title: string;
  author: string;
  subject: string;
  createdAt: string;
}

export interface CommentReply {
  id: string;
  author: string;
  text: string;
  ts: string;
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  selection: string;
  ts: string;
  replies: CommentReply[];
  imgId?: string;   // set when comment is attached to an image
  imgX?: number;    // click position as % of image width
  imgY?: number;    // click position as % of image height
}

/** Audit-style revision: one entry per debounced edit burst, not per keystroke */
export interface Revision {
  id: string;
  author: string;
  summary: string;
  added: string;
  removed: string;
  wordsBefore: number;
  wordsAfter: number;
  ts: string;
  /** Full HTML snapshot stored so the user can restore this version */
  html?: string;
}

export interface TableConfig {
  rows: number;
  cols: number;
}

// ─── Collaboration ────────────────────────────────────────────────────────────

export interface CollabUser {
  id: string;
  name: string;
  color: string;
  lastSeen: number;
  isTyping?: boolean;
}

export type CollabMessage =
  | { type: 'join';      user: CollabUser }
  | { type: 'leave';     userId: string }
  | { type: 'heartbeat'; user: CollabUser }
  | { type: 'typing';    userId: string; isTyping: boolean }
  | { type: 'content';   html: string; fromId: string }
  | { type: 'comment';   comments: Comment[] }
  | { type: 'revision';  revisions: Revision[] };
