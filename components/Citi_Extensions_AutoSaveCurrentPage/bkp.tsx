/* eslint-disable react/jsx-filename-extension */
/**
 * AutoSaveForm Component
 * 
 * A background autosave component that automatically saves all form fields at a configurable interval.
 * This component is invisible to the user and runs silently to persist form data without user interaction.
 * 
 * Features:
 * - Automatic form saving at configurable intervals (milliseconds)
 * - Saves all form fields from the current case context
 * - Optimistic concurrency control using etag
 * - Change tracking to detect when saves are needed
 * - Error handling with console logging
 * 
 * @component
 * @example
 * // Add to form with autosave enabled at 5 second interval
 * <CitiExtensionsAutoSaveForm autoSaveEnabled={true} autoSaveInterval={5000} />
 */

import { useEffect, useRef } from 'react';
import {
  withConfiguration
} from '@pega/cosmos-react-core';

import type { PConnFieldProps } from './PConnProps';
import './create-nonce';

/**
 * Deep comparison utility to check if two objects are equal
 * Compares all properties recursively for value equality
 */
function deepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;
  if (obj1 == null || obj2 == null) return false;
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepEqual(obj1[key], obj2[key])) return false;
  }

  return true;
}

/**
 * Top-level field names that are never sent in the save payload.
 * Complements the px/py/pz prefix rule for non-prefixed system fields.
 */
const TOP_LEVEL_EXCLUDED_FIELDS = new Set([
  'classID',
]);

/**
 * System field names excluded from save payloads inside nested objects.
 * At the top level all px/py/pz prefixed fields are excluded via isSystemField().
 */
const SYSTEM_FIELD_NAMES = new Set([
  'classID',
  'pyLabel',
  'pyViewName',
  'pyViewContext',
  'pyStatusWork',
  'pxUrgencyWork',
  'pyCaseLinks',
  'pxCreateDateTime',
  'pxCreateOperator',
  'pxCreateOpName',
  'pxUpdateDateTime',
  'pxUpdateOperator',
  'pxCommitDateTime'
]);

function isSystemField(key: string, insideList = false, topLevel = false): boolean {
  // At top level: strip all px/py/pz fields and any explicitly excluded field names
  if (topLevel) return /^p[xyz]/i.test(key) || TOP_LEVEL_EXCLUDED_FIELDS.has(key);
  // Inside list items: preserve pxSubscript (needed for embedded data list merge/delete)
  if (insideList && key === 'pxSubscript') return false;
  if (SYSTEM_FIELD_NAMES.has(key)) return true;
  return /^pz/i.test(key);
}

/**
 * Recursively sanitizes a value for the Pega save API by stripping system fields
 * from objects and arrays at every nesting level.
 *
 * NOTE: Query-type fields must be excluded BEFORE calling this function —
 * they are read-only data page results and cause server-side 422 errors when saved.
 */
function sanitizeForSave(value: any, insideList = false): any {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    const sanitizedItems = value
      .map(item => sanitizeForSave(item, true))
      .filter(item =>
        item !== null &&
        item !== undefined &&
        !(typeof item === 'object' && !Array.isArray(item) && Object.keys(item).length === 0)
      );

    // Re-index pxSubscript sequentially (1-based) for embedded data lists
    return sanitizedItems.map((item, index) => {
      if (typeof item === 'object' && item !== null && 'pxSubscript' in item) {
        return { ...item, pxSubscript: index + 1 };
      }
      return item;
    });
  }

  if (typeof value === 'object') {
    const cleaned: Record<string, any> = {};
    Object.keys(value).forEach(key => {
      // topLevel=false: inside nested objects, only exact-name exclusions apply
      // so py-prefixed user fields like pyStreet, pyCity are preserved
      if (isSystemField(key, insideList, false)) return;
      const childValue = sanitizeForSave(value[key]);
      if (childValue === undefined) return;
      cleaned[key] = childValue;
    });
    return cleaned;
  }

  return value;
}

