export const MFE_MAINTENANCE_CONSTANTS = {
  MFE_READY: 'MFE_READY',
  SUBMIT: 'SUBMIT',
  CANCEL: 'CANCEL',
  MFEMAINTENANCE_SUBMIT_ACTION_SUBMIT: 'SUBMIT',
  MFEMAINTENANCE_SUBMIT_ACTION_APPROVE: 'APPROVE',
  MFEMAINTENANCE_SUBMIT_ACTION_REJECT: 'REJECT'
} as const;

export const DEFAULT_MFE_TIMEOUT_MS = 15000;

export const ERROR_MESSAGES = {
  INVALID_CONFIG: 'MFE configuration is missing or invalid. Please contact system administrator.',
  READY_TIMEOUT: 'Viewer took too long to respond. Please try again later.',
  MAINTENANCE_DATA_LOAD_FAILED: 'Failed to load maintenance data. Please try again later.',
  MAINTENANCE_DATA_SUBMIT_FAILED: 'Failed to submit maintenance data. Please try again later.'
} as const;
