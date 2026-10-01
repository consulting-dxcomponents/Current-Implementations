// @ts-nocheck
export const configProps = {
  buttonLabel:    'Launch CSM',
  // DataPage that contains all session data
  dataPageName:   'D_CSMSession',
  // Key in the DataPage response that holds the RSM service base URL
  logoffUrlKey:   'EndPointUrl',
  // Pega activity used to build the logoff URL
  logoffActivity: 'Code-Security.RSMLogOff',
  // Key in the DataPage response that holds the raw CSM invoke URL
  invokeUrlKey:   'UrlToInvoke',
  // Token replaced in the raw invoke URL before navigating
  urlReplaceFrom: 'donotencrypt',
  urlReplaceTo:   'pyActivity',
  testId:         'invoke-csm-btn',
};

export const stateProps = {
  value: '',
  hasSuggestions: false,
};

/**
 * Simulated DataPage response for Storybook.
 * Keys must match the configProps above.
 */
export const MOCK_DATAPAGE_RESPONSE = {
  EndPointUrl:  'https://rsm-host/prweb',
  UrlToInvoke:  'https://csm-host/prweb?donotencrypt=SomeToken',
};