/** Stops a setInterval and nulls the ref. */
function stopInterval(ref: React.MutableRefObject<ReturnType<typeof setInterval> | null>) {
  if (ref.current) {
    clearInterval(ref.current);
    ref.current = null;
  }
}

/** Returns true if the value is a Pega attachment metadata object (not saveable via save endpoint). */
function isAttachmentField(value: any): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'pyCategoryName' in value &&
    'pyTransientAttachRef' in value
  );
}

/**
 * Returns true if the value looks like a Pega query / data-page result.
 * These are read-only and must never be sent to the save endpoint.
 *
 * Only the `pxResults` shape is detected here (reliable structural marker).
 * Query list fields (arrays of data-page records) cannot be reliably distinguished
 * from data reference lists or embedded data lists by structure alone — they are
 * identified server-side via 422 "Error loading Data Page" responses and permanently
 * added to knownQueryFields at that point.
 */
function isQueryField(value: any): boolean {
  // Single query field — standard Pega data page shape ({ pxResults: [...] })
  return typeof value === 'object' && value !== null && !Array.isArray(value) && 'pxResults' in value;
}

/**
 * Returns true if the value is a Case Reference (single or list) identified by pzInsKey.
 * `previousValue` is checked so that an empty array that previously held case-ref items
 * is still recognised as a case reference field and excluded from the payload.
 */
function isCaseReferenceField(value: any, previousValue?: any): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) {
    // Non-empty: check first item for pzInsKey
    if (value.length > 0) {
      return typeof value[0] === 'object' && value[0] !== null && 'pzInsKey' in value[0];
    }
    // Empty array: check if the previous snapshot had case-ref items
    if (Array.isArray(previousValue) && previousValue.length > 0) {
      return previousValue.some(
        (item: any) => typeof item === 'object' && item !== null && 'pzInsKey' in item
      );
    }
    return false;
  }
  return typeof value === 'object' && 'pzInsKey' in value;
}

/** Processes a single field value for the save payload. Returns undefined to skip the field. */
function processFieldValue(
  key: string,
  fieldValue: any,
  hadPreviousValue: boolean,
  previousValue?: any
): { value: any } | undefined {
  try {
    if (isAttachmentField(fieldValue)) return undefined;
    // Query / data-page fields are read-only — never send them to the save endpoint.
    if (isQueryField(fieldValue)) return undefined;
    // Case Reference fields (single and list) are excluded from autosave.
    if (isCaseReferenceField(fieldValue, previousValue)) return undefined;

    if (fieldValue === undefined || fieldValue === null || fieldValue === '') {
      return hadPreviousValue ? { value: null } : undefined;
    }

    // Empty array with no previous snapshot — skip entirely.
    // We cannot determine whether it is an embedded-data list, case-reference list,
    // or query list without items to inspect. Sending an empty [] for an unknown
    // field type on the very first save risks a 422 or silent data corruption.
    if (Array.isArray(fieldValue) && fieldValue.length === 0 && !hadPreviousValue) {
      return undefined;
    }

    // Empty object with no previous snapshot — likely a data page that hasn't loaded yet.
    // Skip to avoid sending a meaningless {} that the server may reject.
    if (
      typeof fieldValue === 'object' &&
      !Array.isArray(fieldValue) &&
      Object.keys(fieldValue).length === 0 &&
      !hadPreviousValue
    ) {
      return undefined;
    }

    if (Array.isArray(fieldValue)) {
      return { value: sanitizeForSave(fieldValue) };
    }

    if (typeof fieldValue === 'object') {
      console.debug(`[AutoSave] Complex field "${key}" raw value:`, JSON.stringify(fieldValue));
    }

    const sanitized = sanitizeForSave(fieldValue);

    if (typeof fieldValue === 'object') {
      console.debug(`[AutoSave] Complex field "${key}" after sanitize:`, JSON.stringify(sanitized));
    }

    if (typeof sanitized === 'object' && !Array.isArray(sanitized) && Object.keys(sanitized).length === 0) {
      return { value: null };
    }

    return { value: sanitized };
  } catch (e) {
    console.warn(`[AutoSave] Skipping field "${key}" due to unexpected error:`, e);
    return undefined;
  }
}

