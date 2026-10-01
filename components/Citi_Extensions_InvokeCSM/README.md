# Citi_Extensions_InvokeCSM

**Owner:** PCI Front-End Team · [PCI-FrontEndTeam@pega.com](mailto:PCI-FrontEndTeam@pega.com)  
**Component type:** Pega Constellation DX Custom Component — Field  
**Version:** 1.0.0

---

## Overview

`Citi_Extensions_InvokeCSM` is a Pega Constellation DX component that enables a **two-phase session-switch** from an existing RSM (Remote Session Manager) session to a new CSM (Customer Service Module) session.

The component renders a single button. When the user clicks it, the component:

1. Fetches a **Pega DataPage** that contains the session endpoint data.
2. Constructs a **logoff URL** for the current RSM session from the DataPage response.
3. Silently terminates the RSM session by loading the logoff URL in a **hidden `<iframe>`** — the user sees nothing.
4. Once the logoff iframe signals completion, the component opens the **CSM URL** in a **new browser tab**.

The button is disabled and shows `"Signing out…"` for the entire duration of steps 2–4 to prevent double-submission.

---

## User-facing behaviour

| State | Button label | What the user sees |
|---|---|---|
| Initial | _(configured label, default "Launch CSM")_ | Normal clickable button |
| Fetching DataPage / logging off | `Signing out…` | Button greyed out |
| Success | _(configured label)_ | Button re-enabled; CSM opens in a new tab |
| Error | _(configured label)_ | Button re-enabled; inline error message below the button |

---

## Two-phase flow (technical detail)

```
User clicks button
        │
        ▼
Fetch DataPage  ──fail──▶  Show error
        │
        ▼ success
Extract EndPointUrl   ──missing──▶  Show error
Extract UrlToInvoke   ──missing──▶  Show error
        │
        ▼
Build logoff URL:
  EndPointUrl + "?pyActivity=" + logoffActivity
        │
        ▼
Build invoke URL:
  UrlToInvoke.replace(urlReplaceFrom, urlReplaceTo)
        │
        ▼
Mount hidden <iframe src={logoffUrl}>   ← RSM session terminated silently
        │
   iframe onLoad
        │
        ▼
window.open(invokeUrl, "_blank")   ← CSM opens in a new tab
        │
        ▼
Button re-enabled   (loadState = 'done')
```

---

## App Studio configuration

All properties are set in App Studio under the component's property panel and are passed as props at runtime.

### Top-level

| Property name | Label in App Studio | Default value | Required | Description |
|---|---|---|---|---|
| `buttonLabel` | Button label | `Launch CSM` | No | Text displayed on the trigger button. |

### DataPage group

| Property name | Label in App Studio | Default value | Required | Description |
|---|---|---|---|---|
| `dataPageName` | DataPage name | — | **Yes** | The Pega DataPage that contains all session data, e.g. `D_CSMSession`. |

### Logoff URL group

| Property name | Label in App Studio | Default value | Required | Description |
|---|---|---|---|---|
| `logoffUrlKey` | DataPage key — base URL | `EndPointUrl` | No | The key in the DataPage response whose value is the RSM service base URL. |
| `logoffActivity` | Pega activity | `Code-Security.RSMLogOff` | No | The Pega activity name appended to the base URL as `?pyActivity=<value>` to form the full logoff URL. |

**Logoff URL assembled as:**
```
{response[logoffUrlKey]}?pyActivity={logoffActivity}
```

### Invoke URL group

| Property name | Label in App Studio | Default value | Required | Description |
|---|---|---|---|---|
| `invokeUrlKey` | DataPage key — raw invoke URL | `UrlToInvoke` | No | The key in the DataPage response whose value is the raw CSM URL. |
| `urlReplaceFrom` | Token to replace in invoke URL | `donotencrypt` | No | A string found in the raw invoke URL that must be replaced before navigating. Set to empty to skip the replacement. |
| `urlReplaceTo` | Replacement value | `pyActivity` | No | The value substituted in place of the token above. |

**Invoke URL assembled as:**
```
{response[invokeUrlKey]}.replace("{urlReplaceFrom}", "{urlReplaceTo}")
```

---

## DataPage response shape

The DataPage must return at minimum the two keys referenced by `logoffUrlKey` and `invokeUrlKey`. Example:

```json
{
  "EndPointUrl":  "https://rsm-host/prweb",
  "UrlToInvoke":  "https://csm-host/prweb?donotencrypt=SomeToken"
}
```

With the default prop values this produces:
- **Logoff URL:** `https://rsm-host/prweb?pyActivity=Code-Security.RSMLogOff`
- **Invoke URL:** `https://csm-host/prweb?pyActivity=SomeToken`

---

## Error handling

Errors are surfaced as an inline message below the button with `role="alert"` (screen-reader accessible). The button returns to its normal, clickable state so the user can retry.

| Scenario | Error shown |
|---|---|
| `dataPageName` not configured | `No DataPage configured. Set the "DataPage name" in App Studio.` |
| DataPage fetch throws | Error message from the rejection, or a generic fallback. |
| `logoffUrlKey` not found in response | `Key "<key>" not found in DataPage response.` |
| `invokeUrlKey` not found in response | `Key "<key>" not found in DataPage response.` |
| Hidden iframe fails to load the logoff URL | `The RSM logoff request failed. Please try again.` |

---

## Security notes

- The CSM URL is opened with `window.open(url, '_blank', 'noopener,noreferrer')`, which prevents the new tab from having a reference back to the parent window.
- The logoff iframe is never rendered visible (`display: none` via CSS) and has `aria-hidden="true"` so it is invisible to both users and assistive technology.
- No URL values are stored in local/session storage; they live only in component state for the duration of the click interaction.

---

## Files

| File | Purpose |
|---|---|
| `index.tsx` | Component implementation |
| `config.json` | Pega DX component schema — defines the App Studio property panel |
| `styles.ts` | Minimal layout CSS (no theme overrides) |
| `mock.ts` | Storybook mock data and a simulated DataPage response |
| `demo.stories.tsx` | Storybook stories covering the happy path, DataPage error, and misconfiguration |

---

## Storybook stories

| Story | Description |
|---|---|
| Default — successful flow | Happy path. DataPage resolves; logoff fires; CSM opens in a new tab. |
| Error — DataPage fetch fails | DataPage call rejects; inline error message is shown. |
| Misconfigured — logoff URL key not in response | `logoffUrlKey` is set to a key that doesn't exist in the response; component shows a clear error. |

---

## Contact / maintainers

| Role | Contact |
|---|---|
| Lead developer | [Sravan.Mamidi@pega.com](mailto:Sravan.Mamidi@pega.com) |
| Team distribution | [PCI-FrontEndTeam@pega.com](mailto:PCI-FrontEndTeam@pega.com) |
