import type { Parameters } from '../api/dataPageClient';
import type { FieldChange, DocumentSpec, IdpFieldSpec } from '../idpTypes';
import { toISOBySpec } from './dateUtils';

export interface PageData {
  fields: {
    boundingBoxField: string;
    jsonField: string;
    confidenceScoreField?: string;
  };
  parameters: Parameters;
  source: string;
}

export type dataPageType = 'list' | 'page';

/** Scrolls every scrollable ancestor of `el` back to the top (e.g. to reveal a banner). */
export function scrollAncestorsToTop(el: HTMLElement): void {
  let node: HTMLElement | null = el.parentElement;
  while (node && node !== document.documentElement) {
    if (node.scrollTop > 0) node.scrollTop = 0;
    node = node.parentElement;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/** Strips Pega-internal fields (pz/px/py prefix) from a raw data-page response object. */
export function filterBusinessFields(raw: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(raw).filter(
      ([k]) => !k.startsWith('pz') && !k.startsWith('px') && !k.startsWith('py')
    )
  );
}

/** Field-count statistics persisted alongside the audit log. */
export interface AuditCounts {
  TotalFieldsInSchema: number;
  FieldsFromIdp: number;
  FieldsAdded: number;
  FieldsModified: number;
}

/** Options passed to `computeFieldCounts` to control how counts are resolved. */
export interface ComputeFieldCountsOptions {
  /** `EventType` from the raw IDP page response. `'User'` → use persisted audit-log counts. */
  eventType?: string;
  /** IDP response had a logical error → force `FieldsFromIdp` to 0. */
  hasIdpError?: boolean;
  /** Persisted `FieldsFromIdp` from the audit log (used when `eventType === 'User'`). */
  auditLogFieldsFromIdp?: number;
  /** Persisted `newlyAddedFields` from the audit log (used when `eventType === 'User'`). */
  auditLogNewlyAddedFields?: number;
  /** Persisted `FieldsModified` from the audit log — used as the baseline to add pending modifications on top of. */
  auditLogFieldsModified?: number;
  /** Audit log history — fields already logged are excluded from `newlyAddedFields`. */
  auditLogChanges?: FieldChange[];
  /**
   * Pending (unsaved) user edits. When provided, used to determine whether the user
   * has actively modified fields (as opposed to the page just loading audit-log history).
   */
  pendingChanges?: FieldChange[];
  /**
   * Raw extracted-data object for the document (from `getExtractedDataForDocument`).
   * When provided and `eventType !== 'User'`, `FieldsFromIdp` is counted directly from
   * the IDP response field keys rather than from the schema.
   */
  extractedData?: Record<string, unknown>;
}

/** Serializes initial repeatable rows into the same JSON format RepeatableRender uses for FieldChange values. */
function serializeRepeatableInitialRows(
  repeatable: import('../idpTypes').IdpRepeatableSpec,
  rows: Array<Record<string, string>>
): string {
  if (repeatable.fields.length === 1) {
    const key = repeatable.fields[0].fieldKey;
    return JSON.stringify(rows.map(r => r[key] ?? ''));
  }
  return JSON.stringify(
    rows.map(r => Object.fromEntries(repeatable.fields.map(f => [f.label, r[f.fieldKey] ?? ''])))
  );
}

/** Strips whitespace from phone/telephone values before comparison to avoid format-mismatch misses. */
function normaliseForCompare(fieldLabel: string, value: string): string {
  return /telephone|mobile|phone/i.test(fieldLabel) ? value.replace(/[\s\-().]/g, '') : value;
}

type ModifiedCtx = {
  changeKey: (c: FieldChange) => string;
  idpValueFor: (c: FieldChange) => string;
  isIdpValueNonEmpty: (val: string) => boolean;
  auditLogKeys: Set<string>;
};

type ModifiedUserCtx = ModifiedCtx & {
  oldestAuditByKey: Map<string, FieldChange>;
  auditLogFieldsModified?: number;
};

function computeModifiedNonUser(netPending: FieldChange[], ctx: ModifiedCtx): number {
  const modifiedKeys = new Set<string>();
  netPending
    .filter(c => ctx.isIdpValueNonEmpty(ctx.idpValueFor(c)))
    .forEach(c => {
      const key = ctx.changeKey(c);
      const idpValue = normaliseForCompare(c.fieldLabel, ctx.idpValueFor(c));
      const currentValue = normaliseForCompare(c.fieldLabel, (c.newValue ?? '').trim());
      const inAuditLog = ctx.auditLogKeys.has(key);
      if (!inAuditLog || (currentValue !== '' && currentValue !== idpValue)) {
        modifiedKeys.add(key);
      }
    });
  return modifiedKeys.size;
}

function computeModifiedUser(netPending: FieldChange[], ctx: ModifiedUserCtx): number {
  const delta = netPending
    .filter(c => ctx.isIdpValueNonEmpty(ctx.idpValueFor(c)))
    .reduce((acc, c) => {
      const key = ctx.changeKey(c);
      const norm = (v: string) => normaliseForCompare(c.fieldLabel, v);
      const idpValue = norm(ctx.idpValueFor(c));
      const currentValue = norm((c.newValue ?? '').trim());
      const previousValue = norm((c.previousValue ?? '').trim());
      const inAuditLog = ctx.auditLogKeys.has(key);
      // For saved fields, the true original value is the oldest audit entry's previousValue —
      // idpValue (from extractedData) reflects the saved payload for EventType=User, not the original extraction.
      const originalValue = inAuditLog
        ? norm((ctx.oldestAuditByKey.get(key)?.previousValue ?? '').trim())
        : idpValue;
      if (!ctx.isIdpValueNonEmpty(originalValue)) return acc;
      if (previousValue === originalValue && currentValue !== originalValue) return acc + 1;
      if (previousValue !== originalValue && currentValue === originalValue) return acc - 1;
      return acc;
    }, 0);
  return Math.max(0, (ctx.auditLogFieldsModified ?? 0) + delta);
}

type AddedCtx = {
  changeKey: (c: FieldChange) => string;
  normalise: (s: string) => string;
  auditLogKeys: Set<string>;
  extractedNonEmptyKeys: Set<string>;
  auditLogNewlyAddedFields?: number;
};

function computeFieldsAdded(netPending: FieldChange[], isUser: boolean, ctx: AddedCtx): number {
  const hasNewAdditionsPending = netPending.some(
    c => (c.previousValue ?? '').trim() === '' && (c.newValue ?? '').trim() !== ''
  );
  if (isUser && !hasNewAdditionsPending) return ctx.auditLogNewlyAddedFields ?? 0;
  const newlyAdded = new Set(
    netPending
      .filter(
        c =>
          (c.previousValue ?? '').trim() === '' &&
          (c.newValue ?? '').trim() !== '' &&
          !ctx.extractedNonEmptyKeys.has(ctx.normalise(c.fieldLabel)) &&
          !ctx.auditLogKeys.has(ctx.changeKey(c))
      )
      .map(ctx.changeKey)
  ).size;
  return (ctx.auditLogNewlyAddedFields ?? 0) + newlyAdded;
}

type ModifiedFromExtractedCtx = {
  changeKey: (c: FieldChange) => string;
  idpValueFor: (c: FieldChange) => string;
  isIdpValueNonEmpty: (val: string) => boolean;
  auditLogChanges: FieldChange[];
  pendingChanges: FieldChange[];
};

function computeModifiedFromExtracted(ctx: ModifiedFromExtractedCtx): number {
  const allChanges = [...ctx.auditLogChanges, ...ctx.pendingChanges];
  const netAllMap = new Map<string, FieldChange>();
  for (const c of allChanges) {
    const key = ctx.changeKey(c);
    const existing = netAllMap.get(key);
    // Keep the earliest previousValue; the last entry's newValue becomes the effective current value.
    netAllMap.set(key, existing ? { ...c, previousValue: existing.previousValue } : c);
  }
  return [...netAllMap.values()].filter(c => {
    const idpValue = normaliseForCompare(c.fieldLabel, ctx.idpValueFor(c));
    if (!ctx.isIdpValueNonEmpty(idpValue)) return false;
    return normaliseForCompare(c.fieldLabel, (c.newValue ?? '').trim()) !== idpValue;
  }).length;
}

/** Computes `AuditCounts` from the schema spec, resolved values, and tracked changes. */
export function computeFieldCounts(
  spec: DocumentSpec | undefined,
  resolvedValues: Record<string, string>,
  repeatableRows: Record<string, Array<Record<string, string>>>,
  changes: FieldChange[],
  options: ComputeFieldCountsOptions = {}
): AuditCounts {
  const {
    eventType,
    hasIdpError = false,
    auditLogFieldsFromIdp,
    auditLogNewlyAddedFields,
    auditLogFieldsModified,
    auditLogChanges,
    pendingChanges,
    extractedData
  } = options;
  const isUser = typeof eventType === 'string' && eventType.toLowerCase() === 'user';

  // Repeatable changes collapse to 1 unit keyed by sectionLabel.
  const repLabels = new Set(spec?.repeatables.map(r => r.label) ?? []);
  const changeKey = (c: FieldChange) =>
    repLabels.has(c.sectionLabel) ? c.sectionLabel : `${c.sectionLabel}::${c.fieldLabel}`;

  // Section fields + one unit per repeatable group.
  const TotalFieldsInSchema = spec
    ? spec.sections.reduce((sum, sec) => sum + sec.fields.length, 0) + spec.repeatables.length
    : 0;

  // Error → 0; EventType=User → persisted value; otherwise → raw extractedData key count.
  let FieldsFromIdp: number;
  if (hasIdpError) {
    FieldsFromIdp = 0;
  } else if (isUser) {
    FieldsFromIdp = auditLogFieldsFromIdp ?? 0;
  } else {
    FieldsFromIdp = extractedData ? Object.keys(extractedData).length : 0;
  }

  const auditLogKeys = new Set((auditLogChanges ?? []).map(changeKey));
  const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const extractedNonEmptyKeys = new Set(
    extractedData
      ? Object.entries(extractedData)
          .filter(([, v]) => v != null && String(v).trim() !== '')
          .map(([k]) => normalise(k))
      : []
  );

  const effectivePending = pendingChanges ?? changes;
  // Collapse multiple edits to the same field into one net change (earliest prev → latest new).
  const netMap = new Map<string, FieldChange>();
  for (const c of effectivePending) {
    const key = changeKey(c);
    const first = netMap.get(key);
    netMap.set(key, first ? { ...c, previousValue: first.previousValue } : c);
  }
  const netPending = [...netMap.values()];
  const FieldsAdded = computeFieldsAdded(netPending, isUser, {
    changeKey,
    normalise,
    auditLogKeys,
    extractedNonEmptyKeys,
    auditLogNewlyAddedFields
  });

  // Normalised key → value map for scalar revert detection.
  const extractedValueMap = new Map<string, string>(
    extractedData
      ? Object.entries(extractedData).map(([k, v]) => [normalise(k), String(v ?? '').trim()])
      : []
  );

  // Repeatable label → serialized initial rows for repeatable revert detection.
  const repeatableInitialValueMap = new Map<string, string>();
  if (spec) {
    spec.repeatables.forEach(repeatable => {
      const initialRows = repeatableRows[repeatable.repeatableKey] ?? [];
      repeatableInitialValueMap.set(
        repeatable.label,
        serializeRepeatableInitialRows(repeatable, initialRows)
      );
    });
  }

  // Oldest (first-saved) audit log entry per field — used for EventType=User baseline comparison.
  const oldestAuditByKey = new Map<string, FieldChange>();
  for (const c of auditLogChanges ?? []) {
    const key = changeKey(c);
    if (!oldestAuditByKey.has(key)) oldestAuditByKey.set(key, c);
  }

  // True when a serialized IDP value is non-empty (not blank string, empty object, or empty array).
  const isIdpValueNonEmpty = (val: string): boolean => {
    if (!val || val.trim() === '') return false;
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.length > 0;
      if (typeof parsed === 'object' && parsed !== null) return Object.keys(parsed).length > 0;
    } catch {
      /* plain string — non-empty */
    }
    return true;
  };

  // Resolves the IDP-extracted value string for a pending change (scalar or repeatable).
  const idpValueFor = (c: FieldChange): string =>
    repLabels.has(c.sectionLabel)
      ? (repeatableInitialValueMap.get(c.sectionLabel) ?? '').trim()
      : extractedValueMap.get(normalise(c.fieldLabel)) ?? '';

  let FieldsModified: number;

  if (isUser) {
    // EventType=User: start from the persisted audit-log count, then apply pending-session delta.
    // (extractedData here is the user-saved payload, not the original IDP extraction, so fresh
    // comparison would always show 0. Baseline + delta is the only correct path for User.)
    FieldsModified = computeModifiedUser(netPending, {
      changeKey,
      idpValueFor,
      isIdpValueNonEmpty,
      auditLogKeys,
      oldestAuditByKey,
      auditLogFieldsModified
    });
  } else if (extractedData) {
    // EventType≠User: compute fresh from combined (audit log + pending) vs original IDP values.
    FieldsModified = computeModifiedFromExtracted({
      changeKey,
      idpValueFor,
      isIdpValueNonEmpty,
      auditLogChanges: auditLogChanges ?? [],
      pendingChanges: pendingChanges ?? []
    });
  } else {
    FieldsModified = computeModifiedNonUser(netPending, {
      changeKey,
      idpValueFor,
      isIdpValueNonEmpty,
      auditLogKeys
    });
  }

  return { TotalFieldsInSchema, FieldsFromIdp, FieldsAdded, FieldsModified };
}

