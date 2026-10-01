/* eslint-disable react/jsx-no-useless-fragment */
// @ts-nocheck
import type { Meta, StoryObj } from '@storybook/react';
import CitiExtensionsFlowChart from './index';

// ── Mock PCore for Storybook ──────────────────────────────────────────────────
// Simulates a flat data page response with department / location / keyword filtering.
const MOCK_ROWS = [
  { id: 'root', label: 'Jane Smith — CEO',              parentId: '',     department: 'Executive',   location: 'NYC'    },
  { id: 'cto',  label: 'Alan Torres — CTO',             parentId: 'root', department: 'Engineering', location: 'NYC'    },
  { id: 'fe',   label: 'Sara Kim — Front-end Lead',     parentId: 'cto',  department: 'Engineering', location: 'NYC'    },
  { id: 'be',   label: 'Marco Rossi — Back-end Lead',   parentId: 'cto',  department: 'Engineering', location: 'London' },
  { id: 'qa',   label: 'Priya Nair — QA Manager',       parentId: 'cto',  department: 'Engineering', location: 'London' },
  { id: 'devops', label: 'Luca Bianchi — DevOps Lead',  parentId: 'cto',  department: 'Engineering', location: 'NYC'    },
  { id: 'cfo',  label: 'Robert Chen — CFO',             parentId: 'root', department: 'Finance',     location: 'NYC'    },
  { id: 'acc',  label: 'Diana Müller — Accounting Hd',  parentId: 'cfo',  department: 'Finance',     location: 'NYC'    },
  { id: 'aud',  label: 'Tom Walsh — Internal Audit',    parentId: 'cfo',  department: 'Finance',     location: 'London' },
  { id: 'fp',   label: 'Yuki Tanaka — FP&A Director',   parentId: 'cfo',  department: 'Finance',     location: 'NYC'    },
  { id: 'cmo',  label: 'Nina Patel — CMO',              parentId: 'root', department: 'Marketing',   location: 'NYC'    },
  { id: 'brand',label: 'Chris Lee — Brand Strategy',    parentId: 'cmo',  department: 'Marketing',   location: 'NYC'    },
  { id: 'dig',  label: 'Aisha Omar — Digital Mktg',     parentId: 'cmo',  department: 'Marketing',   location: 'London' },
  { id: 'coo',  label: 'David Park — COO',              parentId: 'root', department: 'Executive',   location: 'NYC'    },
  { id: 'ops',  label: 'Elena Greco — Global Ops Mgr',  parentId: 'coo',  department: 'Executive',   location: 'London' },
];

(window as any).PCore = {
  getDataApiUtils: () => ({
    getData: (_dp: string, params: Record<string, string>) => {
      let rows = MOCK_ROWS.slice();
      if (params.department) rows = rows.filter(r => r.department === params.department);
      if (params.location)   rows = rows.filter(r => r.location === params.location);
      if (params.keyword)    rows = rows.filter(r =>
        r.label.toLowerCase().includes(params.keyword.toLowerCase())
      );
      // Always include direct ancestors so the tree stays connected
      const ids = new Set(rows.map(r => r.id));
      MOCK_ROWS.forEach(r => { if (ids.has(r.id) && r.parentId) ids.add(r.parentId); });
      rows = MOCK_ROWS.filter(r => ids.has(r.id));
      return Promise.resolve({ data: { data: rows } });
    },
  }),
};

// ── Shared mock getPConnect ───────────────────────────────────────────────────
const mockGetPConnect = () => ({
  getValue: (v: any) => v,
  getContextName: () => 'app/primary_1',
  getLocalizedValue: (v: any) => v,
  getActionsApi: () => ({ updateFieldValue: () => {}, triggerFieldChange: () => {} }),
  ignoreSuggestion: () => {},
  acceptSuggestion: () => {},
  setInheritedProps: () => {},
  resolveConfigProps: () => {},
});

