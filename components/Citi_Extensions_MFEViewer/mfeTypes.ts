import { MFE_CONSTANTS } from './constants';
import type { PConnFieldProps } from './PConnProps';

// Runtime configuration mapped from Constellation property panel + PConnect props
export interface CitiExtensionsMfeViewerProps extends PConnFieldProps {
  inheritedProps: {
    prop: string;
    value: unknown;
  }[];
  mfeURL: string;
  type:
    | 'LOAD_SINGLEDOC,SingleDoc'
    | 'LOAD_MANIFEST,MultiDoc:SinglePage'
    | 'LOAD_MANIFEST,MultiDoc:MultiPage';
  showSearch: boolean;
  allowExpand: boolean;
  mfeTimeout: number;
  referenceList: string;
  documentIdField: string;
  fileNameField: string;
  fileURLField: string;
  currentPageNumField: string;
  categoryField?: string;
  pageCategoryIDField?: string;
  pageCategoryField?: string;
  pageCategoryPagesField?: string;
  activeDocField?: string;
  loadStateChange: boolean;
  fireEventToDynamicView: boolean;
  updateDocumentFields: boolean;
  documentFields: {
    [key: string]: string;
  };
  changedPageField: string;
  changedPageCountField: string;
  changedFileNameField: string;
  changedDocIDField: string;
  changedDocLabelField: string;
  changedPageCategoryIDField: string;
  changedModeField: string;
  changedTotalDocsField: string;
  Click2PickTransactions: boolean;
  loadCaptures: boolean;
  loadHighlights: boolean;
  highlightSource: 'ElementSelector' | 'DynamicView';
  highlightColor: string;
  transientDocumentIdField: string;
  capturesReferenceList: {
    referenceList: string;
    parameters: Record<string, unknown>;
  };
  idField: string;
  pageNumberField: string;
  box2dField: string;
  valueField: string;
  colorField?: string;
  loadNER: boolean;
  openNER: boolean;
  readOnlyNER: boolean;
  finishAssignmentOnSubmitNER: boolean;
  isNEROpenField: string;
  isNERSubmittedField: string;
  nerReferenceList: {
    referenceList: string;
    parameters: Record<string, unknown>;
  };
  nerJsonField: string;
  loadSplitAndMerge: boolean;
  waitForSplit: boolean;
  manualSplit: boolean;
  allowPageShuffling: boolean;
  allowPageMovement: boolean;
  isSAMOpenField: string;
  samType: 'Logical' | 'Physical';
  samCategoryReferenceList: {
    referenceList: string;
    parameters: Record<string, unknown>;
  };
  samCategoryListField: string;
  correlationId: string;
  appId: string;
  samQueryDataPage: {
    source: string;
    parameters: Record<string, unknown>;
    fields: {
      statusField: string;
      requestField: string;
    };
  };
  inProgressStatusRegex: string;
  completedStatusRegex: string;
  inProgressBannerText: string;
  inProgressStatus: boolean;
  physicalSplitModalConfirmationMessage: string;
  inProgressWorkStatus: string;
  completedWorkStatus: string;
  allowAcknowledgementNER: boolean;
  allowOcrOnDemandNER: boolean;
  columnNamesNER: string;
  nounMasterReferenceList: {
    referenceList: string;
    parameters: Record<string, unknown>;
  };
  nounField: string;
  nounClassificationField: string;
  transactionDataReferenceList: {
    referenceList: string;
    parameters: Record<string, unknown>;
  };
  finishAssignmentOnSubmitTransactionData: boolean;
  transactionDataJsonField: string;
  nerSaveReferenceList: {
    referenceList: string;
    parameters: Record<string, unknown>;
  };
  transactionDataSaveReferenceList: {
    referenceList: string;
    parameters: Record<string, unknown>;
  };
  transactionFieldsParameter: string;
  uniqueIdParameter: string;
  saveResultField: string;
  saveMessageField: string;
  transactionsDataFieldMap: string;
  nerDataParameter: string;
  ocrOnDemandReferenceList: {
    referenceList: string;
    parameters: Record<string, unknown>;
  };
  ocrOnDemandBase64SnippetParameter: string;
  ocrOnDemandRefIdParameter: string;
  ocrOnDemandDocumentIdParameter: string;
  ocrOnDemandExtractedValueField: string;
  ocrOnDemandExtractionTimeoutInMS: number;
  isCustomTab: boolean;
  loadFromTemplate: boolean;
  currentQueue: string;
  logDataPage: string;
  logParameter: string;
}

// Union of all valid message type strings e.g. "READY" | "DOC_LOADED" | ...
export type MfeMessageType = (typeof MFE_CONSTANTS)[keyof typeof MFE_CONSTANTS];

export type DocMode = 'SingleDoc' | MultiDocMode;
export type MultiDocMode = 'MultiDoc:SinglePage' | 'MultiDoc:MultiPage';

export interface ViewerMessage {
  type: MfeMessageType;
  data: {
    docId: string;
    fileName: string;
    pageCount: number;
    [key: string]: unknown;
  };
}

// Holds the fully-built postMessage payload once documents + buffer are ready
export interface ViewerPayload {
  ready: boolean;
  message: SingleDocumentMessage | MultiDocumentMessage | DocResponseMessage | null;
}