/** Increments a version string of the form "V<N>" → "V<N+1>". */
export function incrementVersion(version: string): string {
  const match = version.match(/^v(\d+)$/i);
  if (match) {
    return `V${parseInt(match[1], 10) + 1}`;
  }
  return version;
}

/** Resolves the case id from a PConnect instance. */
export function resolveCaseId(pConnInstance: any): string {
  return pConnInstance?.getCaseInfo?.()?.getID?.() ?? '';
}

/** Resolves the full case instance key (pzInsKey) from a PConnect instance. */
export function resolveCaseKey(pConnInstance: any): string {
  const caseInfo = pConnInstance?.getCaseInfo?.();
  return caseInfo?.getKey?.() ?? caseInfo?.getID?.() ?? '';
}

/** Resolves the current case work status from a PConnect instance. */
export function resolveWorkStatus(pConnInstance: any): string {
  const caseInfo = pConnInstance?.getCaseInfo?.();
  return (
    caseInfo?.getStatus?.() ??
    caseInfo?.getCaseStatus?.() ??
    pConnInstance?.getValue?.('.pyStatusWork') ??
    ''
  );
}

/** Returns the first non-empty value among the candidate keys on a data-page row. */
function pickRowValue(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim() !== '') return String(v);
  }
  return '';
}

