/* eslint-disable no-shadow */
// ─── IDP TypeScript interfaces ────────────────────────────────────────────────
//
// Canonical types for the IDP spec document.
// Imported by: DetailsRender.tsx, index.tsx, demo.stories.tsx, mock.ts

export enum ACTION_TYPE {
  SAVE_AND_SUBMIT = 'SaveAndSubmit',
  SAVE = 'Save',
  SUBMIT = 'Submit',
  CANCEL = 'Cancel'
}

export enum ACTION_TARGET {
  DYNAMIC_VIEW = 'Dynamic view',
  MFE = 'MFE'
}

/** Single entry received from the action bar pub/sub event. */
export interface ActionPayload {
  type: ACTION_TYPE;
  target: ACTION_TARGET;
}

export interface IdpFieldSpec {
  fieldKey: string;
  codexName: string;
  reportingKey: string;
  label: string;
  valueType: string;
  required: boolean;
  editable: boolean;
  /** Controls which Cosmos component renders this field — see DISPLAY_TYPE_MAP. */
  displayType: string;
  format: string;
  placeholder?: string;
  helpText?: string;
  /** Enum options for radio displayType — populated from JSON Schema enum array. */
  options?: string[];
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  isNestedArray?: boolean;
  nestedItemType?: string;
  order: number;
}

export interface IdpSectionSpec {
  sectionKey: string;
  label: string;
  order: number;
  fields: IdpFieldSpec[];
}

export interface IdpRepeatableSpec {
  repeatableKey: string;
  reportingKey: string;
  label: string;
  order: number;
  /** When true, at least one row/chip must be present before saving. */
  required?: boolean;
  /** Description of the parent array property — shown in the accordion info popup. */
  helpText?: string;
  fields: IdpFieldSpec[];
}

export interface DocumentSpec {
  documentId: string;
  documentName: string;
  documentType: string;
  /** Display name returned by the schema registry for the current document type. */
  docTypeDisplay?: string;
  sections: IdpSectionSpec[];
  repeatables: IdpRepeatableSpec[];
}

export interface DelineationResponseDocument {
  document_id: string;
  document_name: string;
  document_type: string;
  indices: number[];
}

export interface DelineationExtractResponseDocument {
  document_id: string;
  document_name: string;
  extracted_data: Record<string, any>;
}

export interface ResponseMetadata {
  file_metadata: {
    file_uri: string;
  };
  performance_metrics: {
    delineation: {
      execution_time_seconds: number;
      memory_peak_usage_mb: number;
    };
    extraction: [];
  };
}

export interface DelineationResponse {
  status: string;
  response: {
    delineation_response: DelineationResponseDocument[];
    extract_response: DelineationExtractResponseDocument[];
  };
  response_metadata: ResponseMetadata;
}

// ─── FieldChange ──────────────────────────────────────────────────────────────
//
// Represents a single tracked edit made by the reviewer.
// Collected into an array and displayed in the Changes Log table.

export interface FieldChange {
  /** Discriminates the kind of audit entry. Defaults to a normal field edit;
   * `'workStatus'` and `'documentType'` entries originate from case field history. */
  entryType?: 'field' | 'workStatus' | 'documentType';
  /** Human-readable section or repeatable label (e.g. "Engagement Details"). */
  sectionLabel: string;
  /** Human-readable field label (e.g. "Onboarding Date"). */
  fieldLabel: string;
  /** The value that existed before the edit. */
  previousValue: string;
  /** The value after the edit. */
  newValue: string;
  /** The user who made the change. */
  updatedBy?: string;
  /** ISO timestamp or display string for when the change was made. */
  updatedTime?: string;
  /** The case ID (pzInsKey) at the time of the change. */
  caseId?: string;
}

// ─── Display-type → Pega component type map ──────────────────────────────────
//
// Maps each `displayType` value in the IDP spec to the Pega Constellation
// component type string (getRawMetadata().type).
//
// Used in two places:
//   1. DetailsRender  — cross-checks the DOM type against the spec expectation
//                       and emits a console.warn on mismatch.
//   2. demo.stories   — resolves which Cosmos widget to render for each field
//                       in the Storybook dummy-data path.
//
// Extend this map as new displayType values are added to the IDP spec.

export const DISPLAY_TYPE_MAP: Record<string, string> = {
  textbox: 'TextInput', // single-line text   → Cosmos Input
  textarea: 'TextArea', // multi-line text    → Cosmos TextArea
  dropdown: 'Dropdown', // select list        → Cosmos Select
  checkbox: 'Checkbox', // boolean toggle     → Cosmos Checkbox
  radio: 'RadioButtons', // option group       → Cosmos RadioButtonGroup
  date: 'Date', // date picker        → Cosmos DateInput
  datetime: 'DateTime', // date + time picker
  number: 'Integer', // numeric input      → Cosmos Input[type=number]
  currency: 'Currency', // money input        → Cosmos CurrencyInput
  email: 'Email', // e-mail address     → Cosmos Input[type=email]
  phone: 'Phone', // phone number       → Cosmos PhoneInput
  autocomplete: 'AutoComplete', // typeahead          → Cosmos AutoComplete
  url: 'URL', // hyperlink          → Cosmos Input[type=url]
  attachment: 'Attachment' // file upload        → Cosmos FileUpload
};

// ─── sortByOrder ──────────────────────────────────────────────────────────────
//
// Generic comparator — sorts any array of objects that carry an `order`
// numeric property in ascending order (lowest order renders first).
//
// Elements without an `order` are treated as Infinity so they always
// fall to the end rather than throwing.
//
// Examples:
//   sortByOrder(section.fields)                       → fields in spec order
//   sortByOrder([...sectionEntries, ...repeatableEntries]) → merged render queue

export function sortByOrder<T extends { order?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
}

// ─── RenderQueueEntry ─────────────────────────────────────────────────────────
//
// Discriminated union produced by buildRenderQueue().
// The `kind` field lets ReviewPanel decide whether to use DetailsRender
// (section) or RepeatableRender (repeatable) for each slot.

export type RenderQueueEntry =
  | { kind: 'section'; order: number; spec: IdpSectionSpec }
  | { kind: 'repeatable'; order: number; spec: IdpRepeatableSpec };

// ─── buildRenderQueue ─────────────────────────────────────────────────────────
//
// Merges a DocumentSpec's sections and repeatables into a single flat list sorted
// by their `order` property.  Tags each entry with a `kind` discriminator.
//
// Example — spec with section order=1, repeatable order=2:
//   buildRenderQueue(spec)
//   → [
//       { kind: 'section',    order: 1, spec: caseSummary      },
//       { kind: 'repeatable', order: 2, spec: beneficialOwners },
//     ]

export function buildRenderQueue(spec: DocumentSpec): RenderQueueEntry[] {
  const sectionEntries: RenderQueueEntry[] = (spec.sections ?? []).map(s => ({
    kind: 'section' as const,
    order: s.order,
    spec: s
  }));

  const repeatableEntries: RenderQueueEntry[] = (spec.repeatables ?? []).map(r => ({
    kind: 'repeatable' as const,
    order: r.order,
    spec: r
  }));

  return sortByOrder([...sectionEntries, ...repeatableEntries]);
}
