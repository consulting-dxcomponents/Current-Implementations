import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  useUID,
  useModalManager,
  useTheme,
  Banner,
  Button,
  Modal,
  Text,
  Progress,
  ErrorState,
  withConfiguration,
} from "@pega/cosmos-react-core";
import StyledCitiExtensionsMfeViewerWrapper from "./styles";
import { MFE_CONSTANTS } from "./constants";
import {
  getFileArrayBuffer,
  fetchWithBackoff,
  splitStringToIntArray,
  getPropertyParameterArray,
  arrayBufferToBase64,
  LATEST_ASSIGNMENT_ETAG_KEY,
  registerAssignmentEtagInterceptor,
} from "./utils";
import type {
  CitiExtensionsMfeViewerProps,
  ViewerMessage,
  ViewerPayload,
  SingleDocumentMessage,
  MultiDocumentMessage,
  DocMode,
  MultiDocMode,
  DocResponseMessage,
  CaptureItem,
  AllDocResponseMessage,
  ViewerNerPayload,
  NerDocResponseMessage,
  NerMetadataMessage,
  SplitApprovedMessage,
  OcrResponseMessage,
  HighlightMessage,
  LoadExtractionDataMessage,
  ViewerTransactionDataPayload,
  ValidationMsgMessage,
} from "./mfeTypes";
import "./create-nonce";

const {
  READY,
  DOC_LOADED,
  DOC_REQUEST,
  DOC_RESPONSE,
  LOAD_SINGLEDOC,
  LOAD_MANIFEST,
  DOC_LOAD_ERROR,
  VIEWER_STATE_CHANGED,
  VIEWER_STATE_CHANGED_PUBSUB_EVENT,
  ALL_DOC_REQUEST,
  ALL_DOC_RESPONSE,
  SPLIT_MERGE_OPENED,
  SPLIT_MERGE_DRAFTED,
  SPLIT_MERGE_EXITED,
  RETRIGGER_CLICKED,
  LOAD_NER_METADATA,
  DOC_NER_REQUEST,
  NER_OPENED,
  NER_EXITED,
  INVALID_NER,
  NER_SUBMITTED,
  NER_SUBMIT_ACTION_SAVE,
  NER_SUBMIT_ACTION_APPROVE,
  NER_SUBMIT_ACTION_REJECT,
  CAPTURE_PREVIEW,
  OCR_REQUEST,
  OCR_RESPONSE,
  ACTION_BAR_EVENT,
  ACTION_BAR_EVENT_TARGET,
  ACTION_BAR_EVENT_TYPE,
  ELEMENT_PROPAGATE,
  HIGHLIGHT,
  DYNAMIC_VIEW_FIELD_HIGHLIGHT,
  EXTRACTIONDATA_REQUEST,
  FORM_SAVE,
  SUBMIT,
  CANCEL,
  VALIDATION_MSG,
  SPLIT_APPROVED_ACK,
} = MFE_CONSTANTS;

const DIFF_ORIGIN_EVENT_TYPES: Array<String> = [ALL_DOC_REQUEST, DOC_REQUEST];
const NO_CAPTURES_WARNING_MESSAGE =
  "No captures found for requested document. Viewer may not display highlights correctly.";