// ── Sample static trees ───────────────────────────────────────────────────────
const orgChartTree = JSON.stringify({
  id: 'root', label: 'Jane Smith — CEO',
  children: [
    { id: 'cto', label: 'Alan Torres — CTO', children: [
      { id: 'fe',     label: 'Sara Kim — FE Lead' },
      { id: 'be',     label: 'Marco Rossi — BE Lead' },
      { id: 'qa',     label: 'Priya Nair — QA Mgr' },
      { id: 'devops', label: 'Luca Bianchi — DevOps' },
    ]},
    { id: 'cfo', label: 'Robert Chen — CFO', children: [
      { id: 'acc', label: 'Diana Müller — Accounting' },
      { id: 'aud', label: 'Tom Walsh — Audit' },
      { id: 'fp',  label: 'Yuki Tanaka — FP&A' },
    ]},
    { id: 'cmo', label: 'Nina Patel — CMO', children: [
      { id: 'brand', label: 'Chris Lee — Brand' },
      { id: 'dig',   label: 'Aisha Omar — Digital' },
    ]},
    { id: 'coo', label: 'David Park — COO', children: [
      { id: 'ops', label: 'Elena Greco — Global Ops' },
    ]},
  ],
});

const deepTree = JSON.stringify({
  id: 'root', label: 'Platform Team',
  children: [
    { id: 'a', label: 'Front-end Guild', children: [
      { id: 'a1', label: 'React — Component Lib' },
      { id: 'a2', label: 'Design System' },
      { id: 'a3', label: 'Accessibility (a11y)' },
    ]},
    { id: 'b', label: 'Back-end Guild', children: [
      { id: 'b1', label: 'API Platform', children: [
        { id: 'b1a', label: 'REST Gateway' },
        { id: 'b1b', label: 'GraphQL Layer' },
      ]},
      { id: 'b2', label: 'Data Engineering' },
    ]},
    { id: 'c', label: 'DevOps & SRE' },
  ],
});

// ── Meta ──────────────────────────────────────────────────────────────────────
/**
 * ## Citi_Extensions_FlowChart
 *
 * A **left-to-right mind map / organisation chart** widget for Pega Constellation.
 *
 * ### Key capabilities
 * - Pure SVG, left-to-right layout with right-angle **elbow connectors**
 * - Click any parent node to **collapse / expand** its subtree (badge shows `+` / `−`)
 * - Fetches data from a **Pega data page** (flat rows → tree) or renders a **static JSON tree**
 * - **Filter bar** — up to 3 optional filter fields + 1 elastic search box, all configured in App Studio without any code changes
 * - White node fill, depth-coloured borders, drop-shadow, colour-coded legend
 *
 * ---
 *
 * ### Props — chart data
 *
 * | Prop | Type | Default | Description |
 * |---|---|---|---|
 * | `title` | `string` | `'Mind Map'` | Heading shown above the chart |
 * | `dataPageName` | `string` | `''` | Pega data page name (e.g. `D_OrgChart`). Leave blank to use `treeData`. |
 * | `idField` | `string` | `'id'` | Data page field used as the node unique ID |
 * | `labelField` | `string` | `'label'` | Data page field used as the node display label |
 * | `parentField` | `string` | `'parentId'` | Data page field pointing to the parent node ID (blank/absent = root) |
 * | `colorField` | `string` | `''` | Optional data page field for a per-node hex colour override |
 * | `treeData` | `string` | `''` | JSON string of a `TreeNode` object — used when `dataPageName` is blank |
 *
 * ### Props — Filter 1 / 2 / 3 (each slot is independent and optional)
 *
 * | Prop | Type | Description |
 * |---|---|---|
 * | `filter1Field` | `string` | Data page parameter name. Leave blank to hide this filter. |
 * | `filter1Label` | `string` | Display label shown above the input |
 * | `filter1Type` | `'text' \| 'date' \| 'select'` | Renders a text box, date picker, or dropdown |
 * | `filter1Options` | `string` | Comma-separated option values when `filter1Type = 'select'` |
 *
 * *(Same set of four props for `filter2…` and `filter3…`)*
 *
 * ### Props — Search / elastic search (optional)
 *
 * | Prop | Type | Default | Description |
 * |---|---|---|---|
 * | `searchField` | `string` | `''` | Data page parameter name for keyword search. Leave blank to hide. |
 * | `searchLabel` | `string` | `'Search'` | Label above the search box |
 * | `searchPlaceholder` | `string` | `'Type to search…'` | Placeholder text |
 *
 * > **Tip:** Press **Enter** inside the search box or click **Apply** to trigger a fetch.  
 * > Click **Clear** to reset all inputs and reload the full tree.
 *
 * ---
 *
 * ### Data page flat-list format
 *
 * ```json
 * { "data": [
 *   { "id": "root", "label": "CEO",       "parentId": "" },
 *   { "id": "cto",  "label": "CTO",       "parentId": "root" },
 *   { "id": "fe",   "label": "Front-end", "parentId": "cto" }
 * ]}
 * ```
 *
 * Nodes whose `parentId` is absent, empty, or does not match any other `id` are treated as roots.
 * If exactly one root exists it becomes the tree root; otherwise a synthetic `Root` node is created.
 */
