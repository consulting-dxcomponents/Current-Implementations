import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import {
  Progress,
  Banner,
  ErrorState,
  withConfiguration,
  forceRegisterIcon
} from '@pega/cosmos-react-core';
import * as warnSolidIcon from '@pega/cosmos-react-core/lib/components/Icon/icons/warn-solid.icon';
import type { PConnFieldProps } from './PConnProps';
import './create-nonce';
import {
  ActionPayload,
  ACTION_TARGET,
  ACTION_TYPE,
  DocumentSpec,
  FieldChange,
  IdpFieldSpec
} from './idpTypes';
import {
  normalizeResponseToViewModel,
  getExtractedDataForDocument,
  type ConfidenceData,
  checkPayloadDocumentTypeAndCategory,
  
  getBoundingBoxForDocument
} from './schema/responseNormalizer';
import { SchemaRegistryService } from './schema/schemaRegistry';
import ChangeLog from './components/ChangeLog';
import { fetchWithBackoff } from './api/dataPageClient';
import { buildModifiedIdpPayload, buildSkeletonPayload } from './schema/responseBuilder';
import StyledCitiExtensionsIdpWrapper, { StyledReviewPanel, StyledBreakoutWrapper } from './styles';
import ReviewPanel from './components/ReviewPanel';
import type { ReviewPanelHandle } from './components/ReviewPanel';
import type { FieldFocusInfo } from './components/DetailsRender';
import type { PageData } from './utils/helpers';
import {
  incrementVersion,
  resolveCaseId,
  extractIdpError,
  computeFieldCounts,
  scrollAncestorsToTop,
  filterBusinessFields,
  parseConfidenceRaw,
  LATEST_ASSIGNMENT_ETAG_KEY,
  registerAssignmentEtagInterceptor
} from './utils/helpers';
import { useAuditLog } from './hooks/useAuditLog';
import {
  DEFAULT_SCHEMA_REGISTRY_DATA_PAGE,
  ACTION_BAR_EVENT,
  VIEWER_STATE_CHANGED,
  DV_FIELD_HIGHLIGHT_EVENT
} from './utils/constants';

// Register the warn-solid icon so it is available in FieldGroup action badges.
forceRegisterIcon(warnSolidIcon);

interface CitiExtensionsIdpProps extends Omit<PConnFieldProps, 'label'> {
  idpSpec?: DocumentSpec;
  NumCols?: string;
  schemaRegistryDataPage: PageData;
  fetchAuditLogDataPage: PageData;
  idpDataPage: PageData;
  loadConfidenceScore?: boolean | string;
  readOnlyMode?: boolean | string;
  auditLogDataPage?: string;
  idpSavableDataPage?: string;
  /** Data page providing case field history (defaults to D_pyFieldHistory). */
  fieldHistoryDataPage?: string;
}

// ─── Root component ───────────────────────────────────────────────────────────

