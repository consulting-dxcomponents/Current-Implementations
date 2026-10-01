/* eslint-disable react/jsx-no-useless-fragment */
// @ts-nocheck
import type { Meta, StoryObj } from '@storybook/react';

import { configProps, stateProps, MOCK_DATAPAGE_RESPONSE } from './mock';
import CitiExtensionsInvokeCsm from './index';

// ── PCore shim ────────────────────────────────────────────────────────────────
// Simulates the Pega DataPage fetch with a 1 s delay.
const installPCoreMock = (responseData: Record<string, string>, shouldFail = false) => {
  (window as any).PCore = {
    getDataPageUtils: () => ({
      getPageDataAsync: () =>
        new Promise((resolve, reject) =>
          setTimeout(
            () => (shouldFail ? reject(new Error('Simulated DataPage error')) : resolve(responseData)),
            1000
          )
        ),
    }),
  };
};

// ── Shared getPConnect mock ───────────────────────────────────────────────────
const buildMockPConnect = () => () => ({
  getContextName: () => 'app/primary_1',
  getStateProps: () => stateProps,
  getActionsApi: () => ({ updateFieldValue: () => {}, triggerFieldChange: () => {} }),
  ignoreSuggestion: () => {},
  acceptSuggestion: () => {},
  setInheritedProps: () => {},
  resolveConfigProps: () => {},
});

