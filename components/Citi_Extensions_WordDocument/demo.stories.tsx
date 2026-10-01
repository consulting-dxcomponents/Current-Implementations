// @ts-nocheck
import type { Meta, StoryObj } from '@storybook/react';

import CitiExtensionsWordDocument from './index';
import { configProps } from './mock';
import { WordDocumentDocs } from './WordDocumentDocs';

const meta: Meta<typeof CitiExtensionsWordDocument> = {
  title: 'CitiExtensionsWordDocument',
  component: CitiExtensionsWordDocument,
  tags: ['autodocs'],
  excludeStories: /.*Data$/,
  parameters: {
    docs: {
      // Replace the default autodocs page with our custom README-first docs page
      page: WordDocumentDocs,
    },
  },
  argTypes: {
    documentTitle: {
      description: 'Title shown in the blue header bar and used as the BroadcastChannel namespace for real-time collaboration.',
      control: { type: 'text' },
      table: { defaultValue: { summary: 'Untitled Document' } },
    },
    authorName: {
      description:
        'Display name for the current user. Used as comment author and collaboration presence label. Falls back to a random `User-xxxx` identifier if blank. Bind to `pyOperator.pyFullName` in production.',
      control: { type: 'text' },
      table: { defaultValue: { summary: '' } },
    },
    initialReadOnly: {
      description: 'When `true` the editor starts in read-only mode — formatting toolbar is hidden and content is not editable.',
      control: { type: 'boolean' },
      table: { defaultValue: { summary: 'false' } },
    },
    commentsPropName: {
      description:
        'Dot-prefixed Pega Page List property name backed by `Data-WordComment` (e.g. `".DocumentComments"`). Comments are read on mount and written on every change. Leave blank to keep comments in-session only.',
      control: { type: 'text' },
      table: { defaultValue: { summary: 'undefined' } },
    },
    versionsPropName: {
      description:
        'Dot-prefixed Pega Page List property name backed by `Data-WordVersion` (e.g. `".DocumentVersions"`). Versions are read on mount and written on every save. Leave blank to keep version history in-session only.',
      control: { type: 'text' },
      table: { defaultValue: { summary: 'undefined' } },
    },
    getPConnect: {
      description:
        'Pega PConnect factory function — supplied automatically by the Constellation runtime. In Storybook this is replaced by an in-memory mock that simulates `updateFieldValue`, `addItem`, and `deleteItem`.',
      control: false,
    },
  },
};

export default meta;
type Story = StoryObj<typeof CitiExtensionsWordDocument>;

// ─── In-memory stores that simulate Pega embedded Page List fields ────────────
// Each store is keyed by property name and holds an array of plain objects
// (matching the shapes of Data-WordComment and Data-WordVersion).

