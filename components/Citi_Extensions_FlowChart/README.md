# Citi_Extensions_FlowChart

A **left-to-right mind map / organisation chart** widget built for Pega Constellation.  
It renders a tree of nodes with straight elbow connectors, collapse/expand interaction, and a fully configurable filter bar — all driven from **App Studio with zero code changes**.

---

## Table of Contents

- [Features](#features)
- [Props Reference](#props-reference)
- [Modes of Operation](#modes-of-operation)
  - [Static Mode](#static-mode)
  - [Data Page Mode](#data-page-mode)
- [Filter Fields (Dynamic)](#filter-fields-dynamic)
- [Data Page Response Format](#data-page-response-format)
- [Node Color](#node-color)
- [TreeNode JSON Schema](#treenode-json-schema)
- [App Studio Configuration Guide](#app-studio-configuration-guide)
- [Collapse / Expand](#collapse--expand)
- [Storybook](#storybook)

---

## Features

| Feature | Details |
|---|---|
| **Left-to-right layout** | Root on the left, children expand rightward |
| **Any depth** | Each node can have 0, 1, or many children at any depth |
| **Collapse / Expand** | Click a node with children to toggle its subtree |
| **Elbow connectors** | Right-angle lines connecting parent → child |
| **Depth colour borders** | Each depth level gets a distinct colour border; nodes have white fill |
| **Random badge colours** | The `+`/`−` collapse badge has a unique colour per node (seeded by ID) |
| **Data page integration** | Fetches a flat list from a Pega data page and builds the tree automatically |
| **Dynamic filter bar** | Any number of filter fields configured in App Studio — no code changes |
| **Static JSON fallback** | Works without a data page using a hardcoded JSON tree |
| **Scroll** | Container scrolls horizontally and vertically for large trees |

---

## Props Reference

| Prop | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | `"Mind Map"` | Title displayed above the chart |
| `dataPageName` | `string` | `""` | Pega data page name (e.g. `D_OrgChart`). Leave blank to use `treeData` |
| `idField` | `string` | `"id"` | Field in the DP response used as the node's unique ID |
| `labelField` | `string` | `"label"` | Field in the DP response used as the node's display text |
| `parentField` | `string` | `"parentId"` | Field in the DP response pointing to the parent node's ID. Nodes without a parent (or with an unresolved parent) become root children |
| `colorField` | `string` | `""` | Optional field in the DP response for a per-node hex colour (e.g. `#e53935`) |
| `treeData` | `string` | `""` | JSON string of a `TreeNode` object used when `dataPageName` is blank |
| `filterFields` | `FilterField[]` | `[]` | Array of filter field definitions (configured as a LIST in App Studio) |

### FilterField sub-properties

| Sub-prop | Type | Description |
|---|---|---|
| `fieldName` | `string` | Parameter name passed to the data page (required) |
| `label` | `string` | Display label shown above the input |
| `fieldType` | `"text" \| "date" \| "select"` | Type of input rendered |
| `options` | `string` | Comma-separated option values for `select` type (e.g. `"APAC,EMEA,AMER"`) |
| `defaultValue` | `string` | Pre-filled value on load; also restored by **Clear** button |

---

## Modes of Operation

### Static Mode

Set **`treeData`** to a JSON string of a `TreeNode` object. Leave `dataPageName` blank.  
No data page is called. The chart renders the static tree immediately.

```json
{
  "id": "root",
  "label": "CEO",
  "children": [
    {
      "id": "cto",
      "label": "CTO",
      "children": [
        { "id": "fe", "label": "Front-end" },
        { "id": "be", "label": "Back-end" }
      ]
    },
    { "id": "cmo", "label": "CMO" }
  ]
}
```

### Data Page Mode

Set **`dataPageName`** to the name of a Pega data page that returns a **flat list** of records.  
The component calls the data page on mount and rebuilds the tree automatically.

When filter values are filled in and **Apply** is clicked, the data page is called again with the filter values as parameters.

---

## Filter Fields (Dynamic)

The filter bar is rendered **only when at least one filter field is configured**.

### Adding a field (App Studio)

1. Open the component in **App Studio → UI → Pages**
2. Scroll to **"Filter fields"**
3. Click **`+ Add row`**
4. Fill in the sub-fields
5. Save — the input appears in the chart immediately

### Removing a field (App Studio)

1. Click the 🗑 **delete** icon on the row
2. Save — the input disappears

### Example — 3 filter fields

| fieldName | label | fieldType | options | defaultValue |
|---|---|---|---|---|
| `department` | Department | `select` | `Engineering,Finance,HR` | _(blank)_ |
| `location` | Location | `text` | _(blank)_ | _(blank)_ |
| `activeDate` | Active as of | `date` | _(blank)_ | _(blank)_ |

These produce:
- A **dropdown** for Department
- A **text input** for Location
- A **date picker** for Active as of

Clicking **🔍 Apply** calls the data page with whichever fields are non-empty as parameters.  
Clicking **✕ Clear** resets all inputs to their `defaultValue`.

---

## Data Page Response Format

The data page must return a list where each record contains at minimum the `idField` and `labelField` values. The `parentField` should reference the `idField` of the parent node.

**Example response (`D_OrgChart`):**

```json
{
  "data": [
    { "id": "root", "label": "CEO",       "parentId": "" },
    { "id": "cto",  "label": "CTO",       "parentId": "root" },
    { "id": "fe",   "label": "Front-end", "parentId": "cto" },
    { "id": "be",   "label": "Back-end",  "parentId": "cto" },
    { "id": "cfo",  "label": "CFO",       "parentId": "root" }
  ]
}
```

Nodes whose `parentId` is empty, missing, or references an unknown ID are treated as **root-level children**.  
If only one root-level node is found, it is promoted as the single root.

---

## Node Color

You can assign a custom colour to any node by:

1. **Data page mode** — add a field (e.g. `nodeColor`) in your DP response with a hex value and set `colorField` to `nodeColor`
2. **Static mode** — add a `"color": "#hex"` field directly in the JSON

If no colour is provided, the border colour is assigned automatically based on depth level using a built-in palette.

---

## TreeNode JSON Schema

```ts
interface TreeNode {
  id: string;        // unique identifier
  label: string;     // display text (truncated after 17 characters)
  color?: string;    // optional hex border colour, e.g. "#e53935"
  children?: TreeNode[];
}
```

---

## App Studio Configuration Guide

```
Component: Citi_Extensions_FlowChart
├── Chart title          → TEXT
├── Data page name       → TEXT   (e.g. D_OrgChart)
├── ID field name        → TEXT   (default: id)
├── Label field name     → TEXT   (default: label)
├── Parent ID field name → TEXT   (default: parentId)
├── Color field name     → TEXT   (optional)
├── Static tree JSON     → TEXT   (used when no data page is set)
└── Filter fields        → LIST
    ├── [row 1]
    │   ├── fieldName    → TEXT   (required)
    │   ├── label        → TEXT
    │   ├── fieldType    → TEXT   (text | date | select)
    │   ├── options      → TEXT   (comma-separated, for select)
    │   └── defaultValue → TEXT
    └── [row N — add/remove freely]
```

---

## Collapse / Expand

- Nodes that have children display a small **coloured circle badge** with `+` or `−`
- **Click** a parent node to collapse its entire subtree
- **Click** it again to expand
- Collapsed nodes appear at reduced opacity
- Collapse state is local to the browser session (resets on page reload)

---

## Storybook

Three stories are provided:

| Story | Description |
|---|---|
| **Docs** | Auto-generated documentation page (ArgTable + descriptions) |
| **StaticTree** | Chart rendered from a hardcoded JSON tree |
| **WithFilters** | Chart with 3 example filter fields (no real data page) |

Run Storybook:

```bash
npm run startStorybook
```

Then navigate to **CitiExtensionsFlowChart** in the sidebar.
