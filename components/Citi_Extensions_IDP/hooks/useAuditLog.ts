import { useState, useRef, useCallback } from 'react';
import type { MutableRefObject } from 'react';
import type { FieldChange } from '../idpTypes';
import type { dataPageType, PageData, AuditCounts } from '../utils/helpers';
import {
  parseAuditLogPage,
  parseAuditCounts,
  normalizeAuditLogData,
  incrementVersion,
  resolveCaseId,
  resolveCaseKey,
  parseFieldHistoryStatusRows
} from '../utils/helpers';
import { DEFAULT_AUDIT_LOG_DATA_PAGE, DEFAULT_FIELD_HISTORY_DATA_PAGE } from '../utils/constants';

interface UseAuditLogOptions {
  auditLogDataPage?: string;
  fetchAuditLogDataPage: PageData;
  fetchDataPage: (
    dataPage: string,
    parameters: Record<string, unknown>,
    type?: dataPageType
  ) => Promise<unknown>;
  pConnRef: MutableRefObject<any>;
  selectedDocTypeId: string;
  documentType?: string;
  /** Data page providing case field history (defaults to D_pyFieldHistory). */
  fieldHistoryDataPage?: string;
}

interface UseAuditLogResult {
  auditLogHistory: FieldChange[];
  /** Field-count statistics from the most-recently persisted audit log entry. */
  auditLogCounts: AuditCounts | null;
  /** Work-status audit rows sourced from the OOTB field-history data page. */
  workStatusHistory: FieldChange[];
  pendingAuditChangesRef: MutableRefObject<FieldChange[]>;
  saveAuditLog: (counts: AuditCounts) => Promise<void>;
  /** Re-fetches audit log history from the API (call after a successful save). */
  refreshAuditLog: () => void;
  /** Fetches audit log for an explicit caseId + documentId pair. */
  fetchAuditLog: (caseId: string, documentId: string) => Promise<void>;
  /** Clears all audit state and refs; call before each schema registry fetch to avoid stale data. */
  resetAuditLog: () => void;
}