function CitiExtensionsIdp(props: CitiExtensionsIdpProps) {
  const {
    idpSpec,
    NumCols = '1',
    getPConnect,
    schemaRegistryDataPage,
    fetchAuditLogDataPage,
    idpDataPage,
    loadConfidenceScore,
    readOnlyMode,
    auditLogDataPage,
    idpSavableDataPage,
    fieldHistoryDataPage
  } = props;

  // ─── Derived props ────────────────────────────────────────────────────────

  /** Show confidence score unless explicitly disabled via prop. */
  const showConfidenceScore =
    loadConfidenceScore === undefined
      ? true
      : loadConfidenceScore !== false && loadConfidenceScore !== 'false';
  /** All fields read-only when readOnlyMode is explicitly true/"true". */
  const isReadOnly = readOnlyMode === true || readOnlyMode === 'true';
  /** Number of review-panel columns (defaults to 1). */
  const nCols = parseInt(NumCols, 10) || 1;

  // ─── State ────────────────────────────────────────────────────────────────

  /** Net field changes (one entry per field) recorded by the reviewer. */
  const [changes, setChanges] = useState<FieldChange[]>([]);
  /** Runtime document spec resolved from the schema registry. */
  const [runtimeSpec, setRuntimeSpec] = useState<DocumentSpec | undefined>(idpSpec);
  /** Runtime field values and repeatable rows from the normalised IDP response. */
  const [runtimeData, setRuntimeData] = useState<{
    resolvedValues: Record<string, string>;
    repeatableRows: Record<string, Array<Record<string, string>>>;
  }>({ resolvedValues: {}, repeatableRows: {} });
  /** Per-field and per-repeatable confidence scores from the IDP response. */
  const [runtimeConfidenceData, setRuntimeConfidenceData] = useState<ConfidenceData>({
    fields: {},
    repeatables: {}
  });
  /** Raw IDP response payload (parsed JSON) fetched from the data page. */
  const [idpPayload, setIdpPayload] = useState<unknown>(null);
  /** Confidence score map fetched from a separate column on the IDP data page (Batch API). */
  const [rawConfidenceData, setRawConfidenceData] = useState<unknown>(null);
  const [rawBoundingBoxData, setRawBoundingBoxData] = useState<unknown>(null);
  /** Counts snapshot saved after the most recent successful save — used to avoid transient
   *  zeros while the audit log data page refreshes after an EventType='User' reload. */
  const [persistedCounts, setPersistedCounts] = useState<
    import('./utils/helpers').AuditCounts | null
  >(null);
  /** Active document (id + category/type) resolved from the cascade field. */
  const [selectedDocument, setSelectedDocument] = useState<{ id: string; type: string }>({
    id: '',
    type: ''
  });
  const { id: selectedDocTypeId, type: selectedDocType } = selectedDocument;
  /** Component load status and accompanying progress bar message. */
  const [loadState, setLoadState] = useState<{
    status: 'loading' | 'inline-loading' | 'mounted' | 'error';
    message: string;
  }>({ status: 'loading', message: '' });
  /** All UI messages (error / warning / success) in one place. */
  const [appMessages, setAppMessages] = useState<
    Array<{ type: 'error' | 'warning' | 'success'; text: string }>
  >([]);
  /** Ref to call ReviewPanel's save/validation flow imperatively. */
  const reviewPanelRef = useRef<ReviewPanelHandle>(null);
  /** True while the IDP response and audit log are being persisted. */
  const [isSaving, setIsSaving] = useState(false);

  // Ref keeps handlePanelSave current without a stale closure when save() is called synchronously
  const actionBarPayloadRef = useRef<ActionPayload | null>(null);

  // ── Derived message selectors ───────────────────────────────────────────
  const errorMessage = appMessages.find(m => m.type === 'error')?.text ?? null;

  // ─── Refs ─────────────────────────────────────────────────────────────────

  /** Latest pConn instance — updated each render, read inside effects/callbacks. */
  const pConn = getPConnect();
  const pConnRef = useRef(pConn);
  pConnRef.current = pConn;
  /** Root wrapper div — used to measure breakout position and scroll to top. */
  const rootRef = useRef<HTMLDivElement>(null);
  /** Breakout wrapper div (ChangeLog + SaveRow) — receives dynamic width/margin. */
  const breakoutRef = useRef<HTMLDivElement>(null);
  /** Latest raw IDP page response — used as cascade guard and when building the save payload. */
  const rawIdpPageResponseRef = useRef<Record<string, unknown> | null>(null);
  /** Stable ref to logError — lets effects call the latest version without re-registering. */
  const logErrorRef = useRef<(msg: string, type?: 'error' | 'warning') => void>(() => {});
  /** Mirrors idpPayload state so cascade callbacks always read the latest parsed payload. */
  const idpPayloadRef = useRef(idpPayload);
  idpPayloadRef.current = idpPayload;
  /** Most recently observed document type — used as the previous value for a reclassification. */
  const observedDocumentTypeRef = useRef('');
  /** Tracks whether the initial document type, including a blank/select placeholder, was observed. */
  const hasObservedDocumentTypeRef = useRef(false);
  /** Becomes true only after the initial document schema has loaded. */
  const isDocumentTypeAuditReadyRef = useRef(false);
  /** Schema-registry display names keyed by their technical document type. */
  const documentTypeDisplayByTypeRef = useRef(new Map<string, string>());

  // ─── Stable callbacks ─────────────────────────────────────────────────────

  /** Adds a message or sets the blocking error; replaces any existing message of the same type. */
  const logError = useCallback((userMsg: string, logType: 'error' | 'warning' = 'error') => {
    if (logType === 'error') {
      setAppMessages(prev => [
        ...prev.filter(m => m.type !== 'error'),
        { type: 'error', text: userMsg }
      ]);
      setLoadState({ status: 'error', message: '' });
    } else {
      setAppMessages(prev => [...prev, { type: 'warning', text: userMsg }]);
    }
  }, []);

  /** Fetches a data page via the current pConn, with automatic retry backoff. */
  const fetchDataPage = useCallback(
    async (
      dataPage: string,
      parameters: Record<string, unknown>,
      type: 'list' | 'page' = 'list',
      query: Record<string, unknown> = {}
    ) => {
      return fetchWithBackoff(pConn, dataPage, parameters, type, undefined, query);
    },
    [pConn]
  );

  // ─── Services ─────────────────────────────────────────────────────────────

  /** Schema registry client — rebuilt only when data page config changes. */
  const schemaRegistryService = useMemo(() => {
    const schemaParamKeys = Object.keys(schemaRegistryDataPage?.parameters ?? {});
    return new SchemaRegistryService(fetchDataPage as any, {
      dataPageName: schemaRegistryDataPage?.source ?? DEFAULT_SCHEMA_REGISTRY_DATA_PAGE,
      docTypeParamName: schemaParamKeys[0] ?? 'DocType',
      schemaFieldCandidates: [schemaRegistryDataPage.fields.jsonField.split('.').pop() ?? '']
    });
  }, [
    fetchDataPage,
    schemaRegistryDataPage?.parameters,
    schemaRegistryDataPage?.source,
    schemaRegistryDataPage.fields
  ]);

  // ─── Effects ──────────────────────────────────────────────────────────────

  /** Keeps logErrorRef current so effects always call the latest version. */
  useEffect(() => {
    logErrorRef.current = logError;
  }, [logError]);

  /** Measures and updates the breakout wrapper position/width after mount and on resize. */
  useLayoutEffect(() => {
    if (loadState.status !== 'mounted' || errorMessage) return;
    const root = rootRef.current;
    const breakout = breakoutRef.current;
    if (!root || !breakout) return;
    const measure = () => {
      let row: HTMLElement | null = root.parentElement;
      while (row && row.clientWidth < root.clientWidth * 1.5) row = row.parentElement;
      if (!row) return;
      const shift = root.getBoundingClientRect().left - row.getBoundingClientRect().left;
      breakout.style.marginLeft = `-${shift}px`;
      breakout.style.width = `${row.clientWidth}px`;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    if (root.parentElement) observer.observe(root.parentElement);
    return () => observer.disconnect();
  }, [loadState.status, errorMessage]);

  const fetchIDPResponse = useCallback(
    async (cancelled: boolean) => {
      setAppMessages([]);
      setLoadState({ status: 'loading', message: 'Fetching IDP response...' });
      try {
        const latestResolvedParameters =
          pConn.resolveConfigProps?.(idpDataPage.parameters ?? {}) ?? idpDataPage.parameters ?? {};
        const res = (await fetchDataPage(
          idpDataPage.source,
          latestResolvedParameters,
          'page'
        )) as Record<string, unknown>;
        if (!cancelled) {
          rawIdpPageResponseRef.current = res;
          setLoadState(s => ({ ...s, message: 'Parsing response...' }));
          const responseField = idpDataPage.fields.jsonField.split('.').pop() ?? '';
          const parsedPayload =
            typeof res[responseField] === 'string'
              ? JSON.parse(String(res[responseField] ?? '{}'))
              : res[responseField] ?? {};
          const idpError = extractIdpError(parsedPayload as Record<string, unknown>);
          if (idpError) {
            console.error('[IDP] Logical failure in response payload:', idpError, parsedPayload);
            logErrorRef.current(idpError);
            return;
          }
          setIdpPayload(parsedPayload);
          setPersistedCounts(null); // reset on fresh IDP load
          const confKey = idpDataPage.fields?.confidenceScoreField?.split('.').pop() ?? '';
          const parsedConf = parseConfidenceRaw(res, confKey);
          if (parsedConf) setRawConfidenceData(parsedConf);
          const boundingBoxKey = idpDataPage.fields?.boundingBoxField?.split('.').pop() ?? '';
          const boundingBoxValue = boundingBoxKey ? res[boundingBoxKey] : null;
          if (boundingBoxValue != null && boundingBoxValue !== '') {
            const parsedBoundingBox =
              typeof boundingBoxValue === 'string'
                ? JSON.parse(boundingBoxValue)
                : boundingBoxValue;
            setRawBoundingBoxData(parsedBoundingBox);
          } else {
            setRawBoundingBoxData(null);
          }
          setLoadState({ status: 'mounted', message: '' });
        }
      } catch (error) {
        console.error(`Unable to fetch IDP response: ${String(error)}`);
        if (!cancelled)
          logErrorRef.current('Unable to fetch IDP response. Please try again later.');
      }
    },
    [fetchDataPage, idpDataPage, pConn]
  );

  /** Fetches the IDP response from the configured data page and seeds component state. */
  useEffect(() => {
    // Idempotently registers the interceptor used by the clipboard save flow.
    registerAssignmentEtagInterceptor();

    if (idpSpec || !idpDataPage?.source) {
      isDocumentTypeAuditReadyRef.current = true;
      setLoadState({ status: 'mounted', message: '' });
      return;
    }
    let cancelled = false;
    fetchIDPResponse(cancelled);
    return () => {
      cancelled = true;
    };
  }, [fetchIDPResponse, idpDataPage, idpSpec]);

  useEffect(() => {
    // 1. Define event metadata
    const subscriberId = 'ActionBar_RefreshListener';
    const subscribeOnce = false;
    const context = pConnRef.current?.getContextName?.(); // Fetches the runtime Pega context

    // 2. Define the callback logic
    const handleEvent = (payload: any) => {
      const nextPayload: ActionPayload = { type: payload?.type, target: payload?.target };
      actionBarPayloadRef.current = nextPayload;
      if (
        payload?.target === ACTION_TARGET.DYNAMIC_VIEW &&
        (payload?.type === ACTION_TYPE.SAVE_AND_SUBMIT || payload?.type === ACTION_TYPE.SAVE)
      ) {
        if (selectedDocType === 'Documents') {
          setAppMessages([
            { type: 'warning', text: 'Please reclassify to proceed further' }
          ]);
          setTimeout(() => {
            if (rootRef.current) scrollAncestorsToTop(rootRef.current);
          }, 0);
          return;
        }
        setAppMessages(prev => prev.filter(m => m.type !== 'warning' && m.type !== 'success'));
        reviewPanelRef.current?.save();
      }
    };

    // 3. Register the subscription with PCore
    PCore.getPubSubUtils().subscribe(
      ACTION_BAR_EVENT,
      handleEvent,
      subscriberId,
      subscribeOnce,
      context
    );

    // 4. Return cleanup function to unsubscribe on component unmount
    return () => {
      PCore.getPubSubUtils().unsubscribe(ACTION_BAR_EVENT, subscriberId, context);
    };
  }, [idpSpec, selectedDocType]); // Dependency array ensures cleanup runs if props change

  useEffect(() => {
    const subscriberId = 'ViewerStateChanged_Listener';
    const subscribeOnce = false;
    const context = pConnRef.current?.getContextName?.();

    // 2. Define the callback logic
    const handleViewerStateChangeEvent = async (payload: any) => {
      if (
        payload.pageCategoryID &&
        payload.docLabel &&
        !checkPayloadDocumentTypeAndCategory(
          idpPayloadRef.current,
          payload.pageCategoryID,
          payload.docLabel
        )
      ) {
        await fetchIDPResponse(false);
      }
      if (payload.pageCategoryID || payload.docLabel) {
        setSelectedDocument(prev => ({
          id: payload.pageCategoryID ?? prev.id,
          type: payload.docLabel ?? prev.type
        }));
      }
    };

    // 3. Register the subscription with PCore
    PCore.getPubSubUtils().subscribe(
      VIEWER_STATE_CHANGED,
      handleViewerStateChangeEvent,
      subscriberId,
      subscribeOnce,
      context
    );

    // 4. Return cleanup function to unsubscribe on component unmount
    return () => {
      PCore.getPubSubUtils().unsubscribe(VIEWER_STATE_CHANGED, subscriberId, context);
    };
  }, [idpSpec, fetchIDPResponse]);

  // ─── Audit log hook ───────────────────────────────────────────────────────

  /** Provides audit log history, pending changes ref, and the saveAuditLog function. */
  const {
    auditLogHistory,
    auditLogCounts,
    workStatusHistory,
    pendingAuditChangesRef,
    saveAuditLog,
    fetchAuditLog,
    refreshAuditLog,
    resetAuditLog
  } = useAuditLog({
    auditLogDataPage,
    fetchAuditLogDataPage,
    fetchDataPage,
    pConnRef,
    selectedDocTypeId,
    documentType: selectedDocType,
    fieldHistoryDataPage
  });

  const resetDynamicViewState = useCallback(() => {
    const pendingDocumentTypeChanges = pendingAuditChangesRef.current.filter(
      change => change.entryType === 'documentType'
    );
    resetAuditLog();
    pendingAuditChangesRef.current = pendingDocumentTypeChanges;
    setChanges(prev => prev.filter(change => change.entryType === 'documentType'));
  }, [pendingAuditChangesRef, resetAuditLog]);
  /** Stable ref so the normalize effect can call it without listing it as a dep. */
  const resetDynamicViewStateRef = useRef(resetDynamicViewState);
  resetDynamicViewStateRef.current = resetDynamicViewState;

  /** Fetches the document schema and normalises the IDP payload into a view-model. */
  useEffect(() => {
    if (
      rawIdpPageResponseRef?.current?.Status !== 'Failed' &&
      (idpSpec || !idpPayload || !selectedDocTypeId || !selectedDocType)
    ) {
      return;
    }
    const isDocumentTypeExists = checkPayloadDocumentTypeAndCategory(
      idpPayload,
      selectedDocTypeId,
      selectedDocType
    );
    if (!isDocumentTypeExists && rawIdpPageResponseRef?.current?.Status !== 'Failed') {
      setLoadState({ status: 'mounted', message: '' });
      logErrorRef.current(
        `No extracted data found of the ${selectedDocType}. Please reclassify this document to see the extracted details`
      );
      return;
    }
    let cancelled = false;
    const loadSchemaAndNormalize = async () => {
      resetDynamicViewStateRef.current();
      setAppMessages([]);
      setLoadState({ status: 'inline-loading', message: 'Fetching document schema...' });
      try {
        const schema = await schemaRegistryService.getSchemaForDocType(selectedDocType);
        if (!schema) throw new Error(`Schema not found for document type ${selectedDocType}`);
        if (!cancelled) setLoadState(s => ({ ...s, message: 'Normalizing response...' }));
        const normalized = normalizeResponseToViewModel({
          schema,
          payload: idpPayload,
          documentId: selectedDocTypeId,
          externalConfidenceData: rawConfidenceData
        });
        if (!cancelled) {
          documentTypeDisplayByTypeRef.current.set(
            selectedDocType,
            schema.docTypeDisplay ?? selectedDocType
          );
          setRuntimeSpec(normalized.idpSpec);
          setRuntimeData({
            resolvedValues: normalized.resolvedValues,
            repeatableRows: normalized.repeatableRows
          });
          setRuntimeConfidenceData(normalized.confidenceData);
          setLoadState({ status: 'mounted', message: '' });
          isDocumentTypeAuditReadyRef.current = true;
          const caseId = resolveCaseId(pConnRef.current);
          if (caseId && selectedDocTypeId) fetchAuditLog(caseId, selectedDocTypeId);
        }
      } catch (error) {
        console.error(`Unable to normalize schema/response: ${String(error)}`);
        if (!cancelled)
          logErrorRef.current(
            'Unable to load document schema. Please contact system administrator.'
          );
      }
    };
    loadSchemaAndNormalize();
    return () => {
      cancelled = true;
    };
  }, [
    idpPayload,
    idpSpec,
    schemaRegistryService,
    selectedDocTypeId,
    selectedDocType,
    rawConfidenceData,
    fetchAuditLog
  ]);

  /** Adds an audit row immediately when the viewer reclassifies the document.
   * This effect runs after the schema-loading effect, which clears stale audit data. */
  useEffect(() => {
    const isUnclassifiedDocumentType =
      !selectedDocType ||
      selectedDocType === 'Documents' ||
      selectedDocType.toLowerCase().includes('select');
    if (isUnclassifiedDocumentType) {
      observedDocumentTypeRef.current = selectedDocType?.trim() ?? '';
      hasObservedDocumentTypeRef.current = true;
      return;
    }

    const newDocumentTypeDisplay = documentTypeDisplayByTypeRef.current.get(selectedDocType);
    if (!newDocumentTypeDisplay) return;

    if (!isDocumentTypeAuditReadyRef.current) {
      observedDocumentTypeRef.current = selectedDocType;
      hasObservedDocumentTypeRef.current = true;
      return;
    }

    if (!hasObservedDocumentTypeRef.current) {
      observedDocumentTypeRef.current = selectedDocType;
      hasObservedDocumentTypeRef.current = true;
      return;
    }

    const previousDocumentType = observedDocumentTypeRef.current;
    if (previousDocumentType === selectedDocType) return;
    const caseId = resolveCaseId(pConnRef.current);
    if (caseId?.trim().toUpperCase().startsWith('DA')) {
      observedDocumentTypeRef.current = selectedDocType;
      return;
    }
    const previousDocumentTypeDisplay =
      documentTypeDisplayByTypeRef.current.get(previousDocumentType) ?? previousDocumentType;

    const documentTypeChange: FieldChange = {
      entryType: 'documentType',
      sectionLabel: 'Document Type',
      fieldLabel: 'Document Type',
      previousValue: previousDocumentTypeDisplay,
      newValue: newDocumentTypeDisplay,
      updatedBy: PCore.getEnvironmentInfo().getOperatorIdentifier?.() ?? '',
      updatedTime: new Date().toLocaleString(),
      caseId
    };
    pendingAuditChangesRef.current = [...pendingAuditChangesRef.current, documentTypeChange];
    setChanges(prev => [...prev, documentTypeChange]);
    observedDocumentTypeRef.current = selectedDocType;
  }, [pendingAuditChangesRef, runtimeSpec, selectedDocType]);

  // ─── Derived values ───────────────────────────────────────────────────────

  /** Effective document spec: prop takes precedence over runtime-normalised spec. */
  const effectiveSpec = idpSpec ?? runtimeSpec;
  /** Effective confidence data: empty when spec is provided directly (no IDP payload). */
  const effectiveExtractedData = useMemo(
    () =>
      idpPayload && selectedDocTypeId
        ? getExtractedDataForDocument(idpPayload, selectedDocTypeId)
        : undefined,
    [idpPayload, selectedDocTypeId]
  );
  /** Effective confidence data: empty when spec is provided directly (no IDP payload). */
  const emptyConfidence = useMemo<ConfidenceData>(() => ({ fields: {}, repeatables: {} }), []);
  const effectiveConfidenceData = idpSpec ? emptyConfidence : runtimeConfidenceData;

  /** Pre-computed AuditCounts for the ChangeLog display. */
  const displayCounts = useMemo(() => {
    const allChanges = [...auditLogHistory, ...changes];
    const eventType =
      typeof rawIdpPageResponseRef.current?.['EventType'] === 'string'
        ? (rawIdpPageResponseRef.current['EventType'] as string)
        : undefined;
    const hasIdpError = !!errorMessage;
    // Prefer persistedCounts (set immediately after save) over auditLogCounts (async refresh)
    // to avoid transient zeros while the audit log data page is re-fetching.
    const effectiveCounts = persistedCounts ?? auditLogCounts;
    return computeFieldCounts(effectiveSpec, {}, runtimeData.repeatableRows, allChanges, {
      eventType,
      hasIdpError,
      auditLogFieldsFromIdp: effectiveCounts?.FieldsFromIdp,
      auditLogNewlyAddedFields: effectiveCounts?.FieldsAdded,
      auditLogFieldsModified: effectiveCounts?.FieldsModified,
      auditLogChanges: auditLogHistory,
      pendingChanges: changes,
      extractedData: effectiveExtractedData
    });
  }, [
    effectiveSpec,
    auditLogHistory,
    changes,
    auditLogCounts,
    persistedCounts,
    effectiveExtractedData,
    runtimeData.repeatableRows,
    errorMessage
  ]);

  // ─── Callbacks ────────────────────────────────────────────────────────────

  /**
   * Records a field edit as its own audit row. Each commit appends a new entry
   * capturing the value immediately before this edit → the value after it, so a
   * field modified multiple times produces one row per change.
   */
  const handleFieldChange = useCallback(
    (sectionLabel: string, spec: IdpFieldSpec, previousValue: string, newValue: string) => {
      // Ignore no-op commits (value unchanged) so empty rows aren't logged.
      if ((previousValue ?? '').trim() === (newValue ?? '').trim()) {
        return;
      }
      const change: FieldChange = {
        sectionLabel,
        fieldLabel: spec.label,
        previousValue,
        newValue,
        updatedBy: PCore.getEnvironmentInfo().getOperatorIdentifier?.() ?? '',
        updatedTime: new Date().toLocaleString(),
        caseId: resolveCaseId(pConnRef.current)
      };
      pendingAuditChangesRef.current = [...pendingAuditChangesRef.current, change];
      setChanges(prev => [...prev, change]);
      setAppMessages([]);
    },
    [pendingAuditChangesRef]
  );

  /**
   * Entries rendered in the audit log: field edits (persisted history + pending)
   * combined with the work-status rows fetched from field history. Any legacy
   * work-status entries stored in our own audit log are dropped so the OOTB
   * field-history values are the single source of truth for status changes.
   */
  const changeLogEntries = useMemo(() => {
    const fieldEntries = [...auditLogHistory, ...changes].filter(
      c =>
        c.entryType !== 'workStatus' &&
        !(
          c.sectionLabel === 'Document Type' &&
          c.fieldLabel === 'Document Type' &&
          !c.newValue?.trim()
        )
    );
    return [...workStatusHistory, ...fieldEntries];
  }, [auditLogHistory, changes, workStatusHistory]);

  /** Persists the modified IDP payload to the savable data page via REST. */
  const saveIdpResponse = useCallback(
    (modified: unknown): Promise<void> => {
      const rawResponse = rawIdpPageResponseRef.current;
      const savableDataPageSource = idpSavableDataPage || 'D_IDPResponseSavable';
      if (!savableDataPageSource) return Promise.resolve();
      const responseKey = idpDataPage?.fields?.jsonField?.split('.').pop() ?? 'Response';
      const existingVersion =
        typeof rawResponse?.['Version'] === 'string' ? rawResponse['Version'] : null;
      const version = existingVersion ? incrementVersion(existingVersion) : 'V1';
      const updatedIdpResponse: Record<string, unknown> = {
        ...(rawResponse ? filterBusinessFields(rawResponse) : {}),
        Version: version,
        EventType: 'User',
        Status: 'Success',
        [responseKey]: JSON.stringify(modified)
      };
      return (PCore.getRestClient() as any)
        .invokeRestApi(
          'createDataObject',
          {
            queryPayload: { data_view_ID: savableDataPageSource },
            body: { data: updatedIdpResponse }
          },
          pConnRef.current?.getContextName?.() ?? 'root'
        )
        .then((saveRes: any) => {
          if (saveRes?.status && saveRes.status >= 400) {
            const msg = `IDP response save failed (HTTP ${saveRes.status})`;
            console.error('[IDP] Response save failed:', saveRes.status, saveRes.data ?? saveRes);
            throw new Error(msg);
          }
          rawIdpPageResponseRef.current = updatedIdpResponse;
          console.log('[IDP] Response saved, version:', updatedIdpResponse['Version']);
        })
        .catch((err: unknown) => {
          const e = err as any;
          console.error(
            '[IDP] Response save error:',
            e?.response?.status ?? e?.status,
            e?.response?.data ?? e?.data ?? e?.message ?? e
          );
          throw err;
        });
    },
    [idpSavableDataPage, idpDataPage]
  );

  /** Validates pending changes, builds the modified payload, and persists both IDP response and audit log. */
  const handlePanelSave = useCallback(
    async (
      fieldValues: Record<string, string>,
      rows: Record<string, Array<Record<string, string>>>
    ) => {
      const spec = idpSpec ?? runtimeSpec;
      if (!spec) {
        console.warn('[IDP] Cannot save: missing spec');
        return;
      }
      if (selectedDocType === 'Documents') {
        setAppMessages([{ type: 'warning', text: 'Please reclassify to proceed further' }]);
        setTimeout(() => {
          if (rootRef.current) scrollAncestorsToTop(rootRef.current);
        }, 0);
        return;
      }
      const currentContent = pConnRef.current.getDataObject()?.caseInfo?.content ?? {};
      if (
        pendingAuditChangesRef.current.length === 0 &&
        actionBarPayloadRef.current?.type === ACTION_TYPE.SAVE_AND_SUBMIT
      ) {
        pConn.getActionsApi().finishAssignment(pConn.getContextName());
        return;
      }
      setIsSaving(true);
      if (
        pendingAuditChangesRef.current.length === 0 &&
        actionBarPayloadRef.current?.type === ACTION_TYPE.SAVE
      ) {
        setAppMessages([
          {
            type: 'warning',
            text: 'No changes have been made. Please modify at least one field before submitting.'
          }
        ]);
        setTimeout(() => {
          if (rootRef.current) scrollAncestorsToTop(rootRef.current);
        }, 0);
        setIsSaving(false);
        return;
      }
      setAppMessages(prev => prev.filter(m => m.type !== 'warning' && m.type !== 'success'));

      const rawStatus =
        rawIdpPageResponseRef.current?.['Status'] ?? rawIdpPageResponseRef.current?.['status'];
      const hasIdpError =
        !idpPayload || (typeof rawStatus === 'string' && /^(Failed|Failure)$/.test(rawStatus));

      const originalPayload = hasIdpError
        ? buildSkeletonPayload(
            schemaRegistryService.getResponseType(),
            selectedDocTypeId,
            selectedDocType ?? ''
          )
        : idpPayload;
      const modified = buildModifiedIdpPayload({
        originalPayload,
        documentId: selectedDocTypeId,
        documentType: selectedDocType ?? '',
        idpSpec: spec,
        currentFieldValues: fieldValues,
        currentRepeatableRows: rows
      });
      try {
        await Promise.all([saveIdpResponse(modified), saveAuditLog(displayCounts)]);
        const beneficialOwnerRows =
          rows.beneficial_owner_name?.length > 0
            ? rows.beneficial_owner_name
            : (rows.list_of_beneficial_owner ?? []);
        pConnRef.current.updateState({
          caseInfo: {
            content: {
              ...currentContent,
              BeneficialOwnerName: beneficialOwnerRows
                .map(owner =>
                  (owner.beneficial_owner_name ?? owner.list_of_beneficial_owner ?? '').trim()
                )
                .filter((name): name is string => Boolean(name))
                .join(', '),
                DocumentType: selectedDocType,
              DocumentTypeName: spec.docTypeDisplay ?? ''
            }
          }
        });
        await pConnRef.current.getActionsApi().saveAssignment(pConnRef.current.getContextName());
        const latestAssignmentEtag = sessionStorage.getItem(LATEST_ASSIGNMENT_ETAG_KEY);
        if (latestAssignmentEtag) {
          PCore.getContainerUtils().updateCaseContextEtag(
            pConnRef.current.getContextName(),
            latestAssignmentEtag
          );
        }
        pendingAuditChangesRef.current = [];
        setChanges([]);
        setPersistedCounts(displayCounts);
        refreshAuditLog();
        setAppMessages(prev => [
          ...prev.filter(m => m.type !== 'success'),
          { type: 'success', text: 'Changes saved successfully.' }
        ]);
        setTimeout(() => {
          if (rootRef.current) scrollAncestorsToTop(rootRef.current);
        }, 0);
        if (
          actionBarPayloadRef.current?.target === ACTION_TARGET.DYNAMIC_VIEW &&
          actionBarPayloadRef.current?.type === ACTION_TYPE.SAVE_AND_SUBMIT
        ) {
          pConn.getActionsApi().finishAssignment(pConn.getContextName());
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'An error occurred while saving. Please try again.';
        setAppMessages(prev => [
          ...prev.filter(m => m.type !== 'warning'),
          { type: 'warning', text: msg }
        ]);
        setTimeout(() => {
          if (rootRef.current) scrollAncestorsToTop(rootRef.current);
        }, 0);
      } finally {
        setIsSaving(false);
      }
    },
    [
      pendingAuditChangesRef,
      idpSpec,
      runtimeSpec,
      idpPayload,
      selectedDocTypeId,
      selectedDocType,
      schemaRegistryService,
      saveIdpResponse,
      saveAuditLog,
      refreshAuditLog,
      displayCounts,
      pConn
    ]
  );

  // ─── Memoised JSX ─────────────────────────────────────────────────────────

  /** Pending field-focus timer — lets a fast-following real focus cancel a stale/restored one. */
  const fieldFocusTimeoutRef = useRef<number | null>(null);

  /** Logs which field gained focus (section field, repeatable-table cell, or primitive-chip).
   *  Debounced: when focus briefly bounces back to the previously-focused field (e.g. the
   *  browser restoring focus after the window/iframe regains focus), only the field that is
   *  still focused after a short delay is published. */
  const handleFieldFocus = useCallback(
    (info: FieldFocusInfo) => {
      if (fieldFocusTimeoutRef.current !== null) {
        window.clearTimeout(fieldFocusTimeoutRef.current);
      }
      fieldFocusTimeoutRef.current = window.setTimeout(() => {
        fieldFocusTimeoutRef.current = null;
        console.log('[IDP] handleFieldFocus info:', info);
        if (rawBoundingBoxData) {
          let fieldKey = info.fieldName;
          if (
            info.type === 'repeatable-table' &&
            info.rowIndex !== undefined &&
            info.columnFieldName
          ) {
            fieldKey = `${info.fieldName}[${info.rowIndex}].${info.columnFieldName}`;
          }
          if (info.type === 'primitive-chip' && info.rowIndex !== undefined) {
            fieldKey = `${info.fieldName}[${info.rowIndex}]`;
          }
          const fieldBoundingBoxData = getBoundingBoxForDocument(
            rawBoundingBoxData,
            selectedDocTypeId,
            fieldKey
          );
          if (fieldBoundingBoxData) {
            const boundingBoxPayload = {
              page: fieldBoundingBoxData.page_number,
              fieldName: fieldBoundingBoxData.fieldName,
              box_2d: fieldBoundingBoxData.box_2d,
              value: info.value
            };
            console.log('[IDP] Field focused event fired with payload: ', boundingBoxPayload);
            PCore.getPubSubUtils().publish(DV_FIELD_HIGHLIGHT_EVENT, boundingBoxPayload);
          }
        }
      }, 60);
    },
    [rawBoundingBoxData, selectedDocTypeId]
  );

  /** Clears any pending field-focus timer on unmount. */
  useEffect(
    () => () => {
      if (fieldFocusTimeoutRef.current !== null) window.clearTimeout(fieldFocusTimeoutRef.current);
    },
    []
  );

  /** Memoised ReviewPanel — re-renders only when its data or callbacks change. */
  const reviewPanel = useMemo(
    () => (
      <ReviewPanel
        ref={reviewPanelRef}
        idpSpec={effectiveSpec}
        resolvedValues={runtimeData.resolvedValues}
        repeatableRows={runtimeData.repeatableRows}
        nCols={nCols}
        onFieldChange={handleFieldChange}
        onSave={handlePanelSave}
        onFieldFocus={handleFieldFocus}
        confidenceData={effectiveConfidenceData}
        showConfidenceScore={showConfidenceScore}
        readOnlyMode={isReadOnly}
      />
    ),
    [
      runtimeData.resolvedValues,
      effectiveSpec,
      runtimeData.repeatableRows,
      nCols,
      handleFieldChange,
      handlePanelSave,
      handleFieldFocus,
      effectiveConfidenceData,
      showConfidenceScore,
      isReadOnly
    ]
  );

  return (
    <>
      {/* Always-visible: loader, errors, warnings */}
      {errorMessage && <ErrorState message={errorMessage} />}
      <Progress
        message={isSaving ? 'Saving modified fields and audit log…' : loadState.message}
        placement='local'
        visible={
          loadState.status === 'loading' || loadState.status === 'inline-loading' || isSaving
        }
      />

      {/* Review panel — shown whenever there is no blocking error */}
      {!errorMessage && (
        <StyledCitiExtensionsIdpWrapper ref={rootRef}>
          {appMessages
            .filter(m => m.type !== 'error')
            .map(m => (
              <Banner
                key={`${m.type}-${m.text}`}
                variant={m.type as 'warning' | 'success'}
                messages={[m.text]}
                onDismiss={() => setAppMessages(prev => prev.filter(p => p !== m))}
              />
            ))}
          <StyledReviewPanel>{reviewPanel}</StyledReviewPanel>

          {/* Breakout: only mounts after IDP fetch succeeds, so it never
              blocks the MFE column during loading. useLayoutEffect measures
              the shift when showBreakout first becomes true. */}
          {loadState.status === 'mounted' && !errorMessage && (
            <StyledBreakoutWrapper ref={breakoutRef}>
              {changeLogEntries.length > 0 && (
                <ChangeLog changes={changeLogEntries} counts={displayCounts} />
              )}
            </StyledBreakoutWrapper>
          )}
        </StyledCitiExtensionsIdpWrapper>
      )}
    </>
  );
}

export default withConfiguration(CitiExtensionsIdp);