const meta: Meta<typeof CitiExtensionsFlowChart> = {
  title: 'CitiExtensionsFlowChart',
  component: CitiExtensionsFlowChart,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Left-to-right SVG mind map / org chart for Pega Constellation. ' +
          'Driven by a Pega data page or static JSON tree. ' +
          'Up to 3 filter fields and 1 elastic search box are configured entirely in App Studio — no code changes required.',
      },
    },
  },
  argTypes: {
    // ── Chart data ────────────────────────────────────────────────────────
    title:        { control: 'text', description: 'Heading shown above the chart', table: { category: 'Chart', defaultValue: { summary: 'Mind Map' } } },
    dataPageName: { control: 'text', description: 'Pega data page name. Leave blank to use treeData.', table: { category: 'Chart', defaultValue: { summary: '' } } },
    idField:      { control: 'text', description: 'Data page field used as node ID', table: { category: 'Chart', defaultValue: { summary: 'id' } } },
    labelField:   { control: 'text', description: 'Data page field used as node label', table: { category: 'Chart', defaultValue: { summary: 'label' } } },
    parentField:  { control: 'text', description: 'Data page field pointing to parent ID (blank = root)', table: { category: 'Chart', defaultValue: { summary: 'parentId' } } },
    colorField:   { control: 'text', description: 'Optional data page field for per-node hex colour override', table: { category: 'Chart', defaultValue: { summary: '' } } },
    treeData:     { control: 'text', description: 'Static JSON TreeNode — used when dataPageName is blank', table: { category: 'Chart' } },
    // ── Filter 1 ──────────────────────────────────────────────────────────
    filter1Field:   { control: 'text',   description: 'DP parameter name (blank = hidden)', table: { category: 'Filter 1' } },
    filter1Label:   { control: 'text',   description: 'Display label above the input',      table: { category: 'Filter 1' } },
    filter1Type:    { control: 'select', options: ['text', 'date', 'select'], description: 'Input type', table: { category: 'Filter 1', defaultValue: { summary: 'text' } } },
    filter1Options: { control: 'text',   description: 'Comma-separated options (select only)', table: { category: 'Filter 1' } },
    // ── Filter 2 ──────────────────────────────────────────────────────────
    filter2Field:   { control: 'text',   description: 'DP parameter name (blank = hidden)', table: { category: 'Filter 2' } },
    filter2Label:   { control: 'text',   description: 'Display label above the input',      table: { category: 'Filter 2' } },
    filter2Type:    { control: 'select', options: ['text', 'date', 'select'], description: 'Input type', table: { category: 'Filter 2', defaultValue: { summary: 'text' } } },
    filter2Options: { control: 'text',   description: 'Comma-separated options (select only)', table: { category: 'Filter 2' } },
    // ── Filter 3 ──────────────────────────────────────────────────────────
    filter3Field:   { control: 'text',   description: 'DP parameter name (blank = hidden)', table: { category: 'Filter 3' } },
    filter3Label:   { control: 'text',   description: 'Display label above the input',      table: { category: 'Filter 3' } },
    filter3Type:    { control: 'select', options: ['text', 'date', 'select'], description: 'Input type', table: { category: 'Filter 3', defaultValue: { summary: 'text' } } },
    filter3Options: { control: 'text',   description: 'Comma-separated options (select only)', table: { category: 'Filter 3' } },
    // ── Search ────────────────────────────────────────────────────────────
    searchField:       { control: 'text', description: 'DP parameter name for keyword/elastic search (blank = hidden)', table: { category: 'Search', defaultValue: { summary: '' } } },
    searchLabel:       { control: 'text', description: 'Label above the search box',  table: { category: 'Search', defaultValue: { summary: 'Search' } } },
    searchPlaceholder: { control: 'text', description: 'Placeholder text in the search box', table: { category: 'Search', defaultValue: { summary: 'Type to search…' } } },
  },
};

