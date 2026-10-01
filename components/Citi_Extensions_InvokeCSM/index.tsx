import { useState, useCallback, useEffect, useRef } from 'react';
import { Button, withConfiguration } from '@pega/cosmos-react-core';

import type { PConnFieldProps } from './PConnProps';
import './create-nonce';

import StyledCitiExtensionsInvokeCsmWrapper from './styles';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CitiExtensionsInvokeCsmProps extends PConnFieldProps {
  /** Label shown on the invoke button. Defaults to "Launch CSM". */
  buttonLabel?: string;
  // ── DataPage ──────────────────────────────────────────────────────────────
  /** Name of the Pega DataPage that contains all session data. e.g. D_CSMSession */
  dataPageName?: string;
  /**
   * Comma-separated DataPage parameter names whose values are resolved from
   * the current row data at runtime.
   * e.g. "AccountID,CustomerType"
   * The component reads pConn.getValue(pConn.getPageReference()) to get the
   * current row, then maps each parameter name to its value in that row.
   * The resulting object is passed to the DataPage call as parameters.
   */
  dataPageParams?: string;
  /**
   * Comma-separated set of DataPage response keys: "<labelKey>,<urlKey>,<caseIDKey>,<deptKey>,<userIDKey>".
   * When both labelKey and urlKey values are present in the on-load DataPage response, the
   * component renders a link instead of the button.
   * The caseIDKey, deptKey, and userIDKey are used for the logoff flow on link click.
   * e.g. "CaseLabel,CaseURL,CaseID,DeptNumber,UserID"
   */
  caseIDLaunch?: string;
  /**
   * DataPage response key for the logoff URL used in both link and button modes.
   * e.g. "LogOffURL"
   */
  logOffURL?: string;
  /**
   * DataPage response key for the case creation URL used in button mode.
   * e.g. "CaseCreateURL"
   */
  caseCreateLaunch?: string;
  /**
   * Delay in milliseconds after the initial mount call before the DataPage is
   * polled a second time. The button is disabled for this entire duration.
   * If the retry response resolves the link keys, link mode is activated.
   * e.g. 3000 → wait 3 s, then re-fetch.
   * Omit or set to 0 to disable the retry behaviour.
   */
  retryDelay?: number;
}

type LoadState = 'idle' | 'loading' | 'done' | 'error';

// PCore is a Pega platform global available at runtime.
declare const PCore: any;

// ── Component ─────────────────────────────────────────────────────────────────
//
// Flow (on mount):
//  1. DataPage is fetched once on mount.
//  2. If caseID + URL keys found → render a link (link mode).
//  3. If caseID + URL not found → extract logoff and case creation URLs from DataPage.
//     Store these URLs for button mode.
//
// Flow (link click):
//  1. Link click is intercepted (no direct navigation).
//  2. URL is opened directly in a new tab (no logoff needed for link mode).
//
// Flow (button click - create new case):
//  1. Button is clicked.
//  2. Trigger logoff flow (via hidden iframe) using pre-fetched logoff URL.
//     - The logoffURL points to an RSM endpoint that serves HTML with an auto-submitting form.
//     - This form terminates the RSM session in the background.
//  3. Launch caseCreateURL in a new tab (new case creation).
//  4. After logoff completes, wait retryDelay → retry DataPage fetch.
//     (Should now have the new caseID from the newly created case)
//  5. If caseID + URL found after retry → open URL directly (link mode).
//  6. If caseID + URL still missing → show button again with error.
//  Note: Link state is updated in step 5 so if user returns, a link will show.
//
// ── Logoff Flow Details ───────────────────────────────────────────────────────
// The logoffURL serves an HTML page with:
//  - Hidden form with CaseID, UserID, and other session data
//  - Body onload event that auto-submits the form to RSM endpoint
//  - Form submission terminates the session
//  - iframe onLoad fires when the logoff page completes
//  - Component then opens the caseCreateURL for the newly created case

