// eslint-disable-next-line no-shadow
export enum ResponseFormat {
  Delineation = 'delineation',
  Classify = 'classify',
  BatchApi = 'batch-api',
  Unknown = 'unknown'
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  helpText?: string;
}

export interface ISchemaTransformer {
  format: ResponseFormat;
  canTransform: (source: unknown) => boolean;
  transform: (source: unknown) => TransformationResult;
}

export interface NormalizedFieldMetadata {
  fieldKey: string;
  label: string;
  valueType: 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'object' | 'array';
  required: boolean;
  readonly: boolean;
  displayType: string;
  order: number;
  sectionKey?: string;
  placeholder?: string;
  helpText?: string;
  tooltip?: string;
  format?: string;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  options?: SelectOption[];
  reportingKey?: string;
  codexName?: string;
  dependsOn?: string[];
}

export interface NormalizedSectionMetadata {
  sectionKey: string;
  label: string;
  order: number;
  fields: NormalizedFieldMetadata[];
}

export interface NormalizedRepeatableMetadata {
  repeatableKey: string;
  label: string;
  order: number;
  helpText?: string;
  fields: NormalizedFieldMetadata[];
  reportingKey?: string;
}

export interface NormalizedDocumentSchema {
  documentId: string;
  documentName: string;
  documentType: string;
  sections: NormalizedSectionMetadata[];
  repeatables: NormalizedRepeatableMetadata[];
}

export interface SchemaError {
  path: string;
  message: string;
  code: string;
  severity: 'error' | 'warning';
}

export interface TransformationResult {
  success: boolean;
  schema?: NormalizedDocumentSchema;
  errors?: SchemaError[];
}

export interface ResponseDocument {
  document_id: string;
  document_name: string;
  document_type: string;
  indices: number[];
}

export interface ResponseExtract {
  document_id: string;
  document_name: string;
  extracted_data: Record<string, any>[];
}

export interface ResponseMetadata {
  file_metadata: {
    file_uri: string;
  };
  performance_metrics: {
    delineation: {
      execution_time_seconds: number;
      memory_peak_usage_mb: number;
    };
    extraction: {
      document_name: string;
      extraction_per_document: {
        execution_time_seconds: number;
        memory_peak_usage_mb: number;
      };
    }[];
  };
}

export interface DelineationResponse {
  status: string;
  response: {
    delineation_response: ResponseDocument[];
    extract_response: ResponseExtract[];
  };
  response_metadata: ResponseMetadata;
}