/**
 * Filters caseInfo.content down to user-editable fields suitable for the save API.
 * `knownCaseReferenceFields` is updated in-place as case-reference fields are discovered.
 */
function buildFilteredData(
  caseData: Record<string, any>,
  excludeSet: Set<string>,
  previousData: Record<string, any> | null,
  knownCaseReferenceFields: Set<string>,
  knownQueryFields: Set<string>
): Record<string, any> {
  const filteredData: Record<string, any> = {};

  Object.keys(caseData).forEach(key => {
    if (isSystemField(key, false, true)) return;
    if (excludeSet.has(key)) return;
    // Always skip fields identified as Case Reference in any prior save cycle
    if (knownCaseReferenceFields.has(key)) return;
    // Always skip fields identified as data-page/query fields by the server
    if (knownQueryFields.has(key)) return;

    const fieldValue = caseData[key];
    const previousValue = previousData?.[key];
    const hadPreviousValue = previousData !== null && previousValue !== undefined && previousValue !== null;
    const result = processFieldValue(key, fieldValue, hadPreviousValue, previousValue);

    if (result !== undefined) {
      if (Array.isArray(result.value)) {
        console.debug(`[AutoSave] List field "${key}" — replacing with ${result.value.length} item(s)`);
      }
      filteredData[key] = result.value;
    } else if (isQueryField(fieldValue)) {
      // processFieldValue excluded it via isQueryField (pxResults shape) — register permanently.
      knownQueryFields.add(key);
      console.debug(`[AutoSave] Field "${key}" identified as query/data-page — permanently excluded.`);
    } else if (isCaseReferenceField(fieldValue, previousValue)) {
      // processFieldValue returned undefined — remember case-reference fields so future
      // saves (including empty-array unselect-all) continue to skip them.
      knownCaseReferenceFields.add(key);
      console.debug(`[AutoSave] Field "${key}" identified as Case Reference — permanently excluded.`);
    }
  });

  // Detect fields removed entirely from caseData (Pega removes key instead of setting null)
  if (previousData) {
    Object.keys(previousData).forEach(key => {
      if (isSystemField(key, false, true)) return;
      if (excludeSet.has(key)) return;
      if (key in filteredData) return; // already handled above
      // Never send null/[] for known read-only field types
      if (knownCaseReferenceFields.has(key)) return;
      if (knownQueryFields.has(key)) return;

      if (!(key in caseData)) {
        const prevVal = previousData[key];
        if (prevVal !== undefined && prevVal !== null) {
          console.debug(`[AutoSave] Field "${key}" removed from caseData - sending null to clear on server`);
          // For arrays that were removed, send empty array to clear the list
          filteredData[key] = Array.isArray(prevVal) ? [] : null;
        }
      }
    });
  }

  return filteredData;
}

/**
 * Builds pageInstructions to delete list items that were removed by the user.
 *
 * Pega's save endpoint merges list items by pxSubscript — sending a shorter list
 * does NOT remove the extra items. Instead we must send explicit DELETE instructions
 * for each subscript index that existed before but is no longer in the current list.
 *
 * Format: { instruction: "DELETE", target: ".FieldName(N)" }
 */