function CitiExtensionsInvokeCsm(props: CitiExtensionsInvokeCsmProps) {
  const {
    getPConnect,
    buttonLabel     = 'Launch CSM',
    dataPageName    = '',
    dataPageParams  = '',
    caseIDLaunch    = '',
    logOffURL       = '',
    caseCreateLaunch = '',
    retryDelay      = 0,
  } = props;

  // ── Parse link keys ──────────────────────────────────────────────────────
  // Expects five comma-separated response keys: "<labelKey>,<urlKey>,<caseIDKey>,<deptKey>,<userIDKey>".
  const [initialLabelKey, initialUrlKey, caseIDKey, deptKey, userIDKey] = caseIDLaunch
    .split(',')
    .map((s: string) => s.trim());

  // ── Resolve DataPage parameters from current row data ─────────────────────
  // Wrapped in useCallback to maintain stable reference for use in dependencies.
  // Called on every DataPage fetch — always reads the latest row values.
  const buildDataPageParams = useCallback((): Record<string, any> => {
    const paramNames = dataPageParams
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);

    if (paramNames.length === 0) return {};

    try {
      const pConn = getPConnect();
      const rowData: Record<string, any> =
        (pConn.getValue(pConn.getPageReference()) as Record<string, any>) ?? {};

      return paramNames.reduce<Record<string, any>>((acc, name) => {
        acc[name] = rowData[name] ?? '';
        return acc;
      }, {});
    } catch {
      return {};
    }
  }, [dataPageParams, getPConnect]);

  // State for the on-load link (only populated when initialLoad is configured
  // and the DataPage response contains both expected keys).
  const [linkLabel, setLinkLabel] = useState<string>('');
  const [linkUrl, setLinkUrl] = useState<string>('');
  // Link mode state - logoff and session data needed for logoff on link click
  const [linkLogoffUrl, setLinkLogoffUrl] = useState<string>('');
  const [linkCaseID, setLinkCaseID] = useState<string>('');
  const [linkDept, setLinkDept] = useState<string>('');
  const [linkUserID, setLinkUserID] = useState<string>('');
  // Button mode state - logoff and case creation URLs fetched on load if link is not available
  const [buttonLogoffUrl, setButtonLogoffUrl] = useState<string>('');
  const [buttonCaseCreateUrl, setButtonCaseCreateUrl] = useState<string>('');
  // True while the button must stay disabled during the retry delay window.
  const [retryPending, setRetryPending] = useState<boolean>(false);
  // Cached DataPage response from the on-mount call — reused on button click
  // to avoid a redundant network request.
  const cachedResponseRef = useRef<Record<string, any> | null>(null);

  // ── On-mount DataPage call for initialLoad ────────────────────────────────
  // Empty deps — intentional. We read all config values via closure on mount.
  // Props are fully resolved before the first render so there is no risk of
  // stale values. Re-firing on every prop change would cause redundant calls.
  useEffect(() => {
    // Only run if a DataPage name is provided.
    if (!dataPageName) return;

    async function fetchAndApply(): Promise<void> {
      try {
        const pConn   = getPConnect();
        const context = pConn.getContextName();
        const response = await PCore.getDataPageUtils().getPageDataAsync(
          dataPageName,
          context,
          buildDataPageParams(),
          { invalidateCache: true }
        );

        // Cache the full response so the button click handler can reuse it
        cachedResponseRef.current = response ?? null;

        // Check for link keys (initialLabelKey, initialUrlKey)
        const label: string = response?.[initialLabelKey] ?? '';
        const url:   string = response?.[initialUrlKey]   ?? '';

        if (label && url) {
          // Link mode available - also extract logoff data for link click
          setLinkLabel(label);
          setLinkUrl(url);
          setLinkLogoffUrl(response?.[logOffURL] ?? '');
          setLinkCaseID(response?.[caseIDKey] ?? '');
          setLinkDept(response?.[deptKey] ?? '');
          setLinkUserID(response?.[userIDKey] ?? '');
        } else {
          // Link not available - fetch button mode URLs (logoff + case creation)
          const logoffUrl: string = response?.[logOffURL] ?? '';
          const caseCreateUrl: string = response?.[caseCreateLaunch] ?? '';
          setButtonLogoffUrl(logoffUrl);
          setButtonCaseCreateUrl(caseCreateUrl);
        }
      } catch {
        // Network/API failure — fall back to button with empty URLs silently.
      }
    }

    fetchAndApply();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount — all config values are stable at first render.

  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorMsg,  setErrorMsg]  = useState<string>('');
  const [logoffSrc, setLogoffSrc] = useState<string>('');
  // Store the final invoke URL so the iframe onLoad callback can access it.
  const [resolvedInvokeUrl, setResolvedInvokeUrl] = useState<string>('');
  // Track whether we're in link logoff flow or button logoff flow
  const [logoffMode, setLogoffMode] = useState<'button' | 'link' | ''>('');

  const handleInvoke = async () => {
    // Button mode: We should already have logoff and case creation URLs from on-load
    if (!buttonLogoffUrl || !buttonCaseCreateUrl) {
      setErrorMsg('Case creation or logoff URL not available. Please refresh and try again.');
      setLoadState('error');
      return;
    }

    setErrorMsg('');
    setLoadState('loading');
    setLogoffMode('button');

    try {
      // ── BUTTON CLICK FLOW ─────────────────────────────────────────────────
      // When user clicks the button:
      // 1. We already have pre-fetched URLs from on-load:
      //    - buttonLogoffUrl: Points to RSM logoff endpoint (serves auto-submitting HTML form)
      //    - buttonCaseCreateUrl: Points to CSM URL for new case creation
      //
      // 2. Set up the hidden iframe to load the logoff URL with embedded form data
      //    - The logoff URL serves HTML with: 
      //      <form action='RSM_ENDPOINT'>
      //        <input name='CaseID' />
      //        <input name='UserID' value='RSMRep' />
      //        <input name='DeptNumber' value='1000' />
      //      </form>
      //      <body onload='sendGadgetEventAndSubmit()'>
      //    - This auto-submits on page load
      //
      // 3. When iframe finishes loading, handleLogoffLoaded fires:
      //    - Logoff is complete (session terminated)
      //    - Opens caseCreateUrl in new tab
      //    - Retries DataPage to fetch new case data
      
      setResolvedInvokeUrl(buttonCaseCreateUrl);
      setLogoffSrc(buttonLogoffUrl);
      // The iframe will handle the rest via handleLogoffLoaded callback
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Failed to process the request. Please try again.');
      setLoadState('error');
      setLogoffMode('');
    }
  };

  const retryDataPageFetch = useCallback(async (): Promise<void> => {
    try {
      const context = getPConnect().getContextName();
      PCore.getDataPageUtils().clearDataPage?.(dataPageName, context);
      
      const response = await PCore.getDataPageUtils().getPageDataAsync(
        dataPageName,
        context,
        buildDataPageParams(),
        { invalidateCache: true }
      );

      cachedResponseRef.current = response ?? null;

      // Step 5: Check if caseID + URL are now available (new case created)
      const label: string = response?.[initialLabelKey] ?? '';
      const url: string = response?.[initialUrlKey] ?? '';

      if (label && url) {
        // New case found - update link state and launch URL directly (no logoff, already done)
        setLinkLabel(label);
        setLinkUrl(url);
        setLinkLogoffUrl(response?.[logOffURL] ?? '');
        setLinkCaseID(response?.[caseIDKey] ?? '');
        setLinkDept(response?.[deptKey] ?? '');
        setLinkUserID(response?.[userIDKey] ?? '');
        window.open(url, '_blank', 'noopener,noreferrer');
        setLoadState('idle');
      } else {
        // Step 6: Still no caseID + URL - update button mode URLs for potential retry
        const logoffUrl: string = response?.[logOffURL] ?? '';
        const caseCreateUrl: string = response?.[caseCreateLaunch] ?? '';
        setButtonLogoffUrl(logoffUrl);
        setButtonCaseCreateUrl(caseCreateUrl);
        
        setErrorMsg('Case data not yet available. Please try again.');
        setLoadState('error');
      }
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Failed to fetch the DataPage. Please try again.');
      setLoadState('error');
    }
  }, [dataPageName, buildDataPageParams, initialLabelKey, initialUrlKey, caseIDKey, deptKey, userIDKey, logOffURL, caseCreateLaunch, getPConnect]);

  const handleLogoffLoaded = useCallback(() => {
    // ── LOGOFF COMPLETE ───────────────────────────────────────────────────────
    // At this point:
    // 1. The hidden iframe loaded the logoffURL (RSM endpoint)
    // 2. The RSM endpoint served HTML with an auto-submitting form (from snippet)
    // 3. The form auto-submitted on page load via onload='sendGadgetEventAndSubmit()'
    // 4. The form submission included:
    //    - CaseID (the session case identifier)
    //    - UserID (RSM representative ID)
    //    - DeptNumber (department info)
    // 5. The RSM session has been terminated
    // 6. iframe onLoad event fires (this callback)
    
    // Now open the resolved URL in a new tab for the user
    window.open(resolvedInvokeUrl, '_blank', 'noopener,noreferrer');
    setLogoffSrc('');
    setResolvedInvokeUrl('');

    if (logoffMode === 'button') {
      // After button logoff, wait for retryDelay then fetch new case data
      if (retryDelay > 0) {
        setRetryPending(true);
        setTimeout(() => {
          setRetryPending(false);
          retryDataPageFetch();
        }, retryDelay);
      } else {
        retryDataPageFetch();
      }
    } else if (logoffMode === 'link') {
      // After link logoff, just reset the state
      setLoadState('idle');
    }
    
    setLogoffMode('');
  }, [retryDelay, resolvedInvokeUrl, logoffMode, retryDataPageFetch]);

  const handleLogoffError = useCallback(() => {
    setLogoffSrc('');
    setResolvedInvokeUrl('');
    setErrorMsg('The RSM logoff request failed. Please try again.');
    setLoadState('error');
    setLogoffMode('');
  }, []);

  // Helper function to build logoff URL with embedded HTML form containing session data
  const buildLogoffUrlWithData = (baseLogoffUrl: string, caseID: string, dept: string, userID: string): string => {
    // Construct the HTML form that will be submitted on load
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head><title>Logoff</title></head>
      <body>
        <form id="logoffForm" method="post" action="${baseLogoffUrl}">
          <input type="hidden" name="CaseID" value="${caseID}" />
          <input type="hidden" name="UserID" value="${userID}" />
          <input type="hidden" name="DeptNumber" value="${dept}" />
        </form>
        <script>
          function sendGadgetEventAndSubmit() {
            document.getElementById('logoffForm').submit();
          }
          window.onload = sendGadgetEventAndSubmit;
        </script>
      </body>
      </html>
    `;
    // Encode the HTML as a data URL
    return `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;
  };

  // Handle link click - trigger logoff flow then open the link
  const handleLinkClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault(); // Prevent direct navigation
    
    if (linkLogoffUrl && linkCaseID && linkDept && linkUserID) {
      // Logoff data available - trigger logoff flow before opening link
      setLoadState('loading');
      setLogoffMode('link');
      const logoffUrlWithData = buildLogoffUrlWithData(linkLogoffUrl, linkCaseID, linkDept, linkUserID);
      setResolvedInvokeUrl(linkUrl);
      setLogoffSrc(logoffUrlWithData);
    } else {
      // No logoff data - just open the link directly
      window.open(linkUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Button is disabled while a DataPage call is in flight OR during the
  // retry delay window so the user cannot click before the retry resolves.
  const isDisabled = loadState === 'loading' || retryPending;

  // Get button label based on current state
  const getButtonLabel = (): string => {
    if (retryPending) return 'Please wait…';
    if (loadState === 'loading') return 'Signing out…';
    return buttonLabel;
  };

  return (
    <StyledCitiExtensionsInvokeCsmWrapper>
      <div className='invoke-csm'>

        {/* ── Link mode (initialLoad resolved both values) ── */}
        {linkLabel && linkUrl ? (
          <a
            className='invoke-csm__link'
            href={linkUrl}
            target='_blank'
            rel='noopener noreferrer'
            onClick={handleLinkClick}
          >
            {linkLabel}
          </a>
        ) : (
          <>
            {/* ── Trigger button (default mode) ── */}
            <Button
              variant='primary'
              onClick={handleInvoke}
              disabled={isDisabled}
            >
              {getButtonLabel()}
            </Button>

            {/* ── Error message ── */}
            {loadState === 'error' && (
              <p className='invoke-csm__error' role='alert'>
                {errorMsg}
              </p>
            )}
          </>
        )}

        {/* ── Hidden logoff iframe — only used in button mode ── */}
        {logoffSrc && (
          <iframe
            className='invoke-csm__logoff-frame'
            src={logoffSrc}
            title='RSM logoff'
            aria-hidden='true'
            onLoad={handleLogoffLoaded}
            onError={handleLogoffError}
            style={{ display: 'none' }}
          />
        )}

      </div>
    </StyledCitiExtensionsInvokeCsmWrapper>
  );
}

export default withConfiguration(CitiExtensionsInvokeCsm);