/**
 * Maps rows from the standard `D_pyFieldHistory` data page into work-status audit
 * entries. Only rows whose changed property is the case work status are kept, so
 * the previous value, new value, performed-by and time match Pega's OOTB
 * field-history table exactly. Property names are resolved with fallbacks to be
 * resilient to environment/data-page variations.
 */
/** Formats a raw field-history timestamp to match locale-formatted field rows (e.g. 8/14/2026, 3:50:50 PM). */
function formatAuditTimestamp(raw: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? raw : d.toLocaleString();
}

export function parseFieldHistoryStatusRows(
  rows: Array<Record<string, unknown>>,
  caseId?: string
): FieldChange[] {
  if (!Array.isArray(rows)) return [];
  const isStatusRow = (row: Record<string, unknown>) => {
    const prop = pickRowValue(row, [
      'pyPropertyName',
      'pxChangedProperty',
      'PropertyName',
      'pyFieldName'
    ]);
    return /statuswork/i.test(prop.replace(/[^a-z]/gi, ''));
  };
  return rows.filter(isStatusRow).map(row => ({
    entryType: 'workStatus' as const,
    sectionLabel: 'Work Status',
    fieldLabel: 'Status',
    previousValue: pickRowValue(row, [
      'pyOldValue',
      'OldValue',
      'pyPreviousValue',
      'PreviousValue'
    ]),
    newValue: pickRowValue(row, ['pyNewValue', 'NewValue']),
    updatedBy:
      pickRowValue(row, [
        'pxCreateOpName',
        'pyPerformer',
        'pxUpdateOpName',
        'PerformedBy',
        'pyOperatorID'
      ]) || undefined,
    updatedTime:
      formatAuditTimestamp(
        pickRowValue(row, ['pyChangeDate', 'pxCreateDateTime', 'pxTimeCreated', 'ChangeDate'])
      ) || undefined,
    caseId
  }));
}