function buildPageInstructions(
  filteredData: Record<string, any>,
  previousData: Record<string, any> | null
): any[] {
  if (!previousData) return [];

  const instructions: any[] = [];

  Object.keys(filteredData).forEach(key => {
    const currentVal = filteredData[key];
    const previousVal = previousData[key];

    if (!Array.isArray(currentVal) || !Array.isArray(previousVal)) return;

    const previousCount = previousVal.length;
    const currentCount = currentVal.length;

    // Generate DELETE instructions for each subscript index that no longer exists.
    // Subscripts are 1-based. We delete from the highest index down to avoid
    // re-indexing issues on the server side.
    for (let i = previousCount; i > currentCount; i -= 1) {
      instructions.push({
        instruction: 'DELETE',
        target: `.${key}(${i})`,
      });
    }
  });

  return instructions;
}

/** Logs current vs previous state for list fields to help diagnose reference-list save issues. */
function logListFieldChanges(
  filteredData: Record<string, any>,
  previousData: Record<string, any> | null
): void {
  Object.keys(filteredData).forEach(k => {
    if (Array.isArray(filteredData[k])) {
      console.debug(`[AutoSave] List field "${k}" current (${filteredData[k].length} items):`, JSON.stringify(filteredData[k]));
      console.debug(`[AutoSave] List field "${k}" previous (${previousData?.[k]?.length ?? 'none'} items):`, JSON.stringify(previousData?.[k]));
    }
  });
}

/** Builds the save API payload including pageInstructions for list fields. */
function buildSavePayload(
  assignmentID: string,
  actionID: string,
  etag: string,
  filteredData: Record<string, any>,
  previousData: Record<string, any> | null
) {
  const pageInstructions = buildPageInstructions(filteredData, previousData);
  return {
    queryPayload: { assignmentID, actionID },
    body: {
      content: filteredData,
      // pageInstructions sends DELETE instructions for list items removed by the user.
      // Without this, the server merges by pxSubscript and keeps deleted rows.
      ...(pageInstructions.length > 0 && { pageInstructions }),
    },
    headers: { 'if-match': etag },
  };
}

/** State shared between performSave, onSaveSuccess, and onSaveError within one effect lifetime. */
interface SaveContext {
  isActive: () => boolean;
  isSaving: boolean;
  pendingSaveRequested: boolean;
  previousDataRef: React.MutableRefObject<Record<string, any> | null>;
  saveIntervalRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>;
  /**
   * Fields temporarily excluded after a server-side validation 422 (e.g. invalid email format).
   * Re-admitted automatically once the user changes their value.
   */
  validationExcludedFields: Set<string>;
  validationFailedValues: Record<string, any>;
  /** Field names that have ever been identified as Case Reference — always excluded. */
  knownCaseReferenceFields: Set<string>;
  /**
   * Field names identified as data-page / query fields by a 422 "Error loading Data Page"
   * server response. Permanently excluded from all future save payloads.
   */
  knownQueryFields: Set<string>;
  pConn: any;
}

/**
 * Builds the combined exclude set from the prop string and currently-invalid fields.
 * Re-admits fields whose value changed since the last validation failure.
 */
function buildExcludeSet(
  excludeFields: string,
  caseData: Record<string, any>,
  validationExcludedFields: Set<string>,
  validationFailedValues: Record<string, any>
): Set<string> {
  const excludeSet = new Set(excludeFields.split(',').map(f => f.trim()).filter(Boolean));
  validationExcludedFields.forEach(field => {
    const currentVal = JSON.stringify(caseData[field] ?? null);
    const failedVal = JSON.stringify(validationFailedValues[field] ?? null);
    if (currentVal !== failedVal) {
      validationExcludedFields.delete(field);
      delete validationFailedValues[field];
      console.log(`[AutoSave] Field "${field}" value changed — re-including in payload.`);
    } else {
      excludeSet.add(field);
    }
  });
  return excludeSet;
}

