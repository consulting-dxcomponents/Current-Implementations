# Citi_Extensions_WordDocument

A fully-featured, browser-based **rich text document editor** built as a Pega Constellation DX Component. It provides a Word-like editing experience inside any Pega case or portal, with real-time multi-user collaboration, inline commenting, version history, `.docx` import/export, and seamless persistence to Pega data structures.

---

## Table of Contents

1. [Features](#features)
2. [Architecture Overview](#architecture-overview)
3. [File Structure](#file-structure)
4. [Module Responsibilities](#module-responsibilities)
5. [Dependencies & Libraries](#dependencies--libraries)
6. [Pega Data Integration](#pega-data-integration)
7. [Component Props](#component-props)
8. [Usage in a Pega Application](#usage-in-a-pega-application)
9. [Real-Time Collaboration](#real-time-collaboration)
10. [Comments System](#comments-system)
11. [Version History](#version-history)
12. [Export to .docx](#export-to-docx)
13. [Extending the Component](#extending-the-component)
14. [Developer Notes](#developer-notes)

---

## Features

| Feature | Description |
|---|---|
| **Rich Text Editing** | Contenteditable `div` with full formatting: bold, italic, underline, strikethrough, font family/size, text/highlight colour, alignment, lists, indent, blockquote |
| **Table Support** | Insert and delete tables; add/remove rows and columns via toolbar or context actions |
| **Image Embedding** | Paste images from clipboard; insert via toolbar; images are stored as base-64 data-URLs |
| **Inline Comments** | Select text (or click an image), add a threaded comment. Marker pins appear in the margin aligned to the commented text |
| **Version History** | Debounced auto-save creates audit revision entries (word-count delta, diff snippet, full HTML snapshot). Any version can be restored with one click |
| **Real-Time Collaboration** | `BroadcastChannel` API syncs document content, comments, and revisions between tabs/windows on the same origin. User presence (coloured avatars, typing indicators) is shown live |
| **Import .docx** | Upload a `.docx` file; `mammoth.js` converts it to HTML and loads it into the editor |
| **Export .docx** | Converts the current editor DOM to a genuine `.docx` file (tables, images, headings, inline styles) using the `docx` library |
| **Document Metadata** | Title, author, subject, and creation date fields; author change syncs to collaboration presence name |
| **Auto-Save to Pega** | Every edit burst is debounced and saved to a Pega field via `actions.updateFieldValue` |
| **Read-Only Mode** | Toggle between edit and view-only mode; formatting toolbar is hidden in read-only mode |
| **LTR Enforcement** | All block-level elements are stamped with `dir="ltr"` on mount and on paste to prevent RTL layout corruption |

---

## Architecture Overview

```
index.tsx  (orchestrator, ~600 lines)
│
├── UI Panels
│   ├── DocumentHeader.tsx     — top blue bar, avatars, file actions
│   ├── EditorToolbar.tsx      — formatting toolbar + dialogs
│   ├── CommentsPanel.tsx      — comment/reply sidebar
│   ├── HistoryTab.tsx         — version history list + restore
│   ├── CollaborateTab.tsx     — collaboration session controls
│   └── MetadataTab.tsx        — document metadata form
│
├── Custom Hooks
│   ├── useCollaboration.ts    — BroadcastChannel presence + sync
│   ├── useAutoSave.ts         — debounced save + revision audit
│   ├── usePegaPersistence.ts  — read/write Pega Page Lists
│   ├── useCommentActions.ts   — add / reply / delete comments
│   ├── useMarkers.ts          — calculate comment pin positions
│   ├── useEditorSetup.ts      — CSS injection, LTR observer, mount load
│   ├── useEditorInput.ts      — input/paste/keydown event handlers
│   ├── useEditorMouseUp.ts    — mouseup → show comment bubble
│   ├── useDocxUpload.ts       — mammoth.js .docx import
│   └── useTableActions.ts     — insert table, row, column, delete
│
└── Utilities / Config
    ├── types.ts               — shared TypeScript interfaces
    ├── helpers.ts             — pure functions (wordCount, textDiff, etc.)
    ├── exportDocx.ts          — DOM → .docx converter
    ├── styles.ts              — styled-components wrapper
    ├── ToolbarComponents.tsx  — atomic toolbar button primitives
    ├── create-nonce.ts        — CSP nonce helper for style injection
    └── config.json            — Pega component manifest
```

The component is intentionally an **orchestrator**: it holds all shared state and refs, then distributes them as props into smaller, single-responsibility components and hooks.

---

## File Structure

```
src/components/Citi_Extensions_WordDocument/
├── index.tsx                  ← Main component entry point
├── types.ts                   ← Shared TypeScript types
├── helpers.ts                 ← Pure utility functions & constants
├── styles.ts                  ← Styled-components CSS wrapper
├── config.json                ← Pega DX component manifest
├── mock.ts                    ← Storybook / Jest mock props
├── demo.stories.tsx           ← Storybook stories
├── create-nonce.ts            ← CSP nonce for injected <style> tags
├── localizations.json         ← i18n strings (reserved for future use)
│
├── — UI Components —
├── DocumentHeader.tsx
├── EditorToolbar.tsx
├── CommentsPanel.tsx
├── HistoryTab.tsx
├── CollaborateTab.tsx
├── MetadataTab.tsx
├── ToolbarComponents.tsx
│
├── — Custom Hooks —
├── useAutoSave.ts
├── useCollaboration.ts
├── useCommentActions.ts
├── useDocxUpload.ts
├── useEditorInput.ts
├── useEditorMouseUp.ts
├── useEditorSetup.ts
├── useMarkers.ts
├── usePegaPersistence.ts
├── useTableActions.ts
│
└── — Utilities —
    └── exportDocx.ts
```

---

## Module Responsibilities

### `index.tsx`
The root component. Owns all shared state (`comments`, `revisions`, `metadata`, `readOnly`, `activeTab`, etc.) and refs (`editorRef`, `meRef`, `myNameRef`, …). Instantiates every hook and passes results to child panels. Acts as the single source of truth.

### `DocumentHeader.tsx`
Renders the top blue application bar containing:
- Document title (from metadata)
- Auto-save status badge (`saved` / `saving` / `unsaved`)
- Coloured avatar circles for each collaboration presence user
- "Typing…" label when a peer is typing
- **Download .docx** button
- **Upload .docx** button (triggers hidden `<input type="file">`)
- **Read-only toggle** lock icon

### `EditorToolbar.tsx`
The full formatting toolbar. Contains:
- Font family and font size selectors
- Bold, italic, underline, strikethrough buttons
- Text colour and highlight colour pickers (`<input type="color">`)
- Text alignment buttons (left, centre, right, justify)
- List buttons (ordered / unordered)
- Indent / outdent
- Blockquote
- Insert link dialog
- Insert table dialog (rows × cols grid)
- Insert image from file
- Undo / redo

All buttons call `document.execCommand(...)` or dispatch custom DOM mutations on the `editorRef`.

### `CommentsPanel.tsx`
Renders the collapsible right-hand sidebar that shows all comments and their replies:
- Scrollable list of comment cards
- Each card shows author, timestamp, highlighted selection excerpt, and threaded replies
- "Delete comment" button (author or any user)
- Reply input box (expands inline)
- Empty-state message when no comments exist

### `HistoryTab.tsx`
Renders the version history list:
- Each revision shows author, timestamp, word count delta (`+3 words`), diff snippet (added/removed text)
- **Restore** button replaces current editor HTML with the saved snapshot
- A `MAX_REVISIONS` cap (default 50) prevents unbounded growth

### `CollaborateTab.tsx`
Renders the real-time collaboration panel:
- **Start / Stop session** button (opens / closes `BroadcastChannel`)
- List of currently online users with coloured avatars and last-seen timestamps
- Status text ("You are online as …")
- Typing indicator list

### `MetadataTab.tsx`
Renders editable document metadata:
- Title, Author, Subject, Created At fields
- Edit / Save toggle
- Changing the **Author** field is propagated back to `myNameRef` and `meRef.current.name` so comments and collaboration presence reflect the new name immediately

### `useCollaboration.ts`
Manages the entire `BroadcastChannel` session lifecycle:
- Generates a random colour and user ID for the current user on join
- Sends `join`, `leave`, `heartbeat`, `typing`, `content`, `comment`, and `revision` messages
- Prunes users who have not sent a heartbeat within `USER_TIMEOUT` (15 s)
- Returns `{ collabEnabled, collabUsers, typingUsers, broadcast, broadcastContent, handleTypingStart }`

### `useAutoSave.ts`
- Debounces every editor `input` event (1 500 ms default) before saving
- On save: calls `actions.updateFieldValue(propName, html)` to persist to Pega
- Computes word-count delta and text diff via `helpers.ts`
- Appends a `Revision` entry and broadcasts it to collaborators
- Exposes `triggerSave`, `handleVersionRestore`, and `handleSubmit`

### `usePegaPersistence.ts`
Two hooks — `usePersistComments` and `usePersistVersions` — that write structured data to Pega embedded Page Lists using the PConnect Actions API (`addItem`, `deleteItem`, `updateFieldValue`). Full-replace strategy: existing items are deleted then re-written on every save. Errors are silently swallowed so a Pega config mismatch never crashes the editor.

### `useCommentActions.ts`
- `makeAddComment` — creates a new comment, highlights the selected DOM range with a `<mark>` element, assigns a stable ID, and persists via `persistComments`
- `useHandleReply` — appends a reply to an existing comment
- `useHandleDeleteComment` — removes a comment and its `<mark>` highlight from the DOM

### `useMarkers.ts`
After comments change, recalculates the vertical `top` offset of each comment marker pin so they align with the corresponding `<mark>` in the editor.

### `useEditorSetup.ts`
- Injects a `<style>` tag with editor-specific CSS (list styles, placeholder, selection colour, typing cursor)
- Attaches a `MutationObserver` to enforce `dir="ltr"` on dynamically added nodes
- Loads the initial HTML (from Pega prop value or default placeholder) on mount

### `useEditorInput.ts`
Handles `input`, `paste`, and `keydown` events:
- `input` → triggers debounced auto-save and collaboration broadcast
- `paste` → sanitises pasted HTML; converts external images to base-64 data-URLs
- `keydown` → intercepts `Tab` to insert non-breaking spaces instead of moving focus

### `useEditorMouseUp.ts`
On `mouseup` inside the editor: if the user has a non-empty text selection, computes pixel coordinates and shows the "Add Comment" bubble at the cursor position.

### `useDocxUpload.ts`
Accepts a `.docx` `File`, passes it to `mammoth.convertToHtml`, sanitises the result, stamps `dir="ltr"` on every block element, and loads it into the editor.

### `useTableActions.ts`
`createTableActions` factory returns:
- `insertTable(rows, cols)` — injects a styled HTML `<table>` at the cursor
- `insertRowBelow` / `deleteRow` — DOM table-row manipulation
- `insertColumnRight` / `deleteColumn` — DOM table-column manipulation

### `exportDocx.ts`
Walks the editor's `innerHTML` DOM tree recursively, translating HTML nodes to `docx` library objects (`Paragraph`, `TextRun`, `HeadingLevel`, `Table`, `TableRow`, `TableCell`, `ImageRun`). Handles inline styles (bold, italic, underline, colour, alignment). Calls `Packer.toBlob` and triggers a browser download.

### `helpers.ts`
Pure utility functions with no side effects:
| Export | Purpose |
|---|---|
| `COLLAB_CHANNEL` | BroadcastChannel name prefix |
| `HEARTBEAT_INTERVAL` | 5 000 ms between heartbeats |
| `USER_TIMEOUT` | 15 000 ms before user is pruned |
| `MAX_REVISIONS` | Maximum revision entries kept (50) |
| `USER_COLORS` | Palette of 8 avatar colours |
| `randomColor()` | Pick a random colour from the palette |
| `initials(name)` | Extract up to 2 initials from a display name |
| `wordCountOf(text)` | Whitespace-split word count |
| `textDiff(before, after)` | Extract added/removed text regions |
| `stampLtr(el)` | Set `dir="ltr"` on all block descendants |
| `offsetTopRelativeTo(el, ancestor)` | Traverse `offsetParent` chain for vertical position |

### `types.ts`
Exported TypeScript interfaces shared across all modules:
- `DocMetadata` — title, author, subject, createdAt
- `Comment` / `CommentReply` — comment thread structure
- `Revision` — audit entry with full HTML snapshot
- `TableConfig` — rows × cols
- `CollabUser` — id, name, color, lastSeen, isTyping
- `CollabMessage` — discriminated union of all BroadcastChannel message types

---

## Dependencies & Libraries

| Library | Version | Purpose |
|---|---|---|
| `react` | ^18 | UI rendering, hooks |
| `@pega/cosmos-react-core` | Platform | `Text`, `Button`, `withConfiguration`, styled system |
| `docx` | ^8 | Generate genuine `.docx` files from JavaScript |
| `mammoth` | ^1 | Convert uploaded `.docx` files to HTML |
| `styled-components` | ^6 | Component-scoped CSS via `StyledCitiExtensionsWordDocumentWrapper` |

All other editor functionality (contenteditable, execCommand, BroadcastChannel, FileReader, Clipboard API) is standard Web Platform APIs — no additional runtime dependencies.

### Dev Dependencies
| Library | Purpose |
|---|---|
| `typescript` | Type checking |
| `jest` / `@testing-library/react` | Unit and component tests |
| `@storybook/react` | Interactive component stories (`demo.stories.tsx`) |
| `unbuild` | Library bundling (`build.config.json`) |

---

## Pega Data Integration

### Main Document Field
The HTML content of the editor is stored in a single Pega field (typically a **Text (Long)** property). The field path is supplied by the Pega runtime via `pConn.getStateProps().value` (`propName`). Every debounced save calls:

```typescript
actions.updateFieldValue(propName, editorRef.current.innerHTML);
```

### Comments Page List (`commentsPropName`)
Map this prop to a **Page List** property backed by the `Data-WordComment` data class. Expected fields:

| Pega Field | Type | Maps To |
|---|---|---|
| `CommentID` | Text | `comment.id` |
| `Author` | Text | `comment.author` |
| `CommentText` | Text (Long) | `comment.text` |
| `Selection` | Text | `comment.selection` (quoted text) |
| `Timestamp` | Text | `comment.ts` (ISO string) |
| `ImgID` | Text | `comment.imgId` (optional, for image comments) |
| `ImgX` | Text | `comment.imgX` (click X as % of image width) |
| `ImgY` | Text | `comment.imgY` (click Y as % of image height) |
| `Replies` (Page List) | | Each reply has `ReplyID`, `Author`, `ReplyText`, `Timestamp` |

### Versions Page List (`versionsPropName`)
Map this prop to a **Page List** property backed by the `Data-WordVersion` data class. Expected fields:

| Pega Field | Type | Maps To |
|---|---|---|
| `VersionID` | Text | `revision.id` |
| `Author` | Text | `revision.author` |
| `Summary` | Text | `revision.summary` |
| `Added` | Text (Long) | `revision.added` |
| `Removed` | Text (Long) | `revision.removed` |
| `WordsBefore` | Integer | `revision.wordsBefore` |
| `WordsAfter` | Integer | `revision.wordsAfter` |
| `Timestamp` | Text | `revision.ts` |
| `HtmlSnapshot` | Text (Long) | `revision.html` |

> **Note:** Both Page Lists use a **full-replace write strategy** — all existing rows are deleted and re-written on each save. This is intentional to guarantee consistency between the in-memory state and Pega storage.

---

## Component Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `getPConnect` | `() => PConnect` | *(required)* | Pega PConnect factory — supplied automatically by the Constellation runtime |
| `documentTitle` | `string` | `'Untitled Document'` | Initial document title shown in the header and used as BroadcastChannel namespace |
| `authorName` | `string` | `''` | Display name for the current user. Shown in comment authors and collaboration presence. Falls back to a random `User-xxxx` identifier |
| `initialReadOnly` | `boolean` | `false` | Start in read-only mode if `true` |
| `commentsPropName` | `string` | `undefined` | Dot-prefixed Pega Page List prop name for comments persistence (e.g. `".DocumentComments"`) |
| `versionsPropName` | `string` | `undefined` | Dot-prefixed Pega Page List prop name for version history persistence (e.g. `".DocumentVersions"`) |

---

## Usage in a Pega Application

1. **Register the component** — ensure `Citi_Extensions_WordDocument` is listed in your Constellation DX component library and the `config.json` manifest is published.

2. **Add a field to your data model**:
   - A `Text (Long)` field to hold HTML content (e.g. `DocumentContent`)
   - Optionally, a Page List for `DocumentComments` and `DocumentVersions`

3. **Configure in App Studio**:
   - Add the component to a section or view
   - Map the primary property to `DocumentContent`
   - Set `documentTitle`, `authorName` (can be mapped to `pyUserName`), `commentsPropName`, `versionsPropName`

4. **Author name best practice** — bind `authorName` to the operator's full name property (e.g. `pyOperator.pyFullName`) so collaboration presence and comment attribution are automatically correct.

---

## Real-Time Collaboration

Collaboration uses the browser's built-in [`BroadcastChannel` API](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel) to communicate between tabs/windows on the **same origin**.

- The channel name is derived from the document title: `word-doc-collab-<slugified-title>`
- Each user gets a random UUID, a random colour, and uses `authorName` (or the metadata author) as their display name
- Messages are JSON-serialised and broadcast on every edit, comment change, and revision update
- A heartbeat interval (5 s) keeps presence alive; users who miss 3 heartbeats (15 s) are pruned from the presence list
- **Cross-machine collaboration is not supported** — BroadcastChannel is same-origin, same-browser only. For true cross-user real-time sync, replace `useCollaboration.ts` with a WebSocket or Server-Sent Events transport

### Updating the author name
When a user changes their name in the **Metadata** tab, the change is propagated to:
1. `myNameRef.current` — used for all new comment authors
2. `meRef.current.name` — used for collaboration presence messages

This ensures the new name is reflected immediately in the collaboration panel and in any subsequent comments.

---

## Comments System

1. **Selecting text** — any text selection in the editor triggers a floating "Add Comment" bubble
2. **Clicking an image** — image clicks show a comment pin at the click position
3. **Adding a comment** — the selected DOM range is wrapped in a `<mark data-comment-id="…">` element; the comment is added to state, persisted to Pega, and broadcast to collaborators
4. **Marker pins** — after comments update, `useMarkers` recalculates `offsetTop` for each `<mark>` and renders a vertical pin in the margin
5. **Replies** — each comment card in the panel has an inline reply form
6. **Deletion** — removes the comment from state, unwraps the `<mark>` element from the DOM, and re-persists

---

## Version History

- Every debounced save (1.5 s after the last keystroke) creates a `Revision` entry
- The entry stores: author, timestamp, word count before/after, a word-level diff excerpt, and a **full HTML snapshot**
- The **Restore** button sets `editorRef.current.innerHTML` to the snapshot and triggers a new save
- Revisions are capped at `MAX_REVISIONS` (50) — oldest entries are dropped when the cap is exceeded
- The full list is persisted to the `versionsPropName` Pega Page List

---

## Export to .docx

`exportDocx.ts` walks the editor's live DOM and produces a `.docx` file using the `docx` npm library. Supported elements:

| HTML | .docx equivalent |
|---|---|
| `<p>`, `<div>` | `Paragraph` |
| `<h1>`–`<h6>` | `HeadingLevel.HEADING_1`–`6` |
| `<strong>`, `<b>` | `bold: true` |
| `<em>`, `<i>` | `italics: true` |
| `<u>` | `underline: { type: 'single' }` |
| `<s>`, `<strike>` | `strike: true` |
| `<ul>` / `<ol>` / `<li>` | Bullet / numbered `Paragraph` |
| `<table>`, `<tr>`, `<td>`, `<th>` | `Table`, `TableRow`, `TableCell` |
| `<img>` (data-URL) | `ImageRun` (PNG/JPG/GIF/BMP) |
| `style="text-align:…"` | `AlignmentType` |
| `style="color:…"` | `color` on `TextRun` |

---

## Extending the Component

### Adding a new toolbar button
1. Add the button JSX to `EditorToolbar.tsx`
2. Call `document.execCommand('yourCommand')` or directly mutate `editorRef.current`
3. If state is needed, add it to `index.tsx` and pass it as a prop

### Adding a new tab panel
1. Add a new tab value to the `activeTab` union type in `index.tsx`
2. Create a new `MyTab.tsx` file following the pattern of `HistoryTab.tsx`
3. Add the tab button in the tab bar section of `index.tsx`
4. Render `<MyTab … />` conditionally in the tab content area

### Replacing BroadcastChannel with WebSockets
1. Open `useCollaboration.ts`
2. Replace `new BroadcastChannel(…)` with your WebSocket client
3. Map incoming WebSocket messages to the same `CollabMessage` discriminated union
4. The rest of the component is unaffected

### Adding .docx export for comments
Extend `exportDocx.ts` to accept the `comments` array and append a "Comments" section after the main content using standard `docx` `Paragraph` objects.

---

## Developer Notes

- **No `execCommand` deprecation workaround** — `document.execCommand` is still the most compatible way to drive a `contenteditable` editor without a full framework (ProseMirror, TipTap, etc.). It is deprecated in the spec but all major browsers continue to support it.
- **Base-64 images** — all images are stored inline as data-URLs. For large images or many users this can make the Pega field value very large. Consider adding an image upload service and storing URLs instead.
- **`MAX_REVISIONS = 50`** — change this constant in `helpers.ts` if you need a longer or shorter audit trail.
- **CSP** — `create-nonce.ts` generates a nonce value for the injected `<style>` tag. Ensure your Pega portal's CSP `style-src` directive includes `'nonce-…'` or `'unsafe-inline'` to allow it.
- **Testing** — each hook can be tested independently using `renderHook` from `@testing-library/react`. Mock `actions.updateFieldValue` and `actions.addItem` with `jest.fn()`.
- **Storybook** — run `npm run storybook` and open `Citi_Extensions_WordDocument` to preview the component with mock Pega props from `mock.ts`.