function makeMockStore() {
  const store: Record<string, any[]> = {
    '.DocumentComments': [],
    '.DocumentVersions': [],
  };
  let fieldValues: Record<string, string> = {
    '.DocumentContent': '',
  };

  // Helper: given a path like ".DocumentComments(Last).Author" resolve the target
  // object and field, mutating the store array in place.
  function applyUpdate(path: string, value: string) {
    // Plain scalar field (e.g. ".DocumentContent")
    if (!path.includes('(')) {
      fieldValues[path] = value;
      return;
    }

    // Page list field e.g. ".DocumentComments(Last).Author"
    const match = path.match(/^(\.[^(]+)\((\w+)\)\.(.+)$/);
    if (!match) return;
    const [, listProp, indexToken, fieldName] = match;

    if (!store[listProp]) return;
    const list = store[listProp];
    const idx = indexToken === 'Last' ? list.length - 1 : Number(indexToken) - 1;
    if (idx < 0 || idx >= list.length) return;

    // Support nested path: "Replies(Last).ReplyText"
    const nestedMatch = fieldName.match(/^(\w+)\((\w+)\)\.(.+)$/);
    if (nestedMatch) {
      const [, nestedList, nestedToken, nestedField] = nestedMatch;
      if (!list[idx][nestedList]) list[idx][nestedList] = [];
      const nested = list[idx][nestedList];
      const ni = nestedToken === 'Last' ? nested.length - 1 : Number(nestedToken) - 1;
      if (ni >= 0) nested[ni][nestedField] = value;
    } else {
      list[idx][fieldName] = value;
    }
  }

  return {
    getValue: (prop: string) => {
      if (prop in store) return store[prop];
      return fieldValues[prop] ?? '';
    },
    getActionsApi: () => ({
      updateFieldValue: (path: string, value: string) => {
        applyUpdate(path, value);
      },
      triggerFieldChange: () => { /* no-op */ },
      addItem: (listProp: string) => {
        if (!store[listProp]) store[listProp] = [];
        store[listProp].push({});
      },
      deleteItem: (listProp: string, { index }: { index: number }) => {
        if (!store[listProp]) return;
        store[listProp].splice(index - 1, 1); // Pega uses 1-based index
      },
    }),
  };
}

// ─── Base getPConnect factory ─────────────────────────────────────────────────
function makePConnect(store: ReturnType<typeof makeMockStore>) {
  return () => ({
    getStateProps: () => ({ value: '.DocumentContent', hasSuggestions: false }),
    getValue: store.getValue,
    getActionsApi: store.getActionsApi,
    getComponentName: () => '',
    getLocalizedValue: (value: string) => value,
    getRawMetadata: () => ({}),
    getChildren: () => [],
    ignoreSuggestion: () => { /* no-op */ },
    acceptSuggestion: () => { /* no-op */ },
    setInheritedProps: () => { /* no-op */ },
    resolveConfigProps: () => { /* no-op */ },
  });
}

// ─── Pre-seeded store: two comments + two versions ────────────────────────────
function makeSeededStore() {
  const s = makeMockStore();
  const store = s.getValue as any;

  // Seed comments directly into the in-memory list
  (s.getValue('.DocumentComments') as any[]).push(
    {
      CommentID: 'c1',
      Author: 'Alice',
      CommentText: 'This paragraph needs more detail.',
      Selection: 'needs more detail',
      Timestamp: '9:00 AM',
      ImgID: '',
      ImgX: '',
      ImgY: '',
      Replies: [
        { ReplyID: 'r1', Author: 'Bob', ReplyText: "Agreed, I'll expand it.", Timestamp: '9:05 AM' },
      ],
    },
    {
      CommentID: 'c2',
      Author: 'Bob',
      CommentText: 'Please check the figures in this section.',
      Selection: 'figures in this section',
      Timestamp: '9:10 AM',
      ImgID: '',
      ImgX: '',
      ImgY: '',
      Replies: [],
    }
  );

  // Seed two previous versions
  (s.getValue('.DocumentVersions') as any[]).push(
    {
      VersionID: 'v1',
      Author: 'Alice',
      Summary: '+12 words',
      HtmlSnapshot: '<p dir="ltr"><strong>Draft v1</strong> — initial content saved by Alice.</p>',
      WordsBefore: '0',
      WordsAfter: '12',
      Timestamp: '8:55 AM',
    },
    {
      VersionID: 'v2',
      Author: 'Bob',
      Summary: '+8 words',
      HtmlSnapshot: '<p dir="ltr"><strong>Draft v2</strong> — Bob added the executive summary section.</p><p dir="ltr">Executive summary: Lorem ipsum dolor sit amet.</p>',
      WordsBefore: '12',
      WordsAfter: '20',
      Timestamp: '9:02 AM',
    }
  );

  return s;
}

// ─── Stories ──────────────────────────────────────────────────────────────────

/**
 * ### Base — blank document
 *
 * The default out-of-the-box experience: a blank document with all tabs
 * (Editor, Comments, History, Collaborate, Metadata) available.
 *
 * - **Author** is set to `"Citi User"` via the `authorName` prop.
 * - Comments and versions are wired to the in-memory mock Page Lists
 *   (`.DocumentComments` / `.DocumentVersions`).
 * - Start typing to see the auto-save status badge change in the header.
 * - Select any text to see the floating **Add Comment** bubble.
 * - Open the **History** tab after a few edits to see audit revision entries.
 * - Open the **Collaborate** tab to view the live presence panel.
 */
export const BaseCitiExtensionsWordDocument: Story = {
  name: 'Base (blank document)',
  args: {
    ...configProps,
    getPConnect: makePConnect(makeMockStore()),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Blank editor with all features active. Interact with the toolbar, select text to add a comment, or switch tabs to explore the full feature set.',
      },
    },
  },
};

