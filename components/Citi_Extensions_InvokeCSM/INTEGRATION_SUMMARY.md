# Logoff HTML Integration Summary

## Overview
The component now includes detailed documentation about how the logoff HTML snippet integrates with the iframe-based logoff flow.

## Key Changes Made

### 1. **Enhanced Component Documentation**
Added a new section "Logoff Flow Details" in the component comments explaining:
- The logoffURL serves an HTML page with a hidden form
- The form contains session data (CaseID, UserID, DeptNumber)
- Body `onload` event auto-submits the form
- Form submission terminates the RSM session
- iframe `onLoad` callback fires when complete

### 2. **Detailed handleInvoke Comments**
Added comprehensive explanation of the button click flow:
```
When user clicks the button:
1. Pre-fetched URLs are ready from on-load:
   - buttonLogoffUrl: RSM endpoint serving auto-submitting HTML form
   - buttonCaseCreateUrl: CSM URL for new case creation

2. The logoff URL serves HTML with:
   <form action='RSM_ENDPOINT'>
     <input name='CaseID' />
     <input name='UserID' value='RSMRep' />
     <input name='DeptNumber' value='1000' />
   </form>
   <body onload='sendGadgetEventAndSubmit()'>

3. iframe finishes loading → handleLogoffLoaded fires:
   - Logoff is complete (session terminated)
   - Opens caseCreateUrl in new tab
   - Retries DataPage to fetch new case data
```

### 3. **Detailed handleLogoffLoaded Comments**
Added step-by-step explanation of what happens at each stage:
- iframe loaded the logoffURL
- RSM endpoint served auto-submitting HTML form
- Form auto-submitted via `onload='sendGadgetEventAndSubmit()'`
- Form included CaseID, UserID, DeptNumber
- RSM session has been terminated
- iframe onLoad event fires (this callback executes)
- Component opens case creation URL in new tab
- Component retries DataPage to get new case data

### 4. **CSS Enhancement**
Added `style={{ display: 'none' }}` to the iframe element to explicitly hide it (was already using `aria-hidden='true'` but now visually hidden too).

## How The Logoff Flow Works

### Architecture
```
User clicks Button
    ↓
setLogoffSrc(buttonLogoffUrl) [triggers iframe render]
    ↓
iframe loads logoffURL (RSM endpoint)
    ↓
RSM endpoint serves HTML with:
  - Hidden form with CaseID, UserID, DeptNumber
  - Body onload event that auto-submits
    ↓
Form submits to RSM endpoint
    ↓
RSM session is terminated
    ↓
iframe onLoad event fires
    ↓
handleLogoffLoaded executes
    ↓
window.open(caseCreateUrl) - opens new tab
    ↓
retryDataPageFetch after retryDelay
    ↓
Check for new caseID from created case
```

## Data Flow

### On Mount (Initial Load)
1. DataPage is fetched with parameters
2. Check for link keys (caseID + URL)
3. If found → render link mode
4. If not found → extract and store:
   - `buttonLogoffUrl` = response[logOffURL]
   - `buttonCaseCreateUrl` = response[caseCreateLaunch]

### On Button Click
1. Use pre-fetched URLs:
   - `setLogoffSrc(buttonLogoffUrl)` → iframe loads and auto-submits
   - `setResolvedInvokeUrl(buttonCaseCreateUrl)` → will open after logoff
2. Iframe submission terminates session
3. iframe onLoad → open case creation URL

### After Logoff Completes
1. Wait for `retryDelay` milliseconds
2. Retry DataPage fetch with same parameters
3. Check if new caseID is available
4. If found → open URL directly, switch to link mode
5. If not found → show error, enable button for retry

## Why This Integration Matters

### Security & Session Management
- **Hidden iframe**: Keeps logoff request invisible to user
- **Auto-submit form**: Logoff happens without user interaction
- **Session termination**: RSM session ends before launching CSM

### User Experience
- **Seamless flow**: User clicks button once, everything happens automatically
- **No popup dialogs**: All happens in background iframe
- **Clear status**: Button shows "Signing out…" during logoff

### Data Integrity
- **Pre-fetched URLs**: No additional DataPage calls on button click
- **Cached response**: Reuses on-load data for immediate action
- **Retry mechanism**: Ensures new case data is available

## HTML Snippet Structure

The logoffURL serves HTML that looks like:
```html
<head></head>
<body onload='sendGadgetEventAndSubmit()'>
  <form name='pegaform' action='<RSM_ENDPOINT_URL>'>
    <h2>Processing call to DPS system...</h2>
    <input id='CaseID' type='hidden' name='CaseID' value='<CASE_ID>' />
    <input id='UserID' type='hidden' name='UserID' value='RSMRep' />
    <input id='DeptNumber' type='hidden' name='DeptNumber' value='1000' />
  </form>
</body>
</html>
```

When iframe loads this:
1. Page renders (user doesn't see it)
2. `onload` event fires
3. `sendGadgetEventAndSubmit()` submits the form
4. RSM endpoint processes the session termination
5. iframe `onLoad` event fires
6. Component proceeds with case creation

## State Management

The component manages:
- `buttonLogoffUrl` - Stored on mount, used on button click
- `buttonCaseCreateUrl` - Stored on mount, used on button click
- `logoffSrc` - Set on button click, triggers iframe render
- `resolvedInvokeUrl` - Set on button click, opened after logoff
- `retryPending` - Set during retry delay, prevents button clicks
- `loadState` - Tracks 'idle', 'loading', 'error' states
- `linkLabel` / `linkUrl` - Updated after successful case creation

## Performance Considerations

✅ **Optimized**
- URLs pre-fetched on mount → no delay on button click
- Hidden iframe → no UI blocking
- Auto-submit form → no extra round trips
- Cached DataPage response → reused for retry

⚠️ **Note**
- Retry delay is configurable via `retryDelay` prop
- Default expects case to be available within the delay window
- If case not ready, user can click button again