/** Returns an error message if the IDP payload signals failure (HTTP 200 with logical error), else null. */
export function extractIdpError(payload: Record<string, unknown>): string | null {
  const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

  // Shape 1: { Status/status: "FAILED|failed|Failure", Response/response: { error_description, message, error_code } }
  const statusVal = payload['Status'];
  if (typeof statusVal === 'string' && /^fail/i.test(statusVal)) {
    const resp = payload['Response'];
    const r = resp && typeof resp === 'object' ? (resp as Record<string, unknown>) : {};
    return (
      str(r['error_description']) ??
      str(r['message']) ??
      str(r['error_code']) ??
      'IDP extraction failed.'
    );
  }

  // Shape 2: { error_code, error_description, message } at root
  if (str(payload['error_code'])) {
    return (
      str(payload['error_description']) ??
      str(payload['message']) ??
      str(payload['error_code']) ??
      'IDP API error.'
    );
  }

  return null;
}

/**
 * Parses the `AuditLogData` JSON string into a flat entries array.
 * The new format stores only entries in `AuditLogData`; counts are top-level page fields.
 */
export function normalizeAuditLogData(raw: unknown): Array<Record<string, unknown>> {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn('[AuditLog] Unable to parse AuditLogData:', raw);
      return [];
    }
  }
  return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [];
}

