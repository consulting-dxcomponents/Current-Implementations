import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Banner, Text, Progress, ErrorState, withConfiguration } from '@pega/cosmos-react-core';
import StyledCitiExtensionsMfeMaintenanceViewerWrapper from './styles';
import { MFE_MAINTENANCE_CONSTANTS, DEFAULT_MFE_TIMEOUT_MS, ERROR_MESSAGES } from './constants';
import { fetchWithBackoff } from './utils';
import type {
  CitiExtensionsMfeMaintenanceViewerProps,
  ViewerMessage,
  ViewerPayload,
  OutboundViewerMessage,
  LoadMaintenanceMessage
} from './mfeTypes';
import './create-nonce';

const {
  MFE_READY,
  SUBMIT,
  CANCEL,
  MFEMAINTENANCE_SUBMIT_ACTION_SUBMIT,
  MFEMAINTENANCE_SUBMIT_ACTION_APPROVE,
  MFEMAINTENANCE_SUBMIT_ACTION_REJECT
} = MFE_MAINTENANCE_CONSTANTS;

function CitiExtensionsMfeMaintenanceViewer(props: CitiExtensionsMfeMaintenanceViewerProps) {
  const {
    getPConnect,
    inheritedProps,
    mfeURL,
    mfeTimeout,
    logDataPage,
    logParameter,
    mfeMaintenanceReferenceList,
    mfeMaintenanceJsonDataField,
    mfeMaintenanceDataSaveReferenceList,
    mfeMaintenanceFieldsParameter,
    caseIdParameter,
    tabParameter,
    statusParameter,
    finishAssignmentOnMfeMaintenanceSubmit,
    callSaveMFEMaintenanceFieldReferenceList
  } = props;

  // UI states
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessages, setWarningMessages] = useState<Array<string>>([]);

  // Feature flags for optional fields and capabilities
  const featureFlags = useMemo(
    () => ({
      finishAssignmentOnMfeMaintenanceSubmit,
      callSaveMFEMaintenanceFieldReferenceList
    }),
    [finishAssignmentOnMfeMaintenanceSubmit, callSaveMFEMaintenanceFieldReferenceList]
  );

  // Refs used for iframe messaging and two-gate synchronization
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isViewerReadyRef = useRef(false);
  const payloadRef = useRef<ViewerPayload>({ ready: false, message: null });

  // Stable ref to the latest pConn — getPConnect() returns a new object on every render
  const pConnRef = useRef(getPConnect());
  useEffect(() => {
    pConnRef.current = getPConnect();
  }, [getPConnect]);

  // Use strict origin from configured URL for secure postMessage communication
  const viewerOrigin = useMemo(() => {
    try {
      return new URL(mfeURL).origin;
    } catch {
      console.warn('Invalid MFE URL provided:', mfeURL);
      return '';
    }
  }, [mfeURL]);

  // Log error
  const logError = useCallback(
    (userMsg: string, serverMsg: string, logType: 'error' | 'warning' = 'error') => {
      if (logType === 'error') {
        setErrorMessage(userMsg);
      } else if (logType === 'warning') {
        setWarningMessages(prev => (prev.includes(userMsg) ? prev : [...prev, userMsg]));
      }
      if (!logDataPage || !logParameter) return;
      fetchWithBackoff(
        pConnRef.current,
        logDataPage,
        {
          [logParameter]: `Case ${pConnRef.current.getCaseSummary()?.businessID}, ${serverMsg}`
        },
        'page',
        {
          maxRetries: 0
        }
      )
        .then(() => console.warn('Logged error:', serverMsg))
        .catch(err => {
          console.error('Failed to log error to data page:', err);
        });
    },
    [logDataPage, logParameter]
  );

  // Stable ref that always points to the latest logError without causing effects to re-run
  const logErrorRef = useRef(logError);
  useEffect(() => {
    logErrorRef.current = logError;
  }, [logError]);

  // Reset all gates when mfeURL changes
  useEffect(() => {
    isViewerReadyRef.current = false;
    payloadRef.current = { ready: false, message: null };
    setIsLoading(true);
    setLoadingMessage('Loading...');
    if (!mfeURL) {
      logErrorRef.current(
        ERROR_MESSAGES.INVALID_CONFIG,
        `Missing or invalid MFE configuration: URL=${mfeURL} is required.`
      );
    } else {
      setErrorMessage(null);
    }
    setWarningMessages([]);
  }, [mfeURL]);

  // Timeout guard: if iframe does not send READY in time, fail fast with a user error
  useEffect(() => {
    if (!mfeURL || isViewerReadyRef.current || errorMessage) {
      return undefined;
    }

    const ms = mfeTimeout > 0 ? mfeTimeout : DEFAULT_MFE_TIMEOUT_MS;
    const id = window.setTimeout(() => {
      if (!isViewerReadyRef.current && !errorMessage) {
        logErrorRef.current(
          ERROR_MESSAGES.READY_TIMEOUT,
          `MFE Timeout error: READY event not received within ${ms}ms of loading URL=${mfeURL}`
        );
        setIsLoading(false);
      }
    }, ms);
    return () => window.clearTimeout(id);
  }, [mfeTimeout, mfeURL, errorMessage]);

  // Low-level message sender to iframe window
  const sendToViewer = useCallback(
    (message: OutboundViewerMessage) => {
      console.log('[MFEMaintenanceViewer] Sending message to viewer:', message);
      iframeRef.current?.contentWindow?.postMessage(message, viewerOrigin);
    },
    [viewerOrigin]
  );

  // Two-gate dispatcher: send payload only when (1) viewer is READY and (2) payload is prepared
  const trySend = useCallback(() => {
    if (isViewerReadyRef.current && payloadRef.current.ready && payloadRef.current.message) {
      sendToViewer(payloadRef.current.message);
      setIsLoading(false);
    }
  }, [sendToViewer]);

  // Fetches maintenance data, builds the payload (gate 2) and attempts a send
  const loadMaintenanceData = useCallback(
    async (isCancelled?: () => boolean) => {
      try {
        setLoadingMessage('Loading maintenance data...');

        const maintenanceData = (await fetchWithBackoff(
          pConnRef.current,
          mfeMaintenanceReferenceList?.referenceList,
          pConnRef.current.resolveConfigProps(
            pConnRef.current.getRawConfigProps()?.mfeMaintenanceReferenceList?.parameters
          ),
          'list'
        )) as Array<Record<string, unknown>>;

        if (isCancelled?.()) return;

        if (!maintenanceData.length || !maintenanceData[0][mfeMaintenanceJsonDataField]) {
          logErrorRef.current(
            ERROR_MESSAGES.MAINTENANCE_DATA_LOAD_FAILED,
            `Error fetching MFE maintenance data: No data returned in data page: ${mfeMaintenanceReferenceList?.referenceList}`,
            'warning'
          );
          setIsLoading(false);
          return;
        }

        payloadRef.current = {
          ready: true,
          message: JSON.parse(
            maintenanceData[0][mfeMaintenanceJsonDataField] as string
          ) as LoadMaintenanceMessage
        };
        trySend();
      } catch (err) {
        if (isCancelled?.()) return;
        logErrorRef.current(
          ERROR_MESSAGES.MAINTENANCE_DATA_LOAD_FAILED,
          `Failed to load MFE maintenance data from data page ${mfeMaintenanceReferenceList?.referenceList}: ${err}`,
          'warning'
        );
        setIsLoading(false);
      }
    },
    [mfeMaintenanceReferenceList?.referenceList, mfeMaintenanceJsonDataField, trySend]
  );

  useEffect(() => {
    let cancelled = false;

    if (!mfeURL) {
      setIsLoading(false);
      return undefined;
    }

    loadMaintenanceData(() => cancelled);

    return () => {
      cancelled = true;
    };
  }, [mfeURL, loadMaintenanceData]);

  // Gate 1: viewer signalled READY
  const onViewerReady = useCallback(() => {
    if (isViewerReadyRef.current) return;
    isViewerReadyRef.current = true;
    trySend();
  }, [trySend]);

  const onMfeMaintenanceSubmit = useCallback(
    async (data: Record<string, unknown>) => {
      if (data.status === 'error') {
        console.error('Maintenance submit error:', data.errorReason);
        return;
      }
      try {
        setIsLoading(true);
        setLoadingMessage('Submitting maintenance data...');
        if (featureFlags.callSaveMFEMaintenanceFieldReferenceList) {
          await fetchWithBackoff(
            pConnRef.current,
            mfeMaintenanceDataSaveReferenceList?.referenceList,
            {
              ...pConnRef.current.resolveConfigProps(
                pConnRef.current.getRawConfigProps()?.mfeMaintenanceSaveReferenceList?.parameters
              ),
              [caseIdParameter || 'CaseID']: data.caseID,
              [tabParameter || 'Tab']: data.tab,
              [statusParameter || 'Status']: data.status,
              [mfeMaintenanceFieldsParameter || 'MFEMaintenanceData']: JSON.stringify(data)
            },
            'list',
            {
              maxRetries: 0
            }
          );
        }

        if (
          featureFlags.finishAssignmentOnMfeMaintenanceSubmit &&
          data.action === MFEMAINTENANCE_SUBMIT_ACTION_SUBMIT
        ) {
          await pConnRef.current
            .getActionsApi()
            .finishAssignment(pConnRef.current.getContextName());
        } else if (data.action === MFEMAINTENANCE_SUBMIT_ACTION_APPROVE) {
          await pConnRef.current.getActionsApi().approveCase(pConnRef.current.getContextName());
        } else if (data.action === MFEMAINTENANCE_SUBMIT_ACTION_REJECT) {
          await pConnRef.current.getActionsApi().rejectCase(pConnRef.current.getContextName());
        }
      } catch (err) {
        console.error('Failed to handle maintenance submit:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [
      mfeMaintenanceDataSaveReferenceList,
      caseIdParameter,
      tabParameter,
      statusParameter,
      mfeMaintenanceFieldsParameter,
      featureFlags.finishAssignmentOnMfeMaintenanceSubmit,
      featureFlags.callSaveMFEMaintenanceFieldReferenceList
    ]
  );

  const onCancel = useCallback(() => {
    console.log('[MFEViewer] Cancel clicked');
    pConnRef.current.getActionsApi().cancelAssignment(pConnRef.current.getContextName());
  }, []);

  // Global listener for iframe postMessage events with origin/source guards
  useEffect(() => {
    if (!viewerOrigin) return undefined;

    const handleMessage = (event: MessageEvent<ViewerMessage>) => {
      if (!event.data || typeof event.data !== 'object' || !('type' in event.data)) return;

      if (event.origin !== viewerOrigin || event.source !== iframeRef.current?.contentWindow)
        return;

      const { type: messageType, ...data } = event.data;
      switch (messageType) {
        case MFE_READY:
          onViewerReady();
          break;
        case SUBMIT:
          onMfeMaintenanceSubmit(data);
          break;
        case CANCEL:
          onCancel();
          break;
        default:
          console.warn('Unknown viewer message:', messageType);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onViewerReady, onCancel, onMfeMaintenanceSubmit, viewerOrigin]);

  const [label, showLabel] = useMemo(() => {
    return [
      (inheritedProps.find((prop: { prop: string; value: unknown }) => prop.prop === 'label')
        ?.value as string) ?? 'Maintainance Viewer',
      (inheritedProps.find((prop: { prop: string; value: unknown }) => prop.prop === 'showLabel')
        ?.value as boolean) ?? true
    ];
  }, [inheritedProps]);

  return (
    <StyledCitiExtensionsMfeMaintenanceViewerWrapper>
      {showLabel && (
        <Text style={{ marginBottom: '0.5rem' }} variant='h3'>
          {label}
        </Text>
      )}

      {/* Show warning banner in case of non-blocking issues */}
      {!errorMessage && warningMessages.length > 0 && (
        <Banner
          variant='warning'
          messages={warningMessages}
          style={{ marginBottom: '1rem' }}
          onDismiss={() => setWarningMessages([])}
        />
      )}

      {/* Render functional error instead of iframe when any blocking issue occurs */}
      {errorMessage && <ErrorState message={errorMessage} />}

      {/* Embedded external MFE viewer */}
      <iframe
        id='mfe-maintainance-viewer'
        src={mfeURL}
        title={label}
        style={{
          width: '100%',
          height: '800px',
          border: 'none',
          display: errorMessage ? 'none' : 'block'
        }}
        ref={iframeRef}
      />

      {/* Inline loader for all in-flight operations */}
      <Progress placement='local' visible={isLoading} message={loadingMessage} />
    </StyledCitiExtensionsMfeMaintenanceViewerWrapper>
  );
}

export default withConfiguration(CitiExtensionsMfeMaintenanceViewer);