export function useAuditLog({
  auditLogDataPage,
  fetchAuditLogDataPage,
  fetchDataPage,
  pConnRef,
  selectedDocTypeId,
  documentType,
  fieldHistoryDataPage
}: UseAuditLogOptions): UseAuditLogResult {
  const [auditLogHistory, setAuditLogHistory] = useState<FieldChange[]>([]);
  const [auditLogCounts, setAuditLogCounts] = useState<AuditCounts | null>(null);
  const [workStatusHistory, setWorkStatusHistory] = useState<FieldChange[]>([]);
  const existingAuditRef = useRef<{
    version: string;
    entries: Array<Record<string, unknown>>;
  }>({ version: '', entries: [] });
  const pendingAuditChangesRef = useRef<FieldChange[]>([]);

  const saveAuditLog = useCallback(
    (counts: AuditCounts): Promise<void> => {
      const pendingChanges = pendingAuditChangesRef.current;
      if (pendingChanges.length === 0) return Promise.resolve();
      const auditDataPage = auditLogDataPage || 'D_DynamicViewAuditLogSavable';

      const newEntries = pendingChanges.map(c => ({
        Section: c.sectionLabel,
        Field: c.fieldLabel,
        previousValue: c.previousValue,
        newValue: c.newValue,
        user: c.updatedBy,
        timestamp: c.updatedTime,
        entryType: c.entryType ?? 'field'
      }));

      const existing = existingAuditRef.current;
      const version = existing.version ? incrementVersion(existing.version) : 'V1';
      const mergedEntries = existing.entries.length
        ? [...existing.entries, ...newEntries]
        : newEntries;
      const caseId = resolveCaseId(pConnRef.current);
      const contextName = pConnRef.current?.getContextName?.() ?? 'root';

      const auditLogData = JSON.stringify(mergedEntries);

      const data: Record<string, unknown> = {
        CaseID: caseId,
        DocumentID: selectedDocTypeId,
        DocumentType: documentType,
        Version: version,
        // Counts as top-level fields
        TotalFieldsInSchema: counts.TotalFieldsInSchema,
        FieldsFromIdp: counts.FieldsFromIdp,
        FieldsAdded: counts.FieldsAdded,
        FieldsModified: counts.FieldsModified,
        // Entries-only array
        AuditLogData: auditLogData
      };

      console.log('[AuditLog] Saving —', {
        version,
        CaseID: caseId,
        DocumentID: selectedDocTypeId,
        DocumentType: documentType,
        context: contextName,
        entries: mergedEntries.length,
        counts
      });

      return (PCore.getRestClient() as any)
        .invokeRestApi(
          'createDataObject',
          {
            queryPayload: { data_view_ID: auditDataPage },
            body: { data }
          },
          contextName
        )
        .then((res: any) => {
          if (res?.status && res.status >= 400) {
            const msg = `[AuditLog] REST save failed: ${res.status}`;
            console.error(msg, res.data ?? res);
            throw new Error(msg);
          }
          pendingAuditChangesRef.current = [];
          existingAuditRef.current = { version, entries: mergedEntries };
          console.log('[AuditLog] REST save success, version:', version);
        })
        .catch((err: unknown) => {
          const e = err as any;
          const detail = e?.response?.data ?? e?.data ?? e?.message ?? e;
          console.error(
            '[AuditLog] REST save error:',
            e?.response?.status ?? e?.status,
            typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2)
          );
          throw err;
        });
    },
    [auditLogDataPage, selectedDocTypeId, documentType, pConnRef]
  );

  // Fetches historical audit-log entries for the current case id + document id.
  const fetchAuditLog = useCallback(
    async (caseId: string, documentId: string) => {
      if (!caseId || !documentId) return;
      const fetchDataPageName = fetchAuditLogDataPage?.source || DEFAULT_AUDIT_LOG_DATA_PAGE;
      console.log('[AuditLog][diag] fetching', fetchDataPageName, {
        CaseID: caseId,
        DocumentID: documentId
      });
      try {
        const page = (await fetchDataPage(
          fetchDataPageName,
          { CaseID: caseId, DocumentID: documentId },
          'page'
        )) as Record<string, unknown>;
        console.log('[AuditLog][diag] page received:', page);
        const responseField = fetchAuditLogDataPage.fields.jsonField.split('.').pop() ?? '';
        setAuditLogHistory(parseAuditLogPage(page));
        setAuditLogCounts(parseAuditCounts(page));

        const rawAuditData = page ? page[responseField] ?? page['AuditLogData'] : null;
        if (rawAuditData) {
          const existingEntries = normalizeAuditLogData(rawAuditData);
          existingAuditRef.current = {
            version: typeof page['Version'] === 'string' ? page['Version'] : 'V1',
            entries: existingEntries
          };
        } else {
          existingAuditRef.current = { version: '', entries: [] };
        }
      } catch (error) {
        console.error(`Unable to fetch audit log history: ${String(error)}`);
      }

      // Work-status rows come from the OOTB field-history data page so their
      // prior/new values, performer, and time match Pega's native history.
      const caseKey = resolveCaseKey(pConnRef.current);
      if (!caseKey) return;
      try {
        // D_pyFieldHistory takes the case key as the `InsKey` parameter — the
        // same request the OOTB field-history table makes (no query filter).
        const rows = (await fetchDataPage(
          fieldHistoryDataPage || DEFAULT_FIELD_HISTORY_DATA_PAGE,
          { InsKey: caseKey },
          'list'
        )) as Array<Record<string, unknown>>;
        const resolvedCaseId = resolveCaseId(pConnRef.current);
        setWorkStatusHistory(parseFieldHistoryStatusRows(rows, resolvedCaseId));
      } catch (error) {
        console.error(`Unable to fetch work-status field history: ${String(error)}`);
      }
    },
    [fetchAuditLogDataPage, fetchDataPage, fieldHistoryDataPage, pConnRef]
  );

  const resetAuditLog = useCallback(() => {
    setAuditLogHistory([]);
    setAuditLogCounts(null);
    setWorkStatusHistory([]);
    existingAuditRef.current = { version: '', entries: [] };
    pendingAuditChangesRef.current = [];
  }, []);

  return {
    auditLogHistory,
    auditLogCounts,
    workStatusHistory,
    pendingAuditChangesRef,
    saveAuditLog,
    fetchAuditLog,
    resetAuditLog,
    refreshAuditLog: () => {
      const caseId = resolveCaseId(pConnRef.current);
      if (caseId && selectedDocTypeId) fetchAuditLog(caseId, selectedDocTypeId);
    }
  };
}