export interface DocumentCategory {
  pages?: number[];
  color?: string;
  pageCategoryID: string;
}

export interface SingleDocumentCategory extends DocumentCategory {
  label: string;
}

export interface MultiDocumentMultiPageCategory extends DocumentCategory {
  category: string;
}

export interface CaptureItem {
  id: string;
  value: string;
  page: number;
  color?: string;
  box_2d: number[];
}

export interface DocumentMessage {
  showSearch: boolean;
  appId: string;
  correlationId: string;
  captures?: CaptureItem[];
  persistHighlights?: boolean;
  showSplitMerge?: boolean;
  showNer?: boolean;
  openNer?: boolean;
  enablePhysicalSplit?: boolean;
  waitForSplit?: boolean;
  manualSplit?: boolean;
  allowPageShuffling?: boolean;
  allowPageMovement?: boolean;
  Click2Pick?: boolean;
  allowOcrOnDemand?: boolean;
  initialZoom: 'page-width' | 'page-fit';
  isCustomTab?: boolean;
  loadFromTemplate?: boolean;
  currentQueue?: string;
}

export interface SingleDocumentMessage extends DocumentMessage {
  type: 'LOAD_SINGLEDOC';
  buffer: ArrayBuffer;
  fileName: string;
  wordIndex?: any[];
  categories?: SingleDocumentCategory[];
  categoryList?: string[];
  currentPageNum?: number;
}

export interface DocumentItem {
  id: string;
  name: string;
  src?: string;
  pageCategoryID?: string;
  category?: string;
  pageCategories?: MultiDocumentMultiPageCategory[];
  currentPageNum?: number;
  [key: string]: unknown;
}

export interface MultiDocumentMessage extends DocumentMessage {
  type: 'LOAD_MANIFEST';
  manifest: {
    mode: MultiDocMode;
    categoryList?: string[];
    documents: DocumentItem[];
  };
  activeDocId: string;
  activeBuffer: ArrayBuffer;
}

export interface DocResponseMessage {
  type: 'DOC_RESPONSE';
  docId: string;
  buffer: ArrayBuffer;
  captures?: CaptureItem[];
  persistHighlights?: boolean;
}

export interface AllDocResponseMessage {
  type: 'ALL_DOC_RESPONSE';
  showSearch: boolean;
  appId: string;
  correlationId: string;
  showSplitMerge?: boolean;
  enablePhysicalSplit?: boolean;
  waitForSplit?: boolean;
  manualSplit?: boolean;
  allowPageShuffling?: boolean;
  allowPageMovement?: boolean;
  Click2Pick?: boolean;
  allowOcrOnDemand?: boolean;
  manifest: {
    mode: 'MultiDoc:SinglePage';
    categoryList?: string[];
    documents: DocumentItem[];
  };
  activeDocId?: string;
}

export interface SplitApprovedMessage extends DocumentMessage {
  type: 'SPLIT_APPROVED';
  mode?: 'MultiDoc:SinglePage' | 'MultiDoc:MultiPage';
  physicalSplitEnabled: true;
  waitForSplit: false;
  ReceivedDocument: Array<Record<string, unknown>>;
  DocumentReclassified: Array<Record<string, unknown>>;
}

export interface ViewerNerPayload {
  ready: boolean;
  message: NerDocResponseMessage | null;
}

export interface ViewerTransactionDataPayload {
  ready: boolean;
  message: LoadExtractionDataMessage | null;
}

export interface NerDocResponseMessage {
  type: 'DOC_NER_RESPONSE';
  correlationId: string;
  useCase: string;
  uniqueID: string;
  isBatchMode: boolean;
  caseID: string;
  region: string;
}

export interface NerMetadataAllNounTypeItem {
  field: string;
  classification: string;
}

export interface NerMetadataMessage {
  type: 'LOAD_NER_METADATA';
  noun_types: {
    all_noun_types: NerMetadataAllNounTypeItem[];
  };
  highlights?: {
    duplicates: string;
    pending: string;
    acknowledged: string;
    active: string;
  };
  readOnlyNer?: boolean;
  allowAcknowledgement?: boolean;
  allowOcrOnDemand?: boolean;
  columnNames?: string[];
}

export interface OcrResponseMessage {
  type: 'OCR_RESPONSE';
  docId: string;
  refId: string;
  value: string;
  coordinates: {
    page_number: number;
    box_2d: number[];
  };
}

export interface HighlightMessage {
  type: 'HIGHLIGHT';
  payload: {
    id: string;
    value: string;
    page: number;
    box_2d: number[];
    color?: string;
  };
}

export interface LoadExtractionDataMessage {
  type: 'LOAD_EXTRACTIONDATA';
  readOnly?: boolean;
  validationOnReadOnly?: boolean;
  uniqueID: string;
  caseID?: string;
  region?: string;
  useCase?: string;
  commonFooter?: string;
}

export interface ValidationMsgMessage {
  type: 'VALIDATION_MSG';
  mode: 'FORM_SAVE' | 'SUBMIT';
  status: 'SUCCESS' | 'ERROR';
  message: string;
}