/** Handles a successful save API response. */
function handleSaveSuccess(
  response: any,
  ctx: SaveContext,
  filteredData: Record<string, any>,
  performSave: () => void
): void {
  ctx.isSaving = false;
  if (!ctx.isActive()) return;
  const updatedEtag = response.headers.etag;
  (window as any).PCore.getContainerUtils().updateCaseContextEtag(ctx.pConn.getContextName(), updatedEtag);
  ctx.previousDataRef.current = JSON.parse(JSON.stringify(filteredData));
  console.timeEnd('[AutoSave] Total save time');
  console.log('✓ [AutoSave] Completed successfully');
  if (ctx.pendingSaveRequested) {
    ctx.pendingSaveRequested = false;
    console.log('[AutoSave] Executing queued follow-up save...');
    setTimeout(performSave, 100);
  }
}

/** Handles a failed save API response. */
function handleSaveError(
  error: any,
  ctx: SaveContext,
  filteredData: Record<string, any>,
  caseData: Record<string, any>
): void {
  ctx.isSaving = false;
  ctx.pendingSaveRequested = false;
  console.error('[AutoSave] API request failed:', error);
  console.error('[AutoSave] Error details:', error.message);
  if (error?.response?.data) {
    console.error('[AutoSave] Server error response body:', JSON.stringify(error.response.data, null, 2));
  }
  console.error('[AutoSave] Fields sent in payload:', Object.keys(filteredData));
  console.timeEnd('[AutoSave] Total save time');
  const status = error?.response?.status;
  if (status === 409) {
    console.warn('[AutoSave] 409 Conflict - etag is stale, will retry on next save trigger.');
    ctx.previousDataRef.current = null;
    return;
  }
  if (status === 400) {
    // 400 Bad Request — likely an undetected query/data-page field in the payload.
    // Reset the snapshot so the next save retries with a fresh field scan.
    // The knownQueryFields Set will grow as offending fields are discovered
    // via 422 responses on subsequent attempts.
    console.warn('[AutoSave] 400 Bad Request — payload likely contains an undetected query field. Resetting snapshot to retry.');
    ctx.previousDataRef.current = null;
    return;
  }
  if (status === 422) {
    const errorDetails: any[] = error?.response?.data?.errorDetails ?? [];
    errorDetails.forEach((detail: any) => {
      const identifier: string = detail.erroneousInputOutputIdentifier ?? '';
      const fieldName = identifier.startsWith('.') ? identifier.slice(1) : identifier;
      const message: string = detail.message ?? '';
      const isDataPageError = /loading Data Page|loading D_/i.test(message);
      if (isDataPageError && fieldName) {
        // Data-page fields are read-only — permanently exclude them regardless of value.
        ctx.knownQueryFields.add(fieldName);
        ctx.validationExcludedFields.delete(fieldName);
        delete ctx.validationFailedValues[fieldName];
        console.warn(`[AutoSave] Field "${fieldName}" identified as data-page/query field by server — permanently excluded.`);
      } else if (fieldName) {
        // Format/validation errors (e.g. invalid email) — temporarily exclude the field.
        // It will be re-admitted automatically once the user corrects its value,
        // allowing all other fields to continue saving in the meantime.
        ctx.validationExcludedFields.add(fieldName);
        ctx.validationFailedValues[fieldName] = caseData[fieldName] ?? null;
        console.warn(`[AutoSave] Field "${fieldName}" temporarily excluded after validation error — will re-include once value changes.`);
      }
    });
    console.warn('[AutoSave] 422 Validation error — affected fields excluded, will retry on next trigger.');
    return;
  }
  console.warn(`[AutoSave] Stopping autosave due to ${status ?? 'unknown'} error.`);
  stopInterval(ctx.saveIntervalRef);
}

/**
 * Props interface for the AutoSaveForm component
 * Extends PConnFieldProps from Pega Constellation to include autosave-specific properties
 */
interface CitiExtensionsAutoSaveFormProps extends PConnFieldProps {
  /** Enable or disable autosave functionality */
  autoSaveEnabled?: boolean;
  /** Time interval in milliseconds between save attempts (default: 5000ms) */
  autoSaveInterval?: number;
  /**
   * Comma-separated list of field names to explicitly exclude from the save payload.
   * Use this for Query-type fields and any other fields the server rejects.
   * Example: "SampleQuerySingle,SampleQueryList"
   */
  excludeFields?: string;
}

