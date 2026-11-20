import { MFE_MAINTENANCE_CONSTANTS } from './constants';
import type { PConnFieldProps } from './PConnProps';

// Runtime configuration mapped from Constellation property panel + PConnect props
export interface CitiExtensionsMfeMaintenanceViewerProps extends PConnFieldProps {
  inheritedProps: {
    prop: string;
    value: unknown;
  }[];
  mfeURL: string;
  mfeTimeout: number;
  logDataPage: string;
  logParameter: string;
  mfeMaintenanceReferenceList: { referenceList: string };
  mfeMaintenanceJsonDataField: string;
  tabParameter: string;
  statusParameter: string;
  mfeMaintenanceDataSaveReferenceList: { referenceList: string };
  mfeMaintenanceFieldsParameter: string;
  caseIdParameter: string;
  finishAssignmentOnMfeMaintenanceSubmit: string;
  callSaveMFEMaintenanceFieldReferenceList: string;
}

// Union of all valid message type strings e.g. "READY" | "LOAD_MAINTENANCE"
export type MfeMaintenanceMessageType =
  (typeof MFE_MAINTENANCE_CONSTANTS)[keyof typeof MFE_MAINTENANCE_CONSTANTS];

// Envelope for every message received from the viewer iframe
export interface ViewerMessage {
  type: MfeMaintenanceMessageType;
  [key: string]: unknown;
}

export interface LoadMaintenanceMessage {
  type: 'LOAD_MAINTENANCE';
  action: {
    [key: string]: string;
  };
  region: string;
  useCase: string;
  currentQueue: string;
  caseID: string;
  readOnly: boolean;
}

// Union of all messages that can be posted to the viewer
export type OutboundViewerMessage = LoadMaintenanceMessage;

// Holds the postMessage payload once it is prepared (gate 2)
export interface ViewerPayload {
  ready: boolean;
  message: OutboundViewerMessage | null;
}