/** Parses the audit-log page into a flat list of FieldChange entries. */
export function parseAuditLogPage(page: Record<string, unknown>): FieldChange[] {
  const entries = normalizeAuditLogData(page['AuditLogData']);
  if (entries.length === 0) return [];

  const pageCaseId = page['CaseID'] != null ? String(page['CaseID']) : undefined;
  return entries.map(entry => ({
    sectionLabel: String(entry.Section ?? ''),
    fieldLabel: String(entry.Field ?? ''),
    previousValue: String(entry.previousValue ?? ''),
    newValue: String(entry.newValue ?? ''),
    updatedBy: entry.user != null ? String(entry.user) : undefined,
    updatedTime: entry.timestamp != null ? String(entry.timestamp) : undefined,
    caseId: pageCaseId,
    entryType: entry.entryType === 'workStatus' ? 'workStatus' : 'field'
  }));
}

/** Reads the field-count statistics from the top-level audit-log page fields. */
export function parseAuditCounts(page: Record<string, unknown>): AuditCounts | null {
  const toNum = (v: unknown): number => {
    const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
    return Number.isFinite(n) ? n : 0;
  };

  // A real prior save always writes a Version string (e.g. 'V1').
  // If Version is absent the page is a Pega default with all counts at 0 — treat as no prior save.
  if (typeof page['Version'] !== 'string' || !page['Version']) return null;
  return {
    TotalFieldsInSchema: toNum(page['TotalFieldsInSchema']),
    FieldsFromIdp: toNum(page['FieldsFromIdp']),
    FieldsAdded: toNum(page['FieldsAdded']),
    FieldsModified: toNum(page['FieldsModified'])
  };
}