/** Read-only view — toolbar hidden, Restore buttons hidden */
export const ReadOnlyMode: Story = {
  name: 'Read-Only Mode',
  args: {
    ...configProps,
    documentTitle: 'Read-Only Document',
    initialReadOnly: true,
    getPConnect: makePConnect(makeMockStore()),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Sets `initialReadOnly: true`. The formatting toolbar is hidden and the editor\'s `contenteditable` attribute is `false`. The lock icon in the header can toggle back to edit mode at runtime.',
      },
    },
  },
};

/** Custom author name surfaced in comment attribution and collaboration panel */
export const CustomAuthor: Story = {
  name: 'Custom Author Name',
  args: {
    ...configProps,
    documentTitle: 'Citi Annual Report 2026',
    authorName: 'Jane Smith',
    getPConnect: makePConnect(makeMockStore()),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Passes a custom `authorName`. In production, bind this to `pyOperator.pyFullName`. The name appears in the collaboration presence panel, on new comments, and in version audit entries.',
      },
    },
  },
};

/**
 * ### Pre-seeded — Comments & Version History
 *
 * Pre-seeded with comments (including a threaded reply) and two restorable
 * versions loaded from the mock embedded Page List on mount.
 * Open the History tab to see "↩ Restore this version" buttons.
 * Open the Editor tab and click a highlighted word to see the comment panel.
 */
export const WithCommentsAndVersions: Story = {
  name: 'Pre-seeded — Comments & Versions',
  args: {
    ...configProps,
    documentTitle: 'Seeded Document — Comments & Versions',
    authorName: 'Alice',
    commentsPropName: '.DocumentComments',
    versionsPropName: '.DocumentVersions',
    getPConnect: makePConnect(makeSeededStore()),
  },
  parameters: {
    docs: {
      description: {
        story:
          'The mock store is pre-populated with two comments (one with a threaded reply from Bob) and two named versions. Switch to the **History** tab to restore a version, or open the **Comments** panel to reply.',
      },
    },
  },
};

/**
 * ### Comments only — no version persistence
 *
 * Comments only — versions prop left blank to verify graceful degradation
 * (no version persistence, history tab still works in-session).
 */
export const CommentsOnlyNoPersistence: Story = {
  name: 'Comments Only — No Version Persistence',
  args: {
    ...configProps,
    documentTitle: 'Comments Only',
    authorName: 'Carol',
    commentsPropName: '.DocumentComments',
    versionsPropName: '',           // deliberately omitted
    getPConnect: makePConnect(makeMockStore()),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Omits `versionsPropName`. Version history still works in-session (entries are created and restorable within the same browser tab) but is not persisted to Pega on submit.',
      },
    },
  },
};

/**
 * ### No embedded persistence
 *
 * No embedded props configured — simulates a legacy Pega setup that hasn't
 * yet mapped the Page List properties. Comments and history work in-session
 * only (not persisted across refreshes).
 */
export const NoEmbeddedPersistence: Story = {
  name: 'No Embedded Persistence',
  args: {
    ...configProps,
    documentTitle: 'In-Session Only',
    commentsPropName: '',
    versionsPropName: '',
    getPConnect: makePConnect(makeMockStore()),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Neither `commentsPropName` nor `versionsPropName` is set. All features still work in-session. This mirrors a Pega configuration where the Page List data classes have not yet been created.',
      },
    },
  },
};