/**
 * CitiExtensionsAutoSaveForm Component
 * 
 * A background autosave component that:
 * 1. Listens for field changes on the current page
 * 2. Periodically saves all form fields to the case at specified interval
 * 3. Maintains etag for optimistic concurrency control
 * 4. Runs completely invisible to the end user
 * 
 * @param {CitiExtensionsAutoSaveFormProps} props - Component props
 * @returns {null} This component renders nothing (background only)
 */
function CitiExtensionsAutoSaveForm(props: CitiExtensionsAutoSaveFormProps) {
  // Destructure props
  const {
    getPConnect,
    autoSaveEnabled = false,
    autoSaveInterval = 5000,
    excludeFields = ''
  } = props;

  // Get the PConnect context from Constellation
  const pConn = getPConnect();

  // Ref to track the save interval timer ID for cleanup
  const saveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ref to track the previous form data snapshot for change detection
  const previousDataRef = useRef<Record<string, any> | null>(null);

  // Ref to track whether there are unsaved changes
  const hasChangesRef = useRef<boolean>(false);

  /**
   * Main setup effect hook
   * 
   * Sets up autosave by:
   * - Setting up an interval timer to periodically save form data
   * - Cleaning up timer on component unmount or settings change
   */
  useEffect(() => {
    // Skip setup if autosave is not enabled
    if (!autoSaveEnabled) {
      console.log('[AutoSave] AutoSave is disabled');
      return;
    }

    console.log(`[AutoSave] Initializing with interval: ${autoSaveInterval}ms`);

    // Track whether this specific effect invocation is still active.
    // Set to false in the cleanup to prevent stale closures (e.g. when pConn changes
    // due to openAssignment) from firing API calls after the effect is torn down.
    let isActive = true;

    // Capture the assignment ID at the time this effect initializes.
    // If the assignment changes (openAssignment opens a different task), the interval
    // will detect the mismatch and abort before hitting the API.
    const initialAssignmentID = pConn.getValue((window as any).PCore.getConstants().CASE_INFO.ASSIGNMENT_ID);
    if (!initialAssignmentID) {
      console.log('[AutoSave] No active assignment at initialization - autosave will not start');
      return;
    }
    console.debug('[AutoSave] Initialized for assignment:', initialAssignmentID);

    // Fields that failed server-side validation are temporarily excluded from the payload.
    // They are re-included automatically once the user changes their value.
    const validationExcludedFields = new Set<string>();
    const validationFailedValues: Record<string, any> = {};

    // Shared mutable state passed into extracted helpers.
    // Using an object allows helpers to mutate isSaving/pendingSaveRequested by reference.
    const ctx: SaveContext = {
      isActive: () => isActive,
      isSaving: false,
      pendingSaveRequested: false,
      previousDataRef,
      saveIntervalRef,
      validationExcludedFields,
      validationFailedValues,
      knownCaseReferenceFields: new Set<string>(),
      knownQueryFields: new Set<string>(),
      pConn,
    };

    const performSave = () => {
      if (!isActive || !saveIntervalRef.current) return;
      if (ctx.isSaving) {
        ctx.pendingSaveRequested = true;
        console.log('[AutoSave] Save already in progress - queuing follow-up save');
        return;
      }

      // Guard: verify assignment hasn't changed since effect initialized
      const currentAssignmentID = pConn.getValue((window as any).PCore.getConstants().CASE_INFO.ASSIGNMENT_ID);
      if (!currentAssignmentID) {
        console.log('[AutoSave] No active assignment - skipping');
        return;
      }
      if (currentAssignmentID !== initialAssignmentID) {
        console.log('[AutoSave] Assignment changed - stopping stale interval');
        stopInterval(saveIntervalRef);
        return;
      }

      const caseData = pConn.getValue('caseInfo.content') || {};
      const excludeSet = buildExcludeSet(excludeFields, caseData, validationExcludedFields, validationFailedValues);
      const filteredData = buildFilteredData(caseData, excludeSet, previousDataRef.current, ctx.knownCaseReferenceFields, ctx.knownQueryFields);

      logListFieldChanges(filteredData, previousDataRef.current);

      if (previousDataRef.current && deepEqual(filteredData, previousDataRef.current)) {
        console.log('[AutoSave] No changes detected - skipping');
        hasChangesRef.current = false;
        return;
      }

      hasChangesRef.current = true;
      console.log('[AutoSave] Changes detected - saving...');
      console.time('[AutoSave] Total save time');

      const etag = pConn.getValue('caseInfo.headers.etag');
      const actionID = pConn.getValue((window as any).PCore.getConstants().CASE_INFO.ACTIVE_ACTION_ID)
        || pConn.getValue((window as any).PCore.getConstants().CASE_INFO.ASSIGNMENTACTION_ID);

      const payload = buildSavePayload(currentAssignmentID, actionID, etag, filteredData, previousDataRef.current);

      console.log(`[AutoSave] Sending ${Object.keys(filteredData).length} fields to API...`);
      console.debug('[AutoSave] Full payload:', JSON.stringify(payload));

      ctx.isSaving = true;

      (window as any).PCore.getRestClient()
        .invokeRestApi('save', payload)
        .then((response: any) => handleSaveSuccess(response, ctx, filteredData, performSave))
        .catch((error: any) => handleSaveError(error, ctx, filteredData, caseData));
    };

    /**
     * Log context info for debugging
     */
    console.debug('[AutoSave] Context name:', pConn.getContextName());
    console.debug('[AutoSave] Page reference:', pConn.getPageReference());

    // Clear any existing interval to avoid duplicates
    if (saveIntervalRef.current) {
      console.log('[AutoSave] Clearing existing interval');
      clearInterval(saveIntervalRef.current);
    }

    // Set up interval timer to periodically save all form data
    console.log(`[AutoSave] Setting up save interval: every ${autoSaveInterval}ms`);
    saveIntervalRef.current = setInterval(performSave, autoSaveInterval);

    // Subscribe to the Pega Redux store to detect field changes as they happen.
    // A debounce ensures we read caseInfo.content only after the store has fully settled.
    const STORE_DEBOUNCE_MS = 300;
    let storeChangeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribeStore = (window as any).PCore.getStore().subscribe(() => {
      if (!isActive) return;
      if (ctx.isSaving) {
        ctx.pendingSaveRequested = true;
        return;
      }
      // Always reset the debounce on every store update — this ensures we read
      // caseInfo.content only after the store has fully settled
      if (storeChangeDebounceTimer) clearTimeout(storeChangeDebounceTimer);
      storeChangeDebounceTimer = setTimeout(() => {
        if (isActive && !ctx.isSaving) performSave();
      }, STORE_DEBOUNCE_MS);
    });

    /**
     * Cleanup function
     * Called when:
     * - Component unmounts
     * - autoSaveEnabled becomes false
     * - autoSaveInterval changes
     * Cleans up the save interval timer
     */
    return () => {
      console.log('[AutoSave] Cleaning up...');
      isActive = false;
      if (storeChangeDebounceTimer) clearTimeout(storeChangeDebounceTimer);
      unsubscribeStore();
      stopInterval(saveIntervalRef);
      console.log('[AutoSave] Cleanup completed');
    };
  }, [pConn, autoSaveEnabled, autoSaveInterval, excludeFields]);

  /**
   * Render nothing
   * This component is entirely background-focused and doesn't display any UI
   * The autosave functionality runs silently without user knowledge
   */
  return null;
}

export default withConfiguration(CitiExtensionsAutoSaveForm);