function CitiExtensionsMfeViewer(props: CitiExtensionsMfeViewerProps) {
  const {
    getPConnect,
    inheritedProps,
    mfeURL,
    type = "LOAD_SINGLEDOC,SingleDoc",
    mfeTimeout,
    showSearch = true,
    allowExpand = true,
    correlationId,
    appId,
    referenceList,
    documentIdField,
    fileNameField,
    fileURLField,
    currentPageNumField,
    categoryField,
    pageCategoryIDField,
    pageCategoryField,
    pageCategoryPagesField,
    activeDocField,
    loadStateChange,
    fireEventToDynamicView = true,
    updateDocumentFields,
    documentFields,
    changedPageField,
    changedPageCountField,
    changedFileNameField,
    changedDocIDField,
    changedDocLabelField,
    changedPageCategoryIDField,
    changedModeField,
    changedTotalDocsField,
    Click2PickTransactions,
    loadCaptures,
    loadHighlights,
    highlightSource,
    highlightColor,
    transientDocumentIdField,
    capturesReferenceList,
    idField,
    pageNumberField,
    box2dField,
    valueField,
    colorField,
    loadNER,
    openNER,
    readOnlyNER,
    allowAcknowledgementNER = true,
    allowOcrOnDemandNER,
    columnNamesNER,
    finishAssignmentOnSubmitNER,
    finishAssignmentOnSubmitTransactionData,
    isNEROpenField,
    isNERSubmittedField,
    nerReferenceList,
    nerJsonField,
    loadSplitAndMerge,
    waitForSplit,
    manualSplit,
    allowPageShuffling,
    allowPageMovement,
    isSAMOpenField,
    samType,
    samCategoryReferenceList,
    samCategoryListField,
    samQueryDataPage,
    inProgressStatusRegex,
    completedStatusRegex,
    inProgressBannerText,
    physicalSplitModalConfirmationMessage,
    inProgressWorkStatus,
    completedWorkStatus,
    nounMasterReferenceList,
    nounField,
    nounClassificationField,
    transactionDataReferenceList,
    transactionDataJsonField,
    nerSaveReferenceList,
    nerDataParameter,
    ocrOnDemandReferenceList,
    ocrOnDemandBase64SnippetParameter,
    ocrOnDemandRefIdParameter,
    ocrOnDemandDocumentIdParameter,
    ocrOnDemandExtractedValueField,
    ocrOnDemandExtractionTimeoutInMS,
    isCustomTab,
    loadFromTemplate,
    currentQueue,
    transactionDataSaveReferenceList,
    transactionFieldsParameter,
    uniqueIdParameter,
    saveResultField,
    saveMessageField,
    logDataPage,
    logParameter,
  } = props;

  const theme = useTheme();

  // `type` is provided as "<loadType>,<mode>" e.g. "LOAD_MANIFEST,MultiDoc:SinglePage"
  const [loadType, mode] = type.split(",") as [
    "LOAD_SINGLEDOC" | "LOAD_MANIFEST",
    DocMode,
  ];

  // UI states
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Loading...");
  const [documents, setDocuments] = useState<Array<Record<string, unknown>>>(
    [],
  );

  const [samInProgress, setSamInProgress] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessages, setWarningMessages] = useState<Array<string>>([]);
  const [hasInitialCheckCompleted, setHasInitialCheckCompleted] =
    useState(false);
  const samInProgressRef = useRef(samInProgress);
  const hasInitialCheckCompletedRef = useRef(hasInitialCheckCompleted);
  const samInitCheckKeyRef = useRef<string | null>(null);

  useEffect(() => {
    samInProgressRef.current = samInProgress;
  }, [samInProgress]);

  useEffect(() => {
    hasInitialCheckCompletedRef.current = hasInitialCheckCompleted;
  }, [hasInitialCheckCompleted]);

  // Feature flags for optional fields and capabilities
  const featureFlags = useMemo(
    () => ({
      allowExpand,
      showSearch,
      Click2Pick: Click2PickTransactions,
      captures: loadCaptures,
      highlights: loadHighlights,
      stateChangeHandler: loadStateChange,
      fireEventToDynamicView: loadStateChange ? fireEventToDynamicView : false,
      updateDocumentFields: loadStateChange ? updateDocumentFields : false,
      splitAndMerge: loadSplitAndMerge,
      splitAndMergeWorkStatus: loadSplitAndMerge
        ? inProgressWorkStatus && completedWorkStatus
        : false,
      physicalSplit: loadSplitAndMerge && samType === "Physical",
      waitForSplit:
        loadSplitAndMerge && samType === "Physical" ? waitForSplit : false,
      manualSplit:
        loadSplitAndMerge && samType === "Physical" ? manualSplit : false,
      allowPageShuffling: loadSplitAndMerge ? allowPageShuffling : false,
      allowPageMovement: loadSplitAndMerge ? allowPageMovement : false,
      showNer: loadNER,
      openNer: loadNER ? openNER : false,
      finishAssignmentOnSubmitNER: loadNER
        ? finishAssignmentOnSubmitNER
        : false,
      finishAssignmentOnSubmitTransactionData: isCustomTab
        ? finishAssignmentOnSubmitTransactionData
        : false,
      readOnlyNer: readOnlyNER,
      allowAcknowledgement: allowAcknowledgementNER,
      allowOcrOnDemand: allowOcrOnDemandNER,
      isCustomTab,
      loadFromTemplate,
      currentQueue,
    }),
    [
      allowExpand,
      showSearch,
      loadCaptures,
      loadHighlights,
      Click2PickTransactions,
      loadStateChange,
      fireEventToDynamicView,
      loadSplitAndMerge,
      waitForSplit,
      manualSplit,
      allowPageShuffling,
      allowPageMovement,
      loadNER,
      openNER,
      readOnlyNER,
      allowAcknowledgementNER,
      allowOcrOnDemandNER,
      finishAssignmentOnSubmitNER,
      finishAssignmentOnSubmitTransactionData,
      isCustomTab,
      loadFromTemplate,
      currentQueue,
      samType,
      inProgressWorkStatus,
      completedWorkStatus,
      updateDocumentFields,
    ],
  );

  // Refs used for iframe messaging and two-gate synchronization
  const wrapperRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isViewerReadyRef = useRef(false);
  const payloadRef = useRef<ViewerPayload>({ ready: false, message: null });
  const nerPayloadRef = useRef<ViewerNerPayload>({
    ready: false,
    message: null,
  });
  const nerMetadataPayloadRef = useRef<{
    ready: boolean;
    message: NerMetadataMessage | null;
  }>({
    ready: false,
    message: null,
  });
  const transactionDataPayloadRef = useRef<ViewerTransactionDataPayload>({
    ready: false,
    message: null,
  });
  const isNEROpenedRef = useRef<boolean>(false);
  const isSplitMergeOpenedRef = useRef<boolean>(false);
  const selectedTransactionFieldRef = useRef<string | null>(null);
  const captureAvailabilityByDocRef = useRef<Record<string, boolean>>({});

  // Tracks the DOC_LOADED timeout so it can be cleared when the event arrives
  const docLoadedTimeoutRef = useRef<number | null>(null);
  const expandedTargetRef = useRef<HTMLElement | null>(null);
  const expandedTargetPrevGridColumnRef = useRef<string | null>(null);
  // Stable ref to latest loadDocumentsForViewer to avoid effect re-runs on dependency changes
  const loadDocumentsForViewerRef =
    useRef<
      (sendMessage?: boolean, isCancelled?: () => boolean) => Promise<void>
    >();

  const subscriptionId = useUID();

  // Stable ref to modal manager for showing confirmation modals from imperative callbacks
  const modalManagerRef = useRef(useModalManager());

  // Stable ref to the latest pConn — getPConnect() returns a new object on every render,
  // so using a ref prevents effects and callbacks from re-running on each re-render
  const pConnRef = useRef(getPConnect());
  useEffect(() => {
    pConnRef.current = getPConnect();
  }, [getPConnect]);

  // Use strict origin from configured URL for secure postMessage communication
  const viewerOrigin = useMemo(() => {
    try {
      return new URL(mfeURL).origin;
    } catch {
      console.warn("Invalid MFE URL provided:", mfeURL);
      return "";
    }
  }, [mfeURL]);

  const getDetailRendererContainer = useCallback((): HTMLElement | null => {
    const CLASS_PREFIX = "DetailsRenderer__StyledDetailRenderer";
    let current = wrapperRef.current?.parentElement ?? null;

    while (current) {
      const hasMatch = Array.from(current.classList).some((cls) =>
        cls.startsWith(CLASS_PREFIX),
      );
      if (hasMatch) return current;
      current = current.parentElement;
    }

    return null;
  }, []);

  const restoreExpandedTarget = useCallback(() => {
    if (!expandedTargetRef.current) return;

    const previous = expandedTargetPrevGridColumnRef.current ?? "";
    if (previous) {
      expandedTargetRef.current.style.gridColumn = previous;
    } else {
      expandedTargetRef.current.style.removeProperty("grid-column");
    }

    expandedTargetRef.current = null;
    expandedTargetPrevGridColumnRef.current = null;
  }, []);

  useEffect(() => {
    if (!featureFlags.allowExpand) {
      restoreExpandedTarget();
      return;
    }

    if (isExpanded) {
      const target = getDetailRendererContainer();
      if (!target) return restoreExpandedTarget;

      if (expandedTargetRef.current !== target) {
        restoreExpandedTarget();
        expandedTargetRef.current = target;
        expandedTargetPrevGridColumnRef.current = target.style.gridColumn || "";
      }

      target.style.gridColumn = "1 / -1";
      return restoreExpandedTarget;
    }

    restoreExpandedTarget();
  }, [
    isExpanded,
    featureFlags.allowExpand,
    getDetailRendererContainer,
    restoreExpandedTarget,
  ]);

  // Log error
  const logError = useCallback(
    (
      userMsg: string,
      serverMsg: string,
      logType: "error" | "warning" = "error",
    ) => {
      if (logType === "error") {
        setErrorMessage(userMsg);
      } else if (logType === "warning") {
        setWarningMessages((prev) =>
          prev.includes(userMsg) ? prev : [...prev, userMsg],
        );
      }
      if (!logDataPage || !logParameter) return;
      fetchWithBackoff(
        pConnRef.current,
        logDataPage,
        {
          [logParameter]: `Case ${pConnRef.current.getCaseSummary()?.businessID}, ${serverMsg}`,
        },
        "page",
        {
          maxRetries: 0,
        },
      )
        .then(() => console.warn("Logged error:", serverMsg))
        .catch((err) => {
          console.error("Failed to log error to data page:", err);
        });
    },
    [logDataPage, logParameter],
  );

  // Stable ref that always points to the latest logError without causing effects to re-run
  const logErrorRef = useRef(logError);
  useEffect(() => {
    logErrorRef.current = logError;
  }, [logError]);

  // Reset all gates when mfeURL or type changes
  useEffect(() => {
    isViewerReadyRef.current = false;
    payloadRef.current = { ready: false, message: null };
    if (docLoadedTimeoutRef.current) {
      window.clearTimeout(docLoadedTimeoutRef.current);
      docLoadedTimeoutRef.current = null;
    }
    setIsLoading(true);
    setLoadingMessage("Loading...");
    if (!mfeURL || !type) {
      logErrorRef.current(
        "MFE configuration is missing or invalid. Please contact system administrator.",
        `Missing or invalid MFE configuration: URL=${mfeURL} and type=${type} are required.`,
      );
    } else {
      setErrorMessage(null);
    }
    setWarningMessages([]);
    if (featureFlags.allowExpand) setIsExpanded(false);
  }, [mfeURL, type, featureFlags.allowExpand]);

  const samInProgressStatusProperty = useMemo(() => {
    return pConnRef.current.getRawConfigProps()?.inProgressStatus;
  }, [pConnRef]);

  const updateSamInProgressStatusProperty = useCallback(
    async (status: boolean) => {
      try {
        const actionsApi = pConnRef.current.getActionsApi();

        // Update fields on redux
        actionsApi.updateFieldValue(samInProgressStatusProperty, status);

        // Trigger fields to update on client side
        actionsApi.triggerFieldChange(samInProgressStatusProperty, status);
      } catch (err) {
        logErrorRef.current(
          "Failed to update status.",
          `Failed to update correction status property from MFE Viewer: ${err}`,
          "warning",
        );
      }
    },
    [logErrorRef, samInProgressStatusProperty],
  );

  const isSAMCorrectionCompleted = useCallback(async (): Promise<
    boolean | null
  > => {
    if (!samQueryDataPage?.source || !samQueryDataPage?.fields?.statusField) {
      return null;
    }

    const getStatusMatcher = (pipeValues?: string): RegExp | null => {
      if (!pipeValues || typeof pipeValues !== "string") return null;

      const tokens = pipeValues
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

      if (tokens.length === 0) return null;
      return new RegExp(`\\b(?:${tokens.join("|")})\\b`, "i");
    };

    const completedMatcher = getStatusMatcher(completedStatusRegex);
    const inProgressMatcher = getStatusMatcher(inProgressStatusRegex);

    try {
      const res = (await fetchWithBackoff(
        pConnRef.current,
        samQueryDataPage.source,
        pConnRef.current.resolveConfigProps(
          pConnRef.current.getRawConfigProps()?.samQueryDataPage?.parameters,
        ),
        "page",
        {
          maxRetries: 0,
        },
        true,
      )) as Record<string, unknown>;

      const rawStatus = res?.[samQueryDataPage.fields.statusField];
      const status = typeof rawStatus === "string" ? rawStatus.trim() : "";
      if (!status) return null;

      if (completedMatcher?.test(status)) return true;
      if (inProgressMatcher?.test(status)) return false;

      return null;
    } catch {
      return null;
    }
  }, [samQueryDataPage, completedStatusRegex, inProgressStatusRegex]);

  const updateSplitMergeWorkStatus = useCallback(
    async (status: string) => {
      try {
        if (featureFlags.splitAndMergeWorkStatus) {
          pConnRef.current
            .getActionsApi()
            .updateFieldValue(".pyStatusWork", status);
          pConnRef.current
            .getActionsApi()
            .triggerFieldChange(".pyStatusWork", status);
          await pConnRef.current
            .getActionsApi()
            .saveAssignment(pConnRef.current.getContextName());
          const latestAssignmentEtag = sessionStorage.getItem(
            LATEST_ASSIGNMENT_ETAG_KEY,
          );
          if (latestAssignmentEtag) {
            PCore.getContainerUtils().updateCaseContextEtag(
              pConnRef.current.getContextName(),
              latestAssignmentEtag,
            );
          }
        }
      } catch (err) {
        console.warn(`Failed to update split/merge work status: ${err}`);
      }
    },
    [featureFlags.splitAndMergeWorkStatus],
  );

  useEffect(() => {
    let cancelled = false;
    const currentInitKey = `${mfeURL}|${type}|${featureFlags.splitAndMerge}`;

    if (!featureFlags.splitAndMerge) {
      samInitCheckKeyRef.current = currentInitKey;
      setSamInProgress(false);
      setHasInitialCheckCompleted(true);
      return () => {
        cancelled = true;
      };
    }

    if (samInitCheckKeyRef.current === currentInitKey) {
      return () => {
        cancelled = true;
      };
    }

    const checkStatus = async () => {
      const completed = await isSAMCorrectionCompleted();
      if (cancelled) return;

      // Only mark this key as resolved once the check actually completes.
      // If we marked it eagerly (before the await), a cancelled/aborted run
      // (e.g. due to a dependency identity change or effect re-invocation)
      // would permanently block any retry for this key, leaving
      // samInProgress/hasInitialCheckCompleted stuck at their defaults.
      samInitCheckKeyRef.current = currentInitKey;

      if (completed === null) {
        logErrorRef.current(
          "Failed to determine status. If the issue persists, please contact system administrator.",
          "Failed to determine correction status from MFE Viewer.",
          "warning",
        );
        setSamInProgress(true);
        updateSamInProgressStatusProperty(true);
        setHasInitialCheckCompleted(true);
        return;
      }

      if (completed === true) {
        setSamInProgress(false);
        updateSamInProgressStatusProperty(false);
        setHasInitialCheckCompleted(true);
        return;
      }

      setSamInProgress(true);
      updateSamInProgressStatusProperty(true);
      setHasInitialCheckCompleted(true);
    };

    checkStatus();

    return () => {
      cancelled = true;
    };
  }, [
    featureFlags.splitAndMerge,
    isSAMCorrectionCompleted,
    updateSamInProgressStatusProperty,
    mfeURL,
    type,
  ]);

  // Timeout guard: if iframe does not send READY in time, fail fast with a user error
  useEffect(() => {
    if (!mfeURL || !type || isViewerReadyRef.current || errorMessage) {
      return;
    }

    const ms = mfeTimeout > 0 ? mfeTimeout : 15000;
    const id = window.setTimeout(() => {
      if (!isViewerReadyRef.current && !errorMessage) {
        logErrorRef.current(
          "Viewer took too long to respond. Please try again later.",
          `MFE Timeout error: READY event not received within ${ms}ms of loading URL=${mfeURL}`,
        );
        setIsLoading(false);
      }
    }, ms);
    return () => window.clearTimeout(id);
  }, [mfeTimeout, mfeURL, errorMessage, type]);

  // Low-level message sender to iframe window
  const sendToViewer = useCallback(
    (
      message:
        | SingleDocumentMessage
        | MultiDocumentMessage
        | DocResponseMessage
        | AllDocResponseMessage
        | NerDocResponseMessage
        | NerMetadataMessage
        | SplitApprovedMessage
        | OcrResponseMessage
        | HighlightMessage
        | LoadExtractionDataMessage
        | ValidationMsgMessage,
    ) => {
      console.log("[MFEViewer] Sending message to viewer:", message);
      iframeRef.current?.contentWindow?.postMessage(message, viewerOrigin);
    },
    [viewerOrigin],
  );

  // Two-gate dispatcher: send payload only when (1) viewer is READY and (2) payload is prepared
  // Starts a DOC_LOADED timeout after each send to catch viewer render failures
  const trySend = useCallback(() => {
    if (
      isViewerReadyRef.current &&
      payloadRef.current.ready &&
      payloadRef.current.message
    ) {
      const isInitialCheckCompleted = hasInitialCheckCompletedRef.current;
      const isSamInProgress = samInProgressRef.current;

      // For split/merge flows, do not send initial payload until SAM status check resolves.
      if (featureFlags.splitAndMerge && !isInitialCheckCompleted) {
        return;
      }

      // Always derive showSplitMerge from latest state at send-time to avoid stale
      // payload values when async SAM initialization resolves after payload build.
      let messageToSend = payloadRef.current.message;
      if (
        "showSplitMerge" in messageToSend &&
        typeof messageToSend.showSplitMerge === "boolean"
      ) {
        messageToSend = {
          ...messageToSend,
          showSplitMerge: featureFlags.splitAndMerge && !isSamInProgress,
        };
        payloadRef.current = {
          ...payloadRef.current,
          message: messageToSend,
        };
      }

      sendToViewer(messageToSend);

      // Clear any previous DOC_LOADED timeout and start a fresh one
      if (docLoadedTimeoutRef.current) {
        window.clearTimeout(docLoadedTimeoutRef.current);
      }
      const ms = mfeTimeout > 0 ? mfeTimeout : 30000;
      docLoadedTimeoutRef.current = window.setTimeout(() => {
        logErrorRef.current(
          "Document took too long to load. Please try again later.",
          `MFE DOC_LOADED timeout: event not received within ${ms}ms after sending payload to URL=${mfeURL}`,
        );
        setIsLoading(false);
      }, ms);
    }
  }, [sendToViewer, mfeTimeout, mfeURL, featureFlags.splitAndMerge]);

  useEffect(() => {
    if (featureFlags.splitAndMerge && hasInitialCheckCompleted) {
      trySend();
    }
  }, [featureFlags.splitAndMerge, hasInitialCheckCompleted, trySend]);

  const trySendTransactionData = useCallback(() => {
    if (
      isViewerReadyRef.current &&
      transactionDataPayloadRef.current.ready &&
      transactionDataPayloadRef.current.message
    ) {
      sendToViewer(transactionDataPayloadRef.current.message);
    }
  }, [sendToViewer]);

  const trySendNer = useCallback(() => {
    if (
      isViewerReadyRef.current &&
      nerPayloadRef.current.ready &&
      nerPayloadRef.current.message
    ) {
      sendToViewer(nerPayloadRef.current.message);
    }
  }, [sendToViewer]);

  const trySendNerMetadata = useCallback(() => {
    if (
      isViewerReadyRef.current &&
      nerMetadataPayloadRef.current.ready &&
      nerMetadataPayloadRef.current.message
    ) {
      sendToViewer(nerMetadataPayloadRef.current.message);
    }
  }, [sendToViewer]);

  // Get captures for viewer message based on highlights data page and configured field mappings
  const getCaptures = useCallback(
    (caps: Array<Record<string, unknown>>) => {
      try {
        if (!Array.isArray(caps)) return [];
        return caps.map((cap) => ({
          id: cap[idField] as string,
          value: cap[valueField] as string,
          page: cap[pageNumberField] as number,
          box_2d: splitStringToIntArray(cap[box2dField] as string),
          color: cap[colorField ?? ""] as string | undefined,
        }));
      } catch (err) {
        return [];
      }
    },
    [idField, valueField, box2dField, pageNumberField, colorField],
  );

  const updateTransientDocumentId = useCallback(
    (docId: string) => {
      if (!transientDocumentIdField) return;
      try {
        const actionsApi = pConnRef.current.getActionsApi();
        actionsApi.updateFieldValue(transientDocumentIdField, docId);
        actionsApi.triggerFieldChange(transientDocumentIdField, docId);
      } catch (err) {
        console.warn("Failed to update transient document ID field:", err);
      }
    },
    [transientDocumentIdField],
  );

  const setCaptureWarningVisible = useCallback((show: boolean) => {
    setWarningMessages((prev) => {
      const hasWarning = prev.includes(NO_CAPTURES_WARNING_MESSAGE);
      if (show && !hasWarning) return [...prev, NO_CAPTURES_WARNING_MESSAGE];
      if (!show && hasWarning) {
        return prev.filter((msg) => msg !== NO_CAPTURES_WARNING_MESSAGE);
      }
      return prev;
    });
  }, []);

  // Get categories for viewer message based on split and merge data page and configured field mappings
  const getCategoryList = useCallback(
    (cats: Array<Record<string, unknown>>) => {
      try {
        if (!Array.isArray(cats) || !samCategoryListField) return [];
        return cats.map((cat) => cat[samCategoryListField] as string);
      } catch (err) {
        logErrorRef.current(
          "Failed to load category list. Viewer may not display categories correctly.",
          `Error fetching category list for MFE Viewer: ${err}`,
          "warning",
        );
        return [];
      }
    },
    [samCategoryListField],
  );

  // Build single document message payload
  const buildSingleDocMessage = useCallback(
    async (
      docs: Array<Record<string, unknown>>,
      formattedCaps: CaptureItem[],
      formattedCategoryList: string[],
    ): Promise<SingleDocumentMessage> => {
      const buffer = await getFileArrayBuffer(docs[0][fileURLField] as URL);
      const message: SingleDocumentMessage = {
        showSearch: featureFlags.showSearch,
        type: LOAD_SINGLEDOC,
        appId,
        correlationId,
        fileName: docs[0][fileNameField] as string,
        buffer,
        captures: formattedCaps,
        persistHighlights: featureFlags.captures,
        categoryList: formattedCategoryList,
        showSplitMerge: featureFlags.splitAndMerge && !samInProgress,
        showNer: featureFlags.showNer,
        openNer: featureFlags.openNer,
        enablePhysicalSplit: featureFlags.physicalSplit,
        waitForSplit: featureFlags.waitForSplit,
        manualSplit: featureFlags.manualSplit,
        allowPageShuffling: featureFlags.allowPageShuffling,
        allowPageMovement: featureFlags.allowPageMovement,
        Click2Pick: featureFlags.Click2Pick,
        currentPageNum: docs[0][currentPageNumField] as number,
        allowOcrOnDemand: featureFlags.Click2Pick,
        initialZoom: "page-width",
        isCustomTab: featureFlags.isCustomTab,
        loadFromTemplate: featureFlags.loadFromTemplate,
        currentQueue: featureFlags.currentQueue,
      };

      if (
        categoryField &&
        Array.isArray(docs[0][categoryField]) &&
        pageCategoryIDField &&
        pageCategoryField &&
        pageCategoryPagesField
      ) {
        const categories = docs[0][categoryField] as Array<
          Record<string, unknown>
        >;
        message.categories = categories.map((cat: Record<string, unknown>) => ({
          pageCategoryID: cat[pageCategoryIDField] as string,
          label: cat[pageCategoryField] as string,
          ...(cat[pageCategoryPagesField]
            ? {
                pages: splitStringToIntArray(
                  cat[pageCategoryPagesField] as string,
                ),
              }
            : {}),
        }));
      }
      return message;
    },
    [
      appId,
      correlationId,
      fileURLField,
      fileNameField,
      currentPageNumField,
      categoryField,
      pageCategoryIDField,
      pageCategoryField,
      pageCategoryPagesField,
      featureFlags,
      samInProgress,
    ],
  );

  const getDocPageCategories = useCallback(
    (doc: Record<string, unknown>) => {
      if (
        !categoryField ||
        !Array.isArray(doc[categoryField]) ||
        !pageCategoryIDField ||
        !pageCategoryField
      ) {
        return [];
      }

      const categories = doc[categoryField] as Array<Record<string, unknown>>;
      return categories.map((cat: Record<string, unknown>) => ({
        pageCategoryID: cat[pageCategoryIDField] as string,
        category: cat[pageCategoryField] as string,
        ...(pageCategoryPagesField && cat[pageCategoryPagesField]
          ? {
              pages: splitStringToIntArray(
                cat[pageCategoryPagesField] as string,
              ),
            }
          : {}),
      }));
    },
    [
      categoryField,
      pageCategoryIDField,
      pageCategoryField,
      pageCategoryPagesField,
    ],
  );

  // Build multi document message payload
  const buildMultiDocMessage = useCallback(
    async (
      docs: Array<Record<string, unknown>>,
      activeIndex: number,
      formattedCaps: CaptureItem[],
      formattedCategoryList: string[],
    ): Promise<MultiDocumentMessage> => {
      const activeBuffer = await getFileArrayBuffer(
        docs[activeIndex][fileURLField] as URL,
      );

      const message: MultiDocumentMessage = {
        showSearch: featureFlags.showSearch,
        type: LOAD_MANIFEST,
        appId,
        correlationId,
        manifest: {
          mode: mode as MultiDocMode,
          categoryList: formattedCategoryList,
          documents: docs.map((doc) => {
            const pageCategories = getDocPageCategories(doc);
            const primaryCategory = pageCategories[0];

            return {
              id: doc[documentIdField] as string,
              name: doc[fileNameField] as string,
              currentPageNum: doc[currentPageNumField] as number,
              ...(mode === "MultiDoc:SinglePage"
                ? {
                    category: primaryCategory?.category,
                    pageCategoryID: primaryCategory?.pageCategoryID,
                  }
                : {
                    pageCategories,
                  }),
            };
          }),
        },
        activeDocId: docs[activeIndex][documentIdField] as string,
        activeBuffer,
        captures: formattedCaps,
        persistHighlights: featureFlags.captures,
        showSplitMerge: featureFlags.splitAndMerge && !samInProgress,
        showNer: featureFlags.showNer,
        openNer: featureFlags.openNer,
        enablePhysicalSplit: featureFlags.physicalSplit,
        waitForSplit: featureFlags.waitForSplit,
        manualSplit: featureFlags.manualSplit,
        allowPageShuffling: featureFlags.allowPageShuffling,
        allowPageMovement: featureFlags.allowPageMovement,
        Click2Pick: featureFlags.Click2Pick,
        allowOcrOnDemand: featureFlags.Click2Pick,
        initialZoom: "page-width",
        isCustomTab: featureFlags.isCustomTab,
        loadFromTemplate: featureFlags.loadFromTemplate,
        currentQueue: featureFlags.currentQueue,
      };

      return message;
    },
    [
      samInProgress,
      appId,
      correlationId,
      fileURLField,
      documentIdField,
      fileNameField,
      currentPageNumField,
      mode,
      featureFlags,
      getDocPageCategories,
    ],
  );

  // Collect parameters for field registration
  const getParametersForRegistration = useCallback(() => {
    let propParameterArray: Array<string> = [];
    const referenceListParameters =
      pConnRef.current.getRawConfigProps()?.parameters;
    if (referenceListParameters) {
      propParameterArray = getPropertyParameterArray(referenceListParameters);
    }
    return propParameterArray;
  }, []);

  const loadDocumentsForViewer = useCallback(
    async (sendMessage = true, isCancelled?: () => boolean) => {
      const [docs, categoryList] = (await Promise.all([
        // Fetch documents for viewer
        fetchWithBackoff(
          pConnRef.current,
          referenceList,
          pConnRef.current.resolveConfigProps(
            pConnRef.current.getRawConfigProps()?.parameters,
          ),
          "list",
        ),
        // Fetch category list for split and merge if enabled
        featureFlags.splitAndMerge && samCategoryReferenceList?.referenceList
          ? fetchWithBackoff(
              pConnRef.current,
              samCategoryReferenceList?.referenceList,
              pConnRef.current.resolveConfigProps(
                pConnRef.current.getRawConfigProps()?.samCategoryReferenceList
                  ?.parameters,
              ),
              "list",
            ).catch((err) => {
              logErrorRef.current(
                "Failed to load category list. Viewer may not display categories correctly.",
                `Error fetching category list for MFE Viewer: ${err}`,
                "warning",
              );
              return [];
            })
          : Promise.resolve([]),
      ])) as [Array<Record<string, unknown>>, Array<Record<string, unknown>>];

      if (
        (isCancelled?.() ?? false) ||
        !Array.isArray(docs) ||
        docs.length === 0
      )
        return;

      let activeIndex = 0;
      if (loadType === LOAD_SINGLEDOC) {
        updateTransientDocumentId(docs[activeIndex][documentIdField] as string);
      } else if (
        activeDocField &&
        docs.findIndex((doc) => doc[activeDocField] === true) !== -1
      ) {
        activeIndex = docs.findIndex((doc) => doc[activeDocField] === true);
        updateTransientDocumentId(docs[activeIndex][documentIdField] as string);
      }

      const [caps, ner, transactions] = (await Promise.all([
        featureFlags.captures && capturesReferenceList?.referenceList
          ? fetchWithBackoff(
              pConnRef.current,
              capturesReferenceList?.referenceList,
              pConnRef.current.resolveConfigProps(
                pConnRef.current.getRawConfigProps()?.capturesReferenceList
                  ?.parameters,
              ),
              "list",
            ).catch((err) => {
              console.warn("Failed to load captures: ", err);
              return [];
            })
          : Promise.resolve([]),
        featureFlags.showNer && nerReferenceList?.referenceList
          ? fetchWithBackoff(
              pConnRef.current,
              nerReferenceList?.referenceList,
              pConnRef.current.resolveConfigProps(
                pConnRef.current.getRawConfigProps()?.nerReferenceList
                  ?.parameters,
              ),
              "list",
            ).catch((err) => {
              logErrorRef.current(
                "Failed to load NER entities. Viewer may not display NER correctly.",
                `Error fetching NER entities for MFE Viewer: ${err}`,
                "warning",
              );
              return [];
            })
          : Promise.resolve([]),
        featureFlags.isCustomTab && transactionDataReferenceList?.referenceList
          ? fetchWithBackoff(
              pConnRef.current,
              transactionDataReferenceList?.referenceList,
              pConnRef.current.resolveConfigProps(
                pConnRef.current.getRawConfigProps()
                  ?.transactionDataReferenceList?.parameters,
              ),
              "list",
            ).catch((err) => {
              logErrorRef.current(
                "Failed to load transaction data. Viewer may not display duplicates correctly.",
                `Error fetching transaction data for MFE Viewer: ${err}`,
                "warning",
              );
              return [];
            })
          : Promise.resolve([]),
      ])) as [
        Array<Record<string, unknown>>,
        Array<Record<string, unknown>>,
        Array<Record<string, unknown>>,
      ];

      if (
        featureFlags.showNer &&
        nerReferenceList?.referenceList &&
        ner.length === 0
      ) {
        logErrorRef.current(
          "Failed to load NER entities. Viewer may not display NER correctly.",
          `Error fetching NER entities for MFE Viewer: No NER entities returned in data page: ${nerReferenceList?.referenceList}`,
          "warning",
        );
      }

      if (
        featureFlags.isCustomTab &&
        transactionDataReferenceList?.referenceList &&
        transactions.length === 0
      ) {
        logErrorRef.current(
          "Failed to load transaction data. Viewer may not display duplicates correctly.",
          `Error fetching transaction data for MFE Viewer: No transaction data returned in data page: ${transactionDataReferenceList?.referenceList}`,
          "warning",
        );
      }

      if (isCancelled?.() ?? false) return;

      if (featureFlags.captures) {
        const activeDocId = docs[activeIndex]?.[documentIdField] as string;
        if (activeDocId) {
          const hasCaptures = Array.isArray(caps) && caps.length > 0;
          captureAvailabilityByDocRef.current[activeDocId] = hasCaptures;
          setCaptureWarningVisible(!hasCaptures);
        }
      }

      setDocuments(docs);
      const formattedCaps = getCaptures(caps);
      let formattedCategoryList: string[] = [];
      if (
        featureFlags.splitAndMerge &&
        Array.isArray(categoryList) &&
        categoryList.length === 0
      ) {
        logErrorRef.current(
          "Error loading category list for split and merge. Viewer may not display categories correctly.",
          `No categories found for requested document with in data page: ${samCategoryReferenceList?.referenceList} for MFE Viewer.`,
          "warning",
        );
      } else {
        formattedCategoryList = getCategoryList(categoryList);
      }
      const message =
        loadType === LOAD_SINGLEDOC
          ? await buildSingleDocMessage(
              docs,
              formattedCaps,
              formattedCategoryList,
            )
          : await buildMultiDocMessage(
              docs,
              activeIndex,
              formattedCaps,
              formattedCategoryList,
            );

      if (isCancelled?.() ?? false) return;
      payloadRef.current = { ready: true, message };

      if (sendMessage) trySend();

      if (
        transactions.length > 0 &&
        transactionDataJsonField &&
        transactions[0][transactionDataJsonField]
      ) {
        const transactionDataMessage = JSON.parse(
          transactions[0][transactionDataJsonField] as string,
        ) as LoadExtractionDataMessage;
        transactionDataPayloadRef.current = {
          ready: true,
          message: transactionDataMessage,
        };
        if (sendMessage) trySendTransactionData();
      }

      if (ner.length > 0 && nerJsonField && ner[0][nerJsonField]) {
        const docNerResponseMessage = JSON.parse(
          ner[0][nerJsonField] as string,
        ) as NerDocResponseMessage;
        nerPayloadRef.current = {
          ready: true,
          message: docNerResponseMessage,
        };
        if (sendMessage) trySendNer();
      }
    },
    [
      referenceList,
      featureFlags,
      samCategoryReferenceList?.referenceList,
      loadType,
      updateTransientDocumentId,
      documentIdField,
      activeDocField,
      capturesReferenceList?.referenceList,
      getCaptures,
      getCategoryList,
      buildSingleDocMessage,
      buildMultiDocMessage,
      trySend,
      setCaptureWarningVisible,
      nerReferenceList?.referenceList,
      transactionDataReferenceList?.referenceList,
      nerJsonField,
      trySendNer,
      transactionDataJsonField,
      trySendTransactionData,
    ],
  );

  // Sync the latest loadDocumentsForViewer to ref to avoid effect re-runs
  useEffect(() => {
    loadDocumentsForViewerRef.current = loadDocumentsForViewer;
  }, [loadDocumentsForViewer]);

  // Build the initial payload by fetching the document list and required binary buffer(s)
  // SingleDoc: first row buffer
  // MultiDoc: active document buffer + manifest metadata
  useEffect(() => {
    let cancelled = false;

    if (!mfeURL || !type) {
      setIsLoading(false);
      return;
    }

    setLoadingMessage(
      `Loading document${loadType === LOAD_SINGLEDOC ? "" : "s"}...`,
    );

    const run = async () => {
      try {
        await loadDocumentsForViewerRef.current?.(true, () => cancelled);
      } catch (err) {
        if (!cancelled) {
          logErrorRef.current(
            "Failed to load documents. Please try again later.",
            `Failed to load documents from dataPage ${referenceList} for MFE Viewer: ${err}`,
          );
          setIsLoading(false);
        }
      }
    };

    run();

    // Register fields to re-fetching documents
    PCore.getCascadeManager().registerFields(
      pConnRef.current.getContextName(),
      pConnRef.current.getPageReference(),
      getParametersForRegistration(),
      () => {
        setIsLoading(true);
        setLoadingMessage("Updating documents...");
        run().catch((err) => {
          if (!cancelled) {
            logErrorRef.current(
              "Failed to load documents. Please try again later.",
              `Failed to load documents from dataPage ${referenceList} for MFE Viewer: ${err}`,
            );
            setIsLoading(false);
          }
        });
      },
      subscriptionId,
    );

    return () => {
      cancelled = true;

      // Unregister the fields when component unmounts to prevent memory leaks and unintended data fetches
      PCore.getCascadeManager().unRegisterFields(
        pConnRef.current.getContextName(),
        pConnRef.current.getPageReference(),
        getParametersForRegistration(),
        subscriptionId,
      );
    };
  }, [
    getPConnect,
    referenceList,
    loadType,
    mfeURL,
    type,
    subscriptionId,
    getParametersForRegistration,
  ]);
  // Viewer requests additional document buffer by docId

  useEffect(() => {
    let cancelled = false;

    const loadNerMetadataDataPages = async () => {
      if (!featureFlags.showNer && nounMasterReferenceList?.referenceList) {
        nerMetadataPayloadRef.current = { ready: false, message: null };
        return;
      }

      const nouns = (await fetchWithBackoff(
        pConnRef.current,
        nounMasterReferenceList.referenceList,
        {},
        "list",
      )) as Array<Record<string, unknown>>;

      if (cancelled) return;

      const nounMasterList = nouns.map((item) => ({
        field: item[nounField] as string,
        classification: item[nounClassificationField] as string,
      }));

      nerMetadataPayloadRef.current = {
        ready: true,
        message: {
          type: LOAD_NER_METADATA,
          noun_types: {
            all_noun_types: nounMasterList,
          },
          readOnlyNer: featureFlags.readOnlyNer,
          allowAcknowledgement: featureFlags.allowAcknowledgement,
          allowOcrOnDemand: featureFlags.allowOcrOnDemand,
          columnNames: columnNamesNER.split(","),
        },
      };

      trySendNerMetadata();
    };

    loadNerMetadataDataPages().catch((err) => {
      if (cancelled) return;
      logErrorRef.current(
        "Failed to load NER metadata. Viewer may not display noun classification correctly.",
        `Error loading NER metadata data pages for MFE Viewer: ${err}`,
        "warning",
      );
      nerMetadataPayloadRef.current = { ready: false, message: null };
    });

    return () => {
      cancelled = true;
    };
  }, [
    nounMasterReferenceList?.referenceList,
    nounField,
    nounClassificationField,
    featureFlags.showNer,
    featureFlags.readOnlyNer,
    featureFlags.allowAcknowledgement,
    featureFlags.allowOcrOnDemand,
    columnNamesNER,
    trySendNerMetadata,
  ]);

  const onViewerReady = useCallback(() => {
    if (isViewerReadyRef.current) return;
    isViewerReadyRef.current = true;
    trySend();
    if (
      featureFlags.showNer &&
      nerReferenceList?.referenceList &&
      transactionDataReferenceList?.referenceList &&
      nounMasterReferenceList?.referenceList
    ) {
      trySendNer();
      trySendNerMetadata();
    }
  }, [
    trySend,
    featureFlags.showNer,
    trySendNer,
    trySendNerMetadata,
    nerReferenceList,
    transactionDataReferenceList,
    nounMasterReferenceList,
  ]);

  const onDocLoaded = useCallback((data: Record<string, unknown>) => {
    // Clear DOC_LOADED timeout — document rendered successfully
    if (docLoadedTimeoutRef.current) {
      window.clearTimeout(docLoadedTimeoutRef.current);
      docLoadedTimeoutRef.current = null;
    }
    setIsLoading(false);
    console.log(
      `[MFEViewer] Document loaded: ${data.fileName} (${data.pageCount} pages)`,
    );
  }, []);

  const onDocRequest = useCallback(
    async (data: Record<string, unknown>) => {
      if (!data.docId || typeof data.docId !== "string") return;
      setIsLoading(true);
      payloadRef.current = { ready: false, message: null };
      setLoadingMessage("Loading requested document...");
      console.log(`[MFEViewer]  Document requested: ${data.docId}`);
      const docIndex = documents.findIndex(
        (doc) => doc[documentIdField] === data.docId,
      );
      if (docIndex === -1) {
        logErrorRef.current(
          "Unable to find requested document. Please contact system administrator.",
          `Requested document with id=${data.docId} not found in document list for MFE Viewer.`,
        );
        setIsLoading(false);
        return;
      }
      updateTransientDocumentId(data.docId);

      const [buffer, caps] = (await Promise.all([
        getFileArrayBuffer(documents[docIndex][fileURLField] as URL),
        featureFlags.captures && capturesReferenceList?.referenceList
          ? fetchWithBackoff(
              pConnRef.current,
              capturesReferenceList?.referenceList,
              pConnRef.current.resolveConfigProps(
                pConnRef.current.getRawConfigProps()?.capturesReferenceList
                  ?.parameters,
              ),
              "list",
            )
          : Promise.resolve([]),
      ])) as [ArrayBuffer, Array<Record<string, unknown>>];

      if (
        featureFlags.captures &&
        capturesReferenceList?.referenceList &&
        Array.isArray(caps) &&
        caps.length === 0
      ) {
        captureAvailabilityByDocRef.current[data.docId] = false;
        setCaptureWarningVisible(true);
        logErrorRef.current(
          NO_CAPTURES_WARNING_MESSAGE,
          `No captures found for requested document with id=${data.docId} in captures data page for MFE Viewer.`,
          "warning",
        );
      } else {
        captureAvailabilityByDocRef.current[data.docId] = true;
        setCaptureWarningVisible(false);
      }

      payloadRef.current = {
        ready: true,
        message: {
          type: DOC_RESPONSE,
          docId: data.docId,
          buffer,
          captures: getCaptures(caps),
          persistHighlights: featureFlags.captures,
        },
      };
      trySend();

      if (isSplitMergeOpenedRef.current) {
        setIsLoading(false);
        setLoadingMessage("Loading...");
      }
    },
    [
      documentIdField,
      fileURLField,
      documents,
      featureFlags.captures,
      capturesReferenceList?.referenceList,
      getCaptures,
      trySend,
      setCaptureWarningVisible,
      updateTransientDocumentId,
    ],
  );

  const onViewerStateChanged = useCallback(
    (data: Record<string, unknown>) => {
      if (featureFlags.fireEventToDynamicView) {
        PCore.getPubSubUtils().publish(VIEWER_STATE_CHANGED_PUBSUB_EVENT, data);
      }

      if (featureFlags.stateChangeHandler !== true) return;

      try {
        const actionsApi = pConnRef.current.getActionsApi();
        // Update fields on redux
        actionsApi.updateFieldValue(changedPageField, data.page);
        actionsApi.updateFieldValue(changedPageCountField, data.pageCount);
        actionsApi.updateFieldValue(changedFileNameField, data.fileName);
        actionsApi.updateFieldValue(changedDocIDField, data.docId);
        actionsApi.updateFieldValue(changedDocLabelField, data.docLabel);
        actionsApi.updateFieldValue(
          changedPageCategoryIDField,
          data.pageCategoryID,
        );
        actionsApi.updateFieldValue(changedModeField, data.mode);
        actionsApi.updateFieldValue(changedTotalDocsField, data.totalDocs);

        // Trigger fields to update on client side
        actionsApi.triggerFieldChange(changedPageField, data.page);
        actionsApi.triggerFieldChange(changedPageCountField, data.pageCount);
        actionsApi.triggerFieldChange(changedFileNameField, data.fileName);
        actionsApi.triggerFieldChange(changedDocIDField, data.docId);
        actionsApi.triggerFieldChange(changedDocLabelField, data.docLabel);
        actionsApi.triggerFieldChange(
          changedPageCategoryIDField,
          data.pageCategoryID,
        );
        actionsApi.triggerFieldChange(changedModeField, data.mode);
        actionsApi.triggerFieldChange(changedTotalDocsField, data.totalDocs);

        // Update Transient Document Id
        updateTransientDocumentId(data.docId as string);

        if (featureFlags.updateDocumentFields) {
          const currentContent =
            pConnRef.current.getDataObject()?.caseInfo?.content ?? {};

          const resolvedDocumentFields =
            typeof documentFields === "object"
              ? Object.keys(documentFields).reduce(
                  (acc, key) => {
                    const field = documentFields[key];
                    if (typeof field === "string") {
                      acc[key] = pConnRef.current.getValue(
                        field,
                        pConnRef.current.getPageReference(),
                      );
                    }
                    return acc;
                  },
                  {} as Record<string, unknown>,
                )
              : {};

          pConnRef.current.updateState({
            caseInfo: {
              content: {
                ...currentContent,
                ...(typeof resolvedDocumentFields === "object" &&
                resolvedDocumentFields !== null
                  ? resolvedDocumentFields
                  : {}),
              },
            },
          });
        }

        // Sync captures warning banner for the newly active document. Since the iframe
        // only sends DOC_REQUEST for documents it hasn't fetched yet, cached document
        // navigation only surfaces here. The cache is already populated by
        // loadDocumentsForViewer/onDocRequest, so this is a cheap lookup, not a fetch.
        if (featureFlags.captures && typeof data.docId === "string") {
          const cached = captureAvailabilityByDocRef.current[data.docId];
          if (typeof cached === "boolean") {
            setCaptureWarningVisible(!cached);
          }
        }
      } catch (err) {
        logErrorRef.current(
          "Failed to update viewer state on viewer event. Some fields may not display correctly.",
          `Error updating fields on viewer state change: ${err}`,
          "warning",
        );
      }
    },
    [
      featureFlags.stateChangeHandler,
      featureFlags.fireEventToDynamicView,
      changedPageField,
      changedPageCountField,
      changedFileNameField,
      changedDocIDField,
      changedDocLabelField,
      changedPageCategoryIDField,
      changedModeField,
      changedTotalDocsField,
      updateTransientDocumentId,
      featureFlags.captures,
      setCaptureWarningVisible,
      documentFields,
      featureFlags.updateDocumentFields,
    ],
  );

  const onDocLoadError = useCallback((data: Record<string, unknown>) => {
    setIsLoading(false);
    const { code, reason, docId } = data;
    if (docLoadedTimeoutRef.current) {
      window.clearTimeout(docLoadedTimeoutRef.current);
      docLoadedTimeoutRef.current = null;
    }

    logErrorRef.current(
      `Failed to load document. Please try again later.`,
      `MFE Viewer reported DOC_LOAD_ERROR(${code}) for ${docId}: ${reason}`,
      "warning",
    );
  }, []);

  const onSplitMergeOpened = useCallback(
    (data: Record<string, unknown>) => {
      if (featureFlags.allowExpand) setIsExpanded(true);
      isSplitMergeOpenedRef.current = true;
      console.log("[MFEViewer] Split and merge opened:", data.fileName);

      if (isSAMOpenField) {
        try {
          pConnRef.current
            .getActionsApi()
            .updateFieldValue(isSAMOpenField, isSplitMergeOpenedRef.current);
          pConnRef.current
            .getActionsApi()
            .triggerFieldChange(isSAMOpenField, isSplitMergeOpenedRef.current);
        } catch (err) {
          console.warn(
            "Failed to update isSAMOpenField on viewer state change:",
            err,
          );
        }
      }
    },
    [featureFlags.allowExpand, isSAMOpenField],
  );

  const onSplitMergeDrafted = useCallback(() => {
    isSplitMergeOpenedRef.current = true;
    console.log("[MFEViewer] Split and merge drafted");
    if (isSAMOpenField) {
      try {
        pConnRef.current
          .getActionsApi()
          .updateFieldValue(isSAMOpenField, isSplitMergeOpenedRef.current);
        pConnRef.current
          .getActionsApi()
          .triggerFieldChange(isSAMOpenField, isSplitMergeOpenedRef.current);
      } catch (err) {
        console.warn(
          "Failed to update isSAMOpenField on viewer state change:",
          err,
        );
      }
    }
  }, [isSAMOpenField]);

  const onRetriggerClicked = useCallback(
    async (data: Record<string, unknown>) => {
      console.log(
        `[MFEViewer] Retrigger clicked: ${data.reason ?? "user_click"}`,
      );
      isSplitMergeOpenedRef.current = false;
      if (data && data.status === "error") return;
      setHasInitialCheckCompleted(true);
      setSamInProgress(true);
      updateSamInProgressStatusProperty(true);
      if (payloadRef.current.message) {
        const updatedMessage =
          "showSplitMerge" in payloadRef.current.message
            ? {
                ...payloadRef.current.message,
                showSplitMerge: false,
              }
            : payloadRef.current.message;

        payloadRef.current = {
          ...payloadRef.current,
          message: updatedMessage,
        };
        sendToViewer(updatedMessage);
      }

      // Make Transactions view Read Only
      if (transactionDataPayloadRef.current.message) {
        const updatedTransactionMessage = {
          ...transactionDataPayloadRef.current?.message,
          readOnly: true,
        };

        transactionDataPayloadRef.current = {
          ...transactionDataPayloadRef.current,
          message: updatedTransactionMessage,
        };
        sendToViewer(updatedTransactionMessage);
      }

      // Make NER view Read Only
      if (nerMetadataPayloadRef.current.message) {
        const updatedNerMetadataMessage =
          "readOnlyNer" in nerMetadataPayloadRef.current.message
            ? {
                ...nerMetadataPayloadRef.current.message,
                readOnlyNer: true,
              }
            : nerMetadataPayloadRef.current.message;

        nerMetadataPayloadRef.current = {
          ...nerMetadataPayloadRef.current,
          message: updatedNerMetadataMessage,
        };
        sendToViewer(updatedNerMetadataMessage);
      }

      if (featureFlags.allowExpand) setIsExpanded(false);

      if (isSAMOpenField) {
        try {
          pConnRef.current
            .getActionsApi()
            .updateFieldValue(isSAMOpenField, isSplitMergeOpenedRef.current);
          pConnRef.current
            .getActionsApi()
            .triggerFieldChange(isSAMOpenField, isSplitMergeOpenedRef.current);
        } catch (err) {
          console.warn(
            "Failed to update isSAMOpenField on viewer state change:",
            err,
          );
        }
      }

      await updateSplitMergeWorkStatus(inProgressWorkStatus);
    },
    [
      sendToViewer,
      featureFlags.allowExpand,
      updateSamInProgressStatusProperty,
      isSAMOpenField,
      updateSplitMergeWorkStatus,
      inProgressWorkStatus,
    ],
  );

  const onSplitMergeExited = useCallback(
    (data: Record<string, unknown>) => {
      if (featureFlags.allowExpand) setIsExpanded(false);

      isSplitMergeOpenedRef.current = false;
      console.log(
        `[MFEViewer] Split and merge exited: ${data.reason ?? "user_exit"}`,
      );

      if (isSAMOpenField) {
        try {
          pConnRef.current
            .getActionsApi()
            .updateFieldValue(isSAMOpenField, isSplitMergeOpenedRef.current);
          pConnRef.current
            .getActionsApi()
            .triggerFieldChange(isSAMOpenField, isSplitMergeOpenedRef.current);
        } catch (err) {
          console.warn(
            "Failed to update isSAMOpenField on viewer state change:",
            err,
          );
        }
      }
    },
    [featureFlags.allowExpand, isSAMOpenField],
  );

  const onAllDocRequest = useCallback(async () => {
    if (!Array.isArray(documents) || documents.length === 0) {
      logErrorRef.current(
        "No documents available to process for split/merge.",
        "ALL_DOC_REQUEST received but documents list is empty.",
        "warning",
      );
    }

    setIsLoading(true);
    setLoadingMessage("Loading all documents...");

    try {
      const settled = await Promise.allSettled(
        documents.map(async (doc) => {
          const id = doc[documentIdField] as string;
          const name = doc[fileNameField] as string;
          const pageCategories = getDocPageCategories(doc);
          const primaryCategory = pageCategories[0];
          const pageCategoryID = primaryCategory?.pageCategoryID;
          const category = primaryCategory?.category;
          const buffer = await getFileArrayBuffer(doc[fileURLField] as URL);
          return { id, name, pageCategoryID, category, buffer };
        }),
      );

      const categoryList = await fetchWithBackoff(
        pConnRef.current,
        samCategoryReferenceList?.referenceList,
        pConnRef.current.resolveConfigProps(
          pConnRef.current.getRawConfigProps()?.samCategoryReferenceList
            ?.parameters,
        ),
        "list",
      );

      const fulfilledResults = settled.filter(
        (
          result,
        ): result is PromiseFulfilledResult<{
          id: string;
          name: string;
          pageCategoryID: string;
          category: string;
          buffer: ArrayBuffer;
        }> => result.status === "fulfilled",
      );

      const allDocuments = fulfilledResults.map((result) => result.value);

      const failedCount = settled.length - allDocuments.length;
      if (failedCount > 0) {
        logErrorRef.current(
          "Some documents could not be prepared for split/merge.",
          `ALL_DOC_REQUEST partial failure: ${failedCount} of ${settled.length} document buffers failed to load.`,
          "warning",
        );
      }

      sendToViewer({
        showSearch: featureFlags.showSearch,
        type: ALL_DOC_RESPONSE,
        appId,
        correlationId,
        showSplitMerge: featureFlags.splitAndMerge && !samInProgress,
        enablePhysicalSplit: featureFlags.physicalSplit,
        waitForSplit: featureFlags.waitForSplit,
        manualSplit: featureFlags.manualSplit,
        allowPageShuffling: featureFlags.allowPageShuffling,
        allowPageMovement: featureFlags.allowPageMovement,
        manifest: {
          mode: "MultiDoc:SinglePage",
          categoryList: getCategoryList(
            categoryList as Array<Record<string, unknown>>,
          ),
          documents: allDocuments,
        },
      });
    } catch (err) {
      logErrorRef.current(
        "Failed to prepare documents for split/merge. Please try again later.",
        `Failed processing ALL_DOC_REQUEST: ${err}`,
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    featureFlags.showSearch,
    featureFlags.splitAndMerge,
    featureFlags.physicalSplit,
    featureFlags.waitForSplit,
    featureFlags.manualSplit,
    featureFlags.allowPageShuffling,
    featureFlags.allowPageMovement,
    documents,
    documentIdField,
    fileNameField,
    fileURLField,
    getDocPageCategories,
    appId,
    correlationId,
    sendToViewer,
    getCategoryList,
    samCategoryReferenceList?.referenceList,
    samInProgress,
  ]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    setIsLoading(true);
    setLoadingMessage("Checking for updated documents...");

    try {
      const isCompleted = await isSAMCorrectionCompleted();

      if (isCompleted === true) {
        // Status is completed: update state and reload documents (which fires the event with showSplitMerge: true)
        setSamInProgress(false);
        updateSamInProgressStatusProperty(false);
        setLoadingMessage("Updating documents...");
        await loadDocumentsForViewerRef.current?.(false);
        const updatedMessage =
          payloadRef.current.message &&
          "showSplitMerge" in payloadRef.current.message
            ? {
                ...payloadRef.current.message,
                showSplitMerge: true,
              }
            : payloadRef.current?.message;
        payloadRef.current = {
          ...payloadRef.current,
          message: updatedMessage,
        };
        // Fire updated load manifest to viewer to show split/merge button if applicable
        if (updatedMessage) sendToViewer(updatedMessage);

        // Fire transaction data to viewer if applicable
        const updatedTransactionMessage = {
          ...transactionDataPayloadRef.current?.message,
          readOnly: false,
        } as LoadExtractionDataMessage;
        transactionDataPayloadRef.current = {
          ...transactionDataPayloadRef.current,
          message: updatedTransactionMessage,
        };
        if (updatedTransactionMessage) sendToViewer(updatedTransactionMessage);

        // Fire NER metadata to viewer if applicable
        const updatedNerMetadataMessage = {
          ...nerMetadataPayloadRef.current?.message,
          readOnlyNer: false,
        } as NerMetadataMessage;
        nerMetadataPayloadRef.current = {
          ...nerMetadataPayloadRef.current,
          message: updatedNerMetadataMessage,
        };
        if (updatedNerMetadataMessage) sendToViewer(updatedNerMetadataMessage);

        // Fire NER data to viewer if applicable
        trySendNer();

        isSplitMergeOpenedRef.current = false;

        pConnRef.current
          .getActionsApi()
          .updateFieldValue(isSAMOpenField, isSplitMergeOpenedRef.current);
        pConnRef.current
          .getActionsApi()
          .triggerFieldChange(isSAMOpenField, isSplitMergeOpenedRef.current);

        await updateSplitMergeWorkStatus(completedWorkStatus);
      } else if (isCompleted === false) {
        // Status is not completed: retain info banner, keep samInProgress true (no event sent)
        setSamInProgress(true);
      } else {
        logErrorRef.current(
          "Unable to determine status. Please try refreshing again.",
          "SAM re-classification status could not be determined from status data page.",
          "warning",
        );
      }
    } catch (err) {
      logErrorRef.current(
        "Failed to refresh status. Please try again.",
        `Failed refreshing SAM re-classification status: ${err}`,
        "warning",
      );
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
      setLoadingMessage("Loading...");
    }
  }, [
    isRefreshing,
    isSAMCorrectionCompleted,
    loadDocumentsForViewerRef,
    sendToViewer,
    updateSamInProgressStatusProperty,
    trySendNer,
    isSAMOpenField,
    completedWorkStatus,
    updateSplitMergeWorkStatus,
  ]);

  const onNerDocRequest = useCallback(
    async (data: any) => {
      try {
        if (!data.docId || typeof data.docId !== "string") return;
        setIsLoading(true);
        nerPayloadRef.current = { ready: false, message: null };
        setLoadingMessage("Loading NER extraction for requested document...");
        console.log(
          `[MFEViewer] NER extraction requested for document: ${data.docId}`,
        );

        updateTransientDocumentId(data.docId);

        const ner = await fetchWithBackoff(
          pConnRef.current,
          nerReferenceList?.referenceList,
          pConnRef.current.resolveConfigProps(
            pConnRef.current.getRawConfigProps()?.nerReferenceList?.parameters,
          ),
          "list",
        );

        if (
          ner &&
          Array.isArray(ner) &&
          ner.length > 0 &&
          ner[0][nerJsonField]
        ) {
          nerPayloadRef.current = {
            ready: true,
            message: JSON.parse(
              ner[0][nerJsonField] as string,
            ) as NerDocResponseMessage,
          };

          trySendNer();
        }
      } catch (err) {
        console.error(
          "Failed to load NER extraction for requested document:",
          err,
        );
      } finally {
        setIsLoading(false);
        setLoadingMessage("Loading...");
      }
    },
    [
      nerReferenceList?.referenceList,
      trySendNer,
      nerJsonField,
      updateTransientDocumentId,
    ],
  );

  const onNerOpened = useCallback(
    (data: Record<string, unknown>) => {
      if (featureFlags.allowExpand) setIsExpanded(true);
      isNEROpenedRef.current = true;
      console.log("[MFEViewer] NER opened:", data.docId);
      if (isNEROpenField) {
        try {
          pConnRef.current
            .getActionsApi()
            .updateFieldValue(isNEROpenField, isNEROpenedRef.current);
          pConnRef.current
            .getActionsApi()
            .triggerFieldChange(isNEROpenField, isNEROpenedRef.current);
        } catch (err) {
          console.warn(
            "Failed to update isNEROpenField on viewer state change:",
            err,
          );
        }
      }
    },
    [featureFlags.allowExpand, isNEROpenField],
  );

  const onNerExited = useCallback(
    (data: Record<string, unknown>) => {
      if (featureFlags.allowExpand) setIsExpanded(false);
      isNEROpenedRef.current = false;
      if (isNEROpenField) {
        try {
          pConnRef.current
            .getActionsApi()
            .updateFieldValue(isNEROpenField, isNEROpenedRef.current);
          pConnRef.current
            .getActionsApi()
            .triggerFieldChange(isNEROpenField, isNEROpenedRef.current);
        } catch (err) {
          console.warn(
            "Failed to update isNEROpenField on viewer state change:",
            err,
          );
        }
        console.log("[MFEViewer] NER exited:", data.docId);
      }
    },
    [featureFlags.allowExpand, isNEROpenField],
  );

  const onInvalidNer = useCallback((data: Record<string, unknown>) => {
    logErrorRef.current(
      "Incorrect NER extraction received. Viewer may not display noun extractions correctly.",
      `Invalid document_id - ${data.receivedDocId} received for NER extraction. Expected ${data.expectedDocId}.`,
      "warning",
    );
  }, []);

  const onNerSubmitted = useCallback(
    async (data: Record<string, unknown>) => {
      try {
        setIsLoading(true);
        setLoadingMessage("Submitting NER extraction...");

        const res = await fetchWithBackoff(
          pConnRef.current,
          nerSaveReferenceList?.referenceList,
          {
            ...pConnRef.current.resolveConfigProps(
              pConnRef.current.getRawConfigProps()?.nerSaveReferenceList
                ?.parameters,
            ),
            [uniqueIdParameter || "UniqueID"]: data.uniqueID,
            [nerDataParameter || "nerData"]: JSON.stringify(data),
          },
          "list",
          {
            maxRetries: 0,
          },
        );
        if (featureFlags.allowExpand) setIsExpanded(false);

        if (res && Array.isArray(res) && res.length > 0) {
          sendToViewer({
            type: VALIDATION_MSG,
            mode: "SUBMIT",
            status: res[0][saveResultField] as "SUCCESS" | "ERROR",
            message:
              (res[0][saveMessageField] as string) ||
              `Failed to submit data. Please try again.`,
          });
          return;
        }

        if (isNERSubmittedField) {
          pConnRef.current
            .getActionsApi()
            .updateFieldValue(isNERSubmittedField, true);
          pConnRef.current
            .getActionsApi()
            .triggerFieldChange(isNERSubmittedField, true);
        }

        if (
          featureFlags.finishAssignmentOnSubmitNER ||
          data.action === NER_SUBMIT_ACTION_SAVE
        ) {
          await pConnRef.current
            .getActionsApi()
            .finishAssignment(pConnRef.current.getContextName());
        } else if (data.action === NER_SUBMIT_ACTION_APPROVE) {
          await pConnRef.current
            .getActionsApi()
            .approveCase(pConnRef.current.getContextName());
        } else if (data.action === NER_SUBMIT_ACTION_REJECT) {
          await pConnRef.current
            .getActionsApi()
            .rejectCase(pConnRef.current.getContextName());
        }
      } catch (err) {
        sendToViewer({
          type: VALIDATION_MSG,
          mode: "SUBMIT",
          status: "ERROR",
          message: `Failed to submit data. Please try again.`,
        });
      } finally {
        setIsLoading(false);
        setLoadingMessage("Loading...");
      }
    },
    [
      nerSaveReferenceList,
      nerDataParameter,
      featureFlags.allowExpand,
      featureFlags.finishAssignmentOnSubmitNER,
      isNERSubmittedField,
      sendToViewer,
      saveMessageField,
      saveResultField,
      uniqueIdParameter,
    ],
  );

  const onCapturePreview = useCallback(() => {
    console.log("[MFEViewer] Capture preview requested");
  }, []);

  const onOcrRequest = useCallback(
    async (data: Record<string, unknown>) => {
      try {
        setIsLoading(true);
        setLoadingMessage("Extracting text for OCR request...");
        console.log("[MFEViewer] OCR request received:", data.docId);

        setWarningMessages((prev) =>
          prev.filter(
            (msg) =>
              [
                "No OCR data returned for requested snippet. Viewer may not display extraction correctly.",
                "No field selected for On Demand OCR extraction. Please select a field in the NER panel before performing OCR extraction.",
                "No field selected for On Demand OCR extraction. Please select a field in the NER panel before performing OCR extraction.",
              ].includes(msg) === false,
          ),
        );

        // Convert array buffer to base64 string for OCR on-demand data page
        const base64Snippet = await arrayBufferToBase64(
          data.capturedScreenshot as ArrayBuffer,
        );

        const timeoutInMs =
          Number.isFinite(ocrOnDemandExtractionTimeoutInMS) &&
          ocrOnDemandExtractionTimeoutInMS > 0
            ? ocrOnDemandExtractionTimeoutInMS
            : 120000;

        const withTimeout = <T,>(promise: Promise<T>, ms: number) =>
          new Promise<T>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              reject(
                new Error(`OCR extraction request timed out after ${ms}ms.`),
              );
            }, ms);

            promise
              .then(resolve)
              .catch(reject)
              .finally(() => {
                clearTimeout(timeoutId);
              });
          });

        const res = await withTimeout(
          fetchWithBackoff(
            pConnRef.current,
            ocrOnDemandReferenceList?.referenceList,
            {
              ...pConnRef.current.resolveConfigProps(
                pConnRef.current.getRawConfigProps()?.ocrOnDemandReferenceList
                  ?.parameters,
              ),
              [ocrOnDemandRefIdParameter]: data.refId,
              [ocrOnDemandDocumentIdParameter]: data.docId,
              [ocrOnDemandBase64SnippetParameter]: base64Snippet,
            },
            "list",
            {
              maxRetries: 0,
            },
            true,
          ),
          timeoutInMs,
        );

        if (res && Array.isArray(res) && res.length) {
          const ocrData = res[0][ocrOnDemandExtractedValueField] as string;

          sendToViewer({
            type: OCR_RESPONSE,
            docId: data.docId as string,
            refId: data.refId as string,
            value: ocrData,
            coordinates: data.coordinates as {
              page_number: number;
              box_2d: number[];
            },
          });
        } else {
          logErrorRef.current(
            "No OCR data returned for requested snippet. Viewer may not display extraction correctly.",
            `No OCR data returned for requested snippet with id=${data.docId} in OCR on-demand data page for MFE Viewer.`,
            "warning",
          );
        }
      } catch (err) {
        logErrorRef.current(
          "Failed to process OCR request. Please try again.",
          `Failed processing OCR request: ${err}`,
          "warning",
        );
      } finally {
        setIsLoading(false);
        setLoadingMessage("Loading...");
      }
    },
    [
      ocrOnDemandReferenceList?.referenceList,
      ocrOnDemandBase64SnippetParameter,
      ocrOnDemandRefIdParameter,
      ocrOnDemandDocumentIdParameter,
      ocrOnDemandExtractedValueField,
      ocrOnDemandExtractionTimeoutInMS,
      sendToViewer,
    ],
  );

  // Action bar event listener for physical split trigger. This is only relevant when the viewer is configured to wait for a physical split trigger from the action bar.
  useEffect(() => {
    const handleEvent = async (payload: Record<string, unknown>) => {
      try {
        if (
          payload?.type === ACTION_BAR_EVENT_TYPE &&
          payload?.target === ACTION_BAR_EVENT_TARGET
        ) {
          console.log("[MFEViewer] Action bar event received:", payload);

          if (
            featureFlags.physicalSplit &&
            featureFlags.waitForSplit &&
            samQueryDataPage?.source &&
            samQueryDataPage?.fields?.requestField
          ) {
            // Show a modal dialog here on the viewer to indicate that the physical split is being triggered
            const confirmed = await new Promise<boolean>((resolve) => {
              if (!physicalSplitModalConfirmationMessage) {
                resolve(true);
                return;
              }

              const { dismiss } = modalManagerRef.current.create(() => (
                <Modal
                  heading="Confirm Physical Split"
                  autoWidth
                  center
                  actions={
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        flexGrow: 1,
                        gap: 1,
                      }}
                    >
                      <Button
                        variant="secondary"
                        style={{
                          background: theme.base.colors.white,
                          borderColor: theme.base.palette.interactive,
                          color: theme.base.palette.interactive,
                        }}
                        onClick={() => {
                          dismiss();
                          resolve(false);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        onClick={() => {
                          dismiss();
                          resolve(true);
                        }}
                      >
                        Submit
                      </Button>
                    </div>
                  }
                >
                  <Text>{physicalSplitModalConfirmationMessage}</Text>
                </Modal>
              ));
            });

            if (!confirmed) return;

            setIsLoading(true);
            setLoadingMessage("Triggering physical split...");
            const res = (await fetchWithBackoff(
              pConnRef.current,
              samQueryDataPage?.source,
              pConnRef.current.resolveConfigProps(
                pConnRef.current.getRawConfigProps()?.samQueryDataPage
                  ?.parameters,
              ),
              "page",
              {
                maxRetries: 0,
              },
              true,
            )) as Record<string, unknown>;

            if (!res) {
              throw new Error(
                "Failed to fetch data from samQueryDataPage. Response is null or undefined.",
              );
            }

            const requestString = res[
              samQueryDataPage?.fields?.requestField
            ] as string;

            if (requestString) {
              const request = JSON.parse(requestString);
              sendToViewer(request);
            } else {
              await pConnRef.current
                .getActionsApi()
                .finishAssignment(pConnRef.current.getContextName());
              setIsLoading(false);
            }
            setLoadingMessage("Loading...");
          } else {
            setIsLoading(true);
            setLoadingMessage("Submitting assignment...");
            await pConnRef.current
              .getActionsApi()
              .finishAssignment(pConnRef.current.getContextName());
            setIsLoading(false);
            setLoadingMessage("Loading...");
          }
        }
      } catch (err) {
        console.error(`[MFEViewer] Failed to process action bar event: ${err}`);
      }
    };

    PCore.getPubSubUtils().subscribe(
      ACTION_BAR_EVENT,
      handleEvent,
      subscriptionId,
      false,
      pConnRef.current.getContextName(),
    );

    return () => {
      PCore.getPubSubUtils().unsubscribe(
        ACTION_BAR_EVENT,
        subscriptionId,
        pConnRef.current.getContextName(),
      );
    };
  }, [
    subscriptionId,
    featureFlags.waitForSplit,
    samQueryDataPage?.source,
    samQueryDataPage?.fields?.requestField,
    sendToViewer,
    physicalSplitModalConfirmationMessage,
    theme,
    featureFlags.physicalSplit,
  ]);

  useEffect(() => {
    const handleEvent = async (payload: Record<string, unknown>) => {
      if (featureFlags.Click2Pick) {
        console.log("[MFEViewer] Element selected: ", payload);
        selectedTransactionFieldRef.current = payload?.property as string;
      }

      if (!featureFlags.highlights) return;

      if (
        highlightSource === "ElementSelector" &&
        Array.isArray(payload.box_2d) &&
        payload.box_2d.length === 4 &&
        (payload.page as number) > 0
      ) {
        sendToViewer({
          type: HIGHLIGHT,
          payload: {
            id: payload.fieldName as string,
            value: payload.value as string,
            box_2d: payload.box_2d as number[],
            page: payload.page as number,
            color: highlightColor,
          },
        });
      }
    };

    // Subscribe to event from Element Selector for OCR on-demand transaction field
    PCore.getPubSubUtils().subscribe(
      ELEMENT_PROPAGATE,
      handleEvent,
      subscriptionId,
      false,
      pConnRef.current.getContextName(),
    );

    return () => {
      PCore.getPubSubUtils().unsubscribe(
        ELEMENT_PROPAGATE,
        subscriptionId,
        pConnRef.current.getContextName(),
      );
    };
  }, [
    featureFlags.Click2Pick,
    featureFlags.highlights,
    highlightSource,
    loadHighlights,
    sendToViewer,
    subscriptionId,
    highlightColor,
  ]);

  useEffect(() => {
    if (!featureFlags.highlights || highlightSource !== "DynamicView") return;

    const handleEvent = async (payload: Record<string, unknown>) => {
      if (
        Array.isArray(payload?.box_2d) &&
        payload?.box_2d.length === 4 &&
        (payload.page as number) > 0
      ) {
        sendToViewer({
          type: HIGHLIGHT,
          payload: {
            id: payload.fieldName as string,
            value: payload.value as string,
            box_2d: payload.box_2d as number[],
            page: payload.page as number,
            color: highlightColor,
          },
        });
      }
    };

    PCore.getPubSubUtils().subscribe(
      DYNAMIC_VIEW_FIELD_HIGHLIGHT,
      handleEvent,
      subscriptionId,
      false,
      pConnRef.current.getContextName(),
    );

    return () => {
      PCore.getPubSubUtils().unsubscribe(
        DYNAMIC_VIEW_FIELD_HIGHLIGHT,
        subscriptionId,
        pConnRef.current.getContextName(),
      );
    };
  }, [
    featureFlags.highlights,
    highlightSource,
    subscriptionId,
    highlightColor,
    sendToViewer,
  ]);

  const onCancel = useCallback(() => {
    console.log("[MFEViewer] Cancel clicked");
    pConnRef.current
      .getActionsApi()
      .cancelAssignment(pConnRef.current.getContextName(), false);
  }, []);

  const onExtractionDataRequest = useCallback(
    async (data: Record<string, unknown>) => {
      try {
        if (!data.docId || typeof data.docId !== "string") return;
        setIsLoading(true);
        nerPayloadRef.current = { ready: false, message: null };
        setLoadingMessage(
          "Loading transaction extraction for requested document...",
        );
        console.log(
          `[MFEViewer] Transaction extraction requested for document: ${data.docId}`,
        );

        updateTransientDocumentId(data.docId);

        const transactionData: any = await fetchWithBackoff(
          pConnRef.current,
          transactionDataReferenceList?.referenceList,
          pConnRef.current.resolveConfigProps(
            pConnRef.current.getRawConfigProps()?.transactionDataReferenceList
              ?.parameters,
          ),
          "list",
          {
            maxRetries: 0,
          },
        );

        if (transactionData.length === 0) {
          setIsLoading(false);
          return;
        }

        transactionDataPayloadRef.current = {
          ready: true,
          message: JSON.parse(
            transactionData[0][transactionDataJsonField],
          ) as LoadExtractionDataMessage,
        };
        trySendTransactionData();
      } catch (err) {
        console.error(
          `[MFEViewer] Failed to process transaction extraction request: ${err}`,
        );
      } finally {
        setIsLoading(false);
        setLoadingMessage("Loading...");
      }
    },
    [
      transactionDataReferenceList,
      transactionDataJsonField,
      trySendTransactionData,
      updateTransientDocumentId,
    ],
  );

  const onFormSaveSubmit = useCallback(
    async (data: Record<string, unknown>, isSubmit: boolean = false) => {
      try {
        setIsLoading(true);
        setLoadingMessage(isSubmit ? "Submitting form..." : "Saving form...");
        console.log(
          `[MFEViewer] Form ${isSubmit ? "submit" : "save"} requested for document: ${data.docId}`,
        );
        await fetchWithBackoff(
          pConnRef.current,
          transactionDataSaveReferenceList?.referenceList,
          {
            ...pConnRef.current.resolveConfigProps(
              pConnRef.current.getRawConfigProps()
                ?.transactionDataSaveReferenceList?.parameters,
            ),
            [uniqueIdParameter]: data.uniqueID,
            [transactionFieldsParameter]: JSON.stringify(data),
          },
          "list",
          {
            maxRetries: 0,
          },
        );

        if (!isSubmit && Array.isArray(data.fields) && data.fields.length > 0) {
          const currentContent =
            pConnRef.current.getDataObject()?.caseInfo?.content ?? {};

          const resolvedFields = data.fields.reduce((acc, field) => {
            if (
              field &&
              typeof field === "object" &&
              field.field_name &&
              field.field_value
            ) {
              acc[field.field_name] = field.field_value;
            }
            return acc;
          }, {});

          pConnRef.current.updateState({
            caseInfo: {
              content: {
                ...currentContent,
                BatchDetails: {
                  ...currentContent.BatchDetails,
                  ...(typeof resolvedFields === "object" &&
                  resolvedFields !== null
                    ? resolvedFields
                    : {}),
                },
              },
            },
          });
          await pConnRef.current
            .getActionsApi()
            .saveAssignment(pConnRef.current.getContextName());
          const latestAssignmentEtag = sessionStorage.getItem(
            LATEST_ASSIGNMENT_ETAG_KEY,
          );
          if (latestAssignmentEtag) {
            PCore.getContainerUtils().updateCaseContextEtag(
              pConnRef.current.getContextName(),
              latestAssignmentEtag,
            );
          }
        }

        if (isSubmit && featureFlags.finishAssignmentOnSubmitTransactionData) {
          await pConnRef.current
            .getActionsApi()
            .finishAssignment(pConnRef.current.getContextName());
        }
      } catch (err) {
        console.error(
          `[MFEViewer] Failed to process form save/submit request: ${err}`,
        );
      } finally {
        setIsLoading(false);
        setLoadingMessage("Loading...");
      }
    },
    [
      transactionDataSaveReferenceList,
      transactionFieldsParameter,
      uniqueIdParameter,
      featureFlags.finishAssignmentOnSubmitTransactionData,
    ],
  );

  useEffect(() => {
    registerAssignmentEtagInterceptor();
  }, []);

  const onSplitApprovedAck = useCallback(async () => {
    console.log("[MFEViewer] split approved acknowledged");
    setLoadingMessage("Submitting assignment...");
    await pConnRef.current
      .getActionsApi()
      .finishAssignment(pConnRef.current.getContextName());
    setIsLoading(false);
    setLoadingMessage("");
  }, []);

  // Global listener for iframe postMessage events with origin/source guards
  useEffect(() => {
    if (!viewerOrigin) return undefined;

    const handleMessage = (event: MessageEvent<ViewerMessage>) => {
      if (
        !event.data ||
        typeof event.data !== "object" ||
        !("type" in event.data)
      )
        return;

      const isDiffOriginType = DIFF_ORIGIN_EVENT_TYPES.includes(
        event.data.type,
      );
      if (
        !isDiffOriginType &&
        (event.origin !== viewerOrigin ||
          event.source !== iframeRef.current?.contentWindow)
      )
        return;

      const { type: messageType, ...data } = event.data;
      switch (messageType) {
        case READY:
          onViewerReady();
          break;
        case DOC_LOADED:
          onDocLoaded(data);
          break;
        case DOC_REQUEST:
          onDocRequest(data);
          break;
        case VIEWER_STATE_CHANGED:
          onViewerStateChanged(data);
          break;
        case DOC_LOAD_ERROR:
          onDocLoadError(data);
          break;
        case SPLIT_MERGE_OPENED:
          onSplitMergeOpened(data);
          break;
        case SPLIT_MERGE_DRAFTED:
          onSplitMergeDrafted();
          break;
        case SPLIT_MERGE_EXITED:
          onSplitMergeExited(data);
          break;
        case RETRIGGER_CLICKED:
          onRetriggerClicked(data);
          break;
        case ALL_DOC_REQUEST:
          onAllDocRequest();
          break;
        case DOC_NER_REQUEST:
          onNerDocRequest(data);
          break;
        case NER_OPENED:
          onNerOpened(data);
          break;
        case NER_EXITED:
          onNerExited(data);
          break;
        case INVALID_NER:
          onInvalidNer(data);
          break;
        case NER_SUBMITTED:
          onNerSubmitted(data);
          break;
        case CAPTURE_PREVIEW:
          onCapturePreview();
          break;
        case OCR_REQUEST:
          onOcrRequest(data);
          break;
        case EXTRACTIONDATA_REQUEST:
          onExtractionDataRequest(data);
          break;
        case FORM_SAVE:
          onFormSaveSubmit(data);
          break;
        case SUBMIT:
          onFormSaveSubmit(data, true);
          break;
        case CANCEL:
          onCancel();
          break;
        case SPLIT_APPROVED_ACK:
          onSplitApprovedAck();
          break;
        default:
          console.warn("Unknown viewer message:", messageType);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [
    onViewerReady,
    onDocLoaded,
    onDocRequest,
    onViewerStateChanged,
    onDocLoadError,
    onSplitMergeOpened,
    onSplitMergeDrafted,
    onSplitMergeExited,
    onRetriggerClicked,
    onAllDocRequest,
    onNerDocRequest,
    onNerOpened,
    onNerExited,
    onInvalidNer,
    onNerSubmitted,
    onCapturePreview,
    onOcrRequest,
    onCancel,
    onExtractionDataRequest,
    onFormSaveSubmit,
    onSplitApprovedAck,
    viewerOrigin,
  ]);

  const [label, showLabel] = useMemo(() => {
    return [
      (inheritedProps.find(
        (prop: { prop: string; value: unknown }) => prop.prop === "label",
      )?.value as string) ?? "Document Viewer",
      (inheritedProps.find(
        (prop: { prop: string; value: unknown }) => prop.prop === "showLabel",
      )?.value as boolean) ?? true,
    ];
  }, [inheritedProps]);

  return (
    <StyledCitiExtensionsMfeViewerWrapper ref={wrapperRef}>
      {showLabel && (
        <Text style={{ marginBottom: "0.5rem" }} variant="h3">
          {label}
        </Text>
      )}

      {/* Show warning banner in case of non-blocking issues */}
      {!errorMessage && warningMessages.length > 0 && (
        <Banner
          variant="warning"
          messages={warningMessages}
          style={{ marginBottom: "1rem" }}
          onDismiss={() => setWarningMessages([])}
        />
      )}

      {/* Show info banner in case of re-classification in progress */}
      {!errorMessage &&
        samInProgress &&
        hasInitialCheckCompleted &&
        inProgressBannerText.length > 0 && (
          <Banner
            variant="info"
            messages={[
              {
                label: inProgressBannerText,
                action: {
                  text: "Refresh",
                  onClick: handleRefresh,
                },
              },
            ]}
            style={{ marginBottom: "1rem" }}
          />
        )}

      {/* Render functional error instead of iframe when any blocking issue occurs */}
      {errorMessage && <ErrorState message={errorMessage} />}

      {/* Embedded external MFE viewer */}
      <iframe
        id="mfe-doc-viewer"
        src={mfeURL}
        title={label}
        style={{
          width: "100%",
          height: "800px",
          border: "none",
          display: errorMessage ? "none" : "block",
        }}
        ref={iframeRef}
      />

      {/* Inline loader for all in-flight operations */}
      <Progress
        placement="local"
        visible={isLoading}
        message={loadingMessage}
      />
    </StyledCitiExtensionsMfeViewerWrapper>
  );
}

export default withConfiguration(CitiExtensionsMfeViewer);