// ─── Field display utilities ──────────────────────────────────────────────────

export function parseConfidenceRaw(
  res: Record<string, unknown>,
  confKey: string
): Record<string, unknown> | undefined {
  if (!confKey) return undefined;
  const raw = res[confKey];
  if (raw == null || raw === '') return undefined;
  return typeof raw === 'string'
    ? (JSON.parse(raw) as Record<string, unknown>)
    : (raw as Record<string, unknown>);
}

/** Maps a confidence score (0–5) to a CSS colour: red ≤1 · amber ≤3 · green >3. */
export function getConfidenceBorderColor(score: number): string {
  if (score <= 1) return '#dc2626';
  if (score <= 3) return '#d97706';
  return '#16a34a';
}

/** Overrides displayType to "phone"/"email" when the fieldKey contains those keywords. */
export function resolveDisplayType(spec: IdpFieldSpec): string {
  const key = spec.fieldKey.toLowerCase();
  if (/telephone|mobile|phone/.test(key)) return 'phone';
  if (key.includes('email')) return 'email';
  return spec.displayType;
}

/** Returns a format-validation error string, or null when valid. Empty values pass (required check is separate). */
export function validateFieldFormat(spec: IdpFieldSpec, value: string): string | null {
  const type = resolveDisplayType(spec);
  const v = value.trim();
  if (!v) return null;
  if (type === 'date' || type === 'datetime') {
    const n = toISOBySpec(v, spec);
    if (!/^\d{4}-\d{2}-\d{2}/.test(n) || Number.isNaN(new Date(n).getTime()))
      return 'Enter a valid date.';
    return null;
  }
  if (type === 'number' && !/^-?\d+(\.\d+)?$/.test(v)) return 'Enter a valid number.';
  if (type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
    return 'Enter a valid email address.';
  if (type === 'phone' && !/^\+\d[\d\s\-().]{5,}$/.test(v))
    return 'Enter a valid phone number with country code (e.g. +86 010-12300).';
  if (spec.minLength !== undefined && v.length < spec.minLength)
    return `Must be at least ${spec.minLength} characters.`;
  if (spec.maxLength !== undefined && v.length > spec.maxLength)
    return `Must be at most ${spec.maxLength} characters.`;
  return null;
}
export const LATEST_ASSIGNMENT_ETAG_KEY = 'latestAssignmentETag';
let isAssignmentEtagInterceptorRegistered = false;

type RestResponse = {
  config?: { url?: string };
  headers?: Record<string, string | undefined>;
};

/* (Fix Given By Pega Product Team for handling assignment ETag in REST client)
 * Registers an interceptor for assignment ETag handling in the REST client.
 * Ensures that the latest assignment ETag is stored in sessionStorage after save requests.
 */
export const registerAssignmentEtagInterceptor = () => {
  if (isAssignmentEtagInterceptorRegistered) return;

  const restClient = PCore.getRestClient() as unknown as {
    registerInterceptor?: (interceptor: {
      request: (config: unknown) => unknown;
      response: (response: RestResponse) => RestResponse;
    }) => void;
  };

  if (typeof restClient?.registerInterceptor !== 'function') {
    console.warn('[MFEViewer] REST client does not support interceptor registration.');
    return;
  }

  restClient.registerInterceptor({
    request: config => config,
    response: response => {
      const url = response.config?.url ?? '';
      const isSaveRequest = /\/save\/?(?:[?#]|$)/.test(url);
      const etag = response.headers?.etag;

      if (isSaveRequest && etag) {
        sessionStorage.setItem(LATEST_ASSIGNMENT_ETAG_KEY, etag);
      }

      return response;
    }
  });
  isAssignmentEtagInterceptorRegistered = true;
};
