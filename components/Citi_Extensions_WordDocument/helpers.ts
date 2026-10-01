// ─── Pure utility helpers ─────────────────────────────────────────────────────

export const COLLAB_CHANNEL = 'word-doc-collab';
export const HEARTBEAT_INTERVAL = 5000;
export const USER_TIMEOUT = 15000;
export const MAX_REVISIONS = 50;

export const USER_COLORS = [
  '#1565c0', '#6a1b9a', '#c62828', '#2e7d32',
  '#e65100', '#00695c', '#4527a0', '#37474f',
];

export function randomColor(): string {
  return USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
}

export function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
}

export function wordCountOf(text: string): number {
  const t = text.trim();
  return t === '' ? 0 : t.split(/\s+/).length;
}

/** Extract the changed region between two plain-text snapshots. */
export function textDiff(before: string, after: string): { added: string; removed: string } {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let end = 0;
  while (
    end < before.length - start &&
    end < after.length - start &&
    before[before.length - 1 - end] === after[after.length - 1 - end]
  ) end++;
  const removed = before.slice(start, before.length - end).trim();
  const added   = after.slice(start, after.length - end).trim();
  return { removed, added };
}

/** Stamp dir="ltr" on an element and all its block descendants. */
export function stampLtr(el: HTMLElement): void {
  const BLOCK_TAGS = ['p','div','li','h1','h2','h3','h4','h5','h6','td','th','blockquote'];
  el.setAttribute('dir', 'ltr');
  el.querySelectorAll(BLOCK_TAGS.join(',')).forEach(child => {
    (child as HTMLElement).setAttribute('dir', 'ltr');
  });
}

/** Walk up offsetParent chain summing offsetTop until ancestor is reached. */
export function offsetTopRelativeTo(el: HTMLElement, ancestor: HTMLElement): number {
  let top = 0;
  let cur: HTMLElement | null = el;
  while (cur && cur !== ancestor) {
    top += cur.offsetTop;
    cur = cur.offsetParent as HTMLElement | null;
  }
  return top;
}

/** Returns the first Text node inside a DOM subtree. */
export function firstTextNode(el: Node): Text | null {
  if (el.nodeType === Node.TEXT_NODE) return el as Text;
  for (const child of Array.from(el.childNodes)) {
    const found = firstTextNode(child);
    if (found) return found;
  }
  return null;
}

/** Returns the last Text node inside a DOM subtree. */
export function lastTextNode(el: Node): Text | null {
  if (el.nodeType === Node.TEXT_NODE) return el as Text;
  for (const child of Array.from(el.childNodes).reverse()) {
    const found = lastTextNode(child);
    if (found) return found;
  }
  return null;
}

/** Inline style applied to comment badge <sup> elements inside the editor. */
export const BADGE_CSS =
  'font-size:0.62rem;line-height:1;padding:1px 3px;border-radius:8px;' +
  'background:#e6a800;color:#fff;font-weight:700;cursor:pointer;' +
  'vertical-align:super;margin-left:1px;user-select:none;';