export default meta;
type Story = StoryObj<typeof CitiExtensionsFlowChart>;

// ── Story: Docs ───────────────────────────────────────────────────────────────
/**
 * Default static org chart — no data page, no filter bar.
 *
 * This is the autodocs anchor story. It renders the CEO hierarchy from a static
 * `treeData` JSON string so the chart is always visible without a live Pega environment.
 *
 * **Try clicking a node that has children** — a coloured badge shows `+` / `−` and
 * the subtree collapses or expands instantly.
 */
export const Docs: Story = {
  name: 'Docs',
  render: args => <CitiExtensionsFlowChart {...args} getPConnect={mockGetPConnect} />,
  args: {
    title: 'Organisation Chart',
    treeData: orgChartTree,
    dataPageName: '',
    idField: 'id', labelField: 'label', parentField: 'parentId', colorField: '',
  },
};

// ── Story: StaticTree ─────────────────────────────────────────────────────────
/**
 * Multi-depth static tree rendered entirely from a `treeData` JSON prop.
 *
 * No data page is called and no filter bar is shown. Use this story to preview
 * the tree layout, depth colouring, and collapse / expand behaviour across
 * multiple levels without a Pega environment.
 */
export const StaticTree: Story = {
  name: 'Static Tree',
  render: args => <CitiExtensionsFlowChart {...args} getPConnect={mockGetPConnect} />,
  args: {
    title: 'Mind Map — Static',
    treeData: deepTree,
    dataPageName: '',
    idField: 'id', labelField: 'label', parentField: 'parentId', colorField: '',
  },
};

// ── Story: WithFilters ────────────────────────────────────────────────────────
/**
 * Live filter bar backed by an **in-memory mock data page** — no Pega environment needed.
 *
 * The filter bar contains:
 * - **Department** — `select` dropdown (`Engineering`, `Finance`, `Marketing`, `Executive`)
 * - **Location** — `text` input (try typing `NYC` or `London`)
 * - **Search** — elastic keyword box (try `Lead`, `Audit`, `Tanaka`, or `DevOps`)
 *
 * Click **Apply** (or press **Enter** in the search box) to re-fetch with the current
 * filter values. The chart updates to show only matching nodes plus their ancestors
 * so the tree stays connected.
 *
 * Click **Clear** to reset all inputs and reload the full tree.
 *
 * > In production replace `dataPageName: 'D_OrgChart'` with your real Pega data page name.
 * > The filter parameters (`department`, `location`, `keyword`) must match the parameter
 * > names declared on that data page.
 */
export const WithFilters: Story = {
  name: 'With Filter Bar',
  render: args => <CitiExtensionsFlowChart {...args} getPConnect={mockGetPConnect} />,
  args: {
    title: 'Organisation Chart — Filtered',
    // dataPageName is set so Apply triggers a real getData() call (mocked above)
    dataPageName: 'D_OrgChart',
    idField: 'id', labelField: 'label', parentField: 'parentId', colorField: '',
    treeData: '',
    // Filter 1 — department dropdown
    filter1Field:   'department',
    filter1Label:   'Department',
    filter1Type:    'select',
    filter1Options: 'Engineering,Finance,Marketing,Executive',
    // Filter 2 — location text
    filter2Field: 'location',
    filter2Label: 'Location',
    filter2Type:  'text',
    // Filter 3 — (unused, demonstrates optional slot)
    filter3Field: '',
    filter3Label: '',
    filter3Type:  'text',
    // Search box
    searchField:       'keyword',
    searchLabel:       'Search',
    searchPlaceholder: 'Type to search…',
  },
};