// ── Meta ──────────────────────────────────────────────────────────────────────
const meta: Meta<typeof CitiExtensionsInvokeCsm> = {
  title: 'Citi/Extensions/InvokeCSM',
  component: CitiExtensionsInvokeCsm,
  excludeStories: /.*Data$/,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
## Citi_Extensions_InvokeCSM

A Pega Constellation DX custom component that performs a **two-phase session-switch** from an existing RSM (Remote Session Manager) session to a new CSM (Customer Service Module) session.

---

### What it does

1. The user clicks the **Launch CSM** button.
2. The component fetches a configured **Pega DataPage** that contains session endpoint data.
3. It assembles a **logoff URL** and loads it in a **hidden \`<iframe>\`**, silently terminating the existing RSM session.
4. Once the iframe signals completion (\`onLoad\`), the component opens the **CSM URL in a new browser tab**.
5. The button is disabled and shows **"Signing out…"** throughout steps 2–4 to prevent double-submission.

---

### Session-switch flow

\`\`\`
User clicks button
      │
      ▼
Fetch DataPage  ──fail──▶  Show inline error
      │
      ▼ success
Extract logoff base URL  ──missing key──▶  Show inline error
Extract raw invoke URL   ──missing key──▶  Show inline error
      │
      ▼
Logoff URL  =  {EndPointUrl}?pyActivity={logoffActivity}
Invoke URL  =  {UrlToInvoke}.replace("{urlReplaceFrom}", "{urlReplaceTo}")
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
Button re-enabled
\`\`\`

---

### App Studio configuration

All properties are configured in App Studio and passed as props at runtime.

#### General

| Property | Default | Description |
|---|---|---|
| \`buttonLabel\` | \`Launch CSM\` | Text displayed on the trigger button. |

#### DataPage

| Property | Default | Description |
|---|---|---|
| \`dataPageName\` | — | **Required.** The Pega DataPage containing all session data, e.g. \`D_CSMSession\`. |

#### Logoff URL

| Property | Default | Description |
|---|---|---|
| \`logoffUrlKey\` | \`EndPointUrl\` | Key in the DataPage response whose value is the RSM service base URL. |
| \`logoffActivity\` | \`Code-Security.RSMLogOff\` | Pega activity name appended as \`?pyActivity=…\` to form the full logoff URL. |

> **Logoff URL assembled as:** \`{response[logoffUrlKey]}?pyActivity={logoffActivity}\`

#### Invoke URL

| Property | Default | Description |
|---|---|---|
| \`invokeUrlKey\` | \`UrlToInvoke\` | Key in the DataPage response whose value is the raw CSM URL. |
| \`urlReplaceFrom\` | \`donotencrypt\` | Token in the raw URL that must be replaced before navigating. Leave empty to skip replacement. |
| \`urlReplaceTo\` | \`pyActivity\` | Value substituted for the token above. |

> **Invoke URL assembled as:** \`{response[invokeUrlKey]}.replace("{urlReplaceFrom}", "{urlReplaceTo}")\`

---

### Expected DataPage response shape

\`\`\`json
{
  "EndPointUrl":  "https://rsm-host/prweb",
  "UrlToInvoke":  "https://csm-host/prweb?donotencrypt=SomeToken"
}
\`\`\`

With default props this produces:
- **Logoff URL:** \`https://rsm-host/prweb?pyActivity=Code-Security.RSMLogOff\`
- **Invoke URL:** \`https://csm-host/prweb?pyActivity=SomeToken\`

---

### Error handling

Errors are displayed inline below the button with \`role="alert"\`. The button is re-enabled so the user can retry.

| Scenario | Message shown |
|---|---|
| \`dataPageName\` not set | _No DataPage configured. Set the "DataPage name" in App Studio._ |
| DataPage fetch throws | The error message from the rejection, or a generic fallback. |
| \`logoffUrlKey\` not in response | _Key "…" not found in DataPage response._ |
| \`invokeUrlKey\` not in response | _Key "…" not found in DataPage response._ |
| Logoff iframe fails to load | _The RSM logoff request failed. Please try again._ |

---

### Security

- CSM URL is opened with \`noopener,noreferrer\` — the new tab cannot reference the parent window.
- The logoff iframe is hidden via CSS (\`display: none\`) and marked \`aria-hidden="true"\` — invisible to users and assistive technology.
- URLs are held only in component state for the duration of a single click interaction; nothing is persisted.

---

### Maintainers

[Sravan.Mamidi@pega.com](mailto:Sravan.Mamidi@pega.com) · [PCI-FrontEndTeam@pega.com](mailto:PCI-FrontEndTeam@pega.com)
        `.trim(),
      },
    },
  },
  argTypes: {
    buttonLabel: {
      control: 'text',
      description: 'Text displayed on the trigger button.',
      table: {
        category: 'General',
        defaultValue: { summary: 'Launch CSM' },
        type: { summary: 'string' },
      },
    },
    dataPageName: {
      control: 'text',
      description: '**Required.** The Pega DataPage that contains all session endpoint data.',
      table: {
        category: 'DataPage',
        type: { summary: 'string' },
      },
    },
    logoffUrlKey: {
      control: 'text',
      description: 'Key in the DataPage response that holds the RSM service base URL.',
      table: {
        category: 'Logoff URL',
        defaultValue: { summary: 'EndPointUrl' },
        type: { summary: 'string' },
      },
    },
    logoffActivity: {
      control: 'text',
      description: 'Pega activity appended as `?pyActivity=…` to form the full logoff URL.',
      table: {
        category: 'Logoff URL',
        defaultValue: { summary: 'Code-Security.RSMLogOff' },
        type: { summary: 'string' },
      },
    },
    invokeUrlKey: {
      control: 'text',
      description: 'Key in the DataPage response that holds the raw CSM invoke URL.',
      table: {
        category: 'Invoke URL',
        defaultValue: { summary: 'UrlToInvoke' },
        type: { summary: 'string' },
      },
    },
    urlReplaceFrom: {
      control: 'text',
      description: 'Token in the raw invoke URL to replace before navigating. Leave empty to skip.',
      table: {
        category: 'Invoke URL',
        defaultValue: { summary: 'donotencrypt' },
        type: { summary: 'string' },
      },
    },
    urlReplaceTo: {
      control: 'text',
      description: 'Value substituted for the token above.',
      table: {
        category: 'Invoke URL',
        defaultValue: { summary: 'pyActivity' },
        type: { summary: 'string' },
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof CitiExtensionsInvokeCsm>;

// ── Stories ───────────────────────────────────────────────────────────────────

/**
 * ### Default — successful flow
 *
 * Happy path. The DataPage resolves after ~1 s, both URLs are assembled from the
 * response, the logoff iframe fires, and the CSM URL is opened in a new tab.
 *
 * > **Try it:** click the button and watch it disable while "signing out", then
 * > re-enable once the simulated logoff completes.
 */
export const Default: Story = {
  name: 'Default — successful flow',
  render: (args: any) => {
    installPCoreMock(MOCK_DATAPAGE_RESPONSE);
    return <CitiExtensionsInvokeCsm getPConnect={buildMockPConnect()} {...args} />;
  },
  args: {
    buttonLabel:    configProps.buttonLabel,
    dataPageName:   configProps.dataPageName,
    logoffUrlKey:   configProps.logoffUrlKey,
    logoffActivity: configProps.logoffActivity,
    invokeUrlKey:   configProps.invokeUrlKey,
    urlReplaceFrom: configProps.urlReplaceFrom,
    urlReplaceTo:   configProps.urlReplaceTo,
    testId:         configProps.testId,
  },
};

/**
 * ### Error — DataPage fetch fails
 *
 * The DataPage call rejects (simulated). An inline error message is shown below
 * the button and the button is re-enabled so the user can retry.
 */
export const DataPageError: Story = {
  name: 'Error — DataPage fetch fails',
  render: (args: any) => {
    installPCoreMock({}, true);
    return <CitiExtensionsInvokeCsm getPConnect={buildMockPConnect()} {...args} />;
  },
  args: {
    buttonLabel:    configProps.buttonLabel,
    dataPageName:   configProps.dataPageName,
    logoffUrlKey:   configProps.logoffUrlKey,
    logoffActivity: configProps.logoffActivity,
    invokeUrlKey:   configProps.invokeUrlKey,
    urlReplaceFrom: configProps.urlReplaceFrom,
    urlReplaceTo:   configProps.urlReplaceTo,
    testId:         configProps.testId,
  },
};

/**
 * ### Misconfigured — logoff URL key not in response
 *
 * `logoffUrlKey` is set to a key that does not exist in the DataPage response.
 * The component shows a clear, actionable error message identifying the missing key.
 */
export const MissingLogoffKey: Story = {
  name: 'Misconfigured — logoff URL key not in response',
  render: (args: any) => {
    installPCoreMock(MOCK_DATAPAGE_RESPONSE);
    return <CitiExtensionsInvokeCsm getPConnect={buildMockPConnect()} {...args} />;
  },
  args: {
    buttonLabel:    configProps.buttonLabel,
    dataPageName:   configProps.dataPageName,
    logoffUrlKey:   'WrongKey',
    logoffActivity: configProps.logoffActivity,
    invokeUrlKey:   configProps.invokeUrlKey,
    urlReplaceFrom: configProps.urlReplaceFrom,
    urlReplaceTo:   configProps.urlReplaceTo,
    testId:         configProps.testId,
  },
};
