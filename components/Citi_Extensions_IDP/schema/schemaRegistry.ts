import type { Parameters, DataPagePayload, DataPageType } from '../api/dataPageClient';
import { DEFAULT_SCHEMA_FIELD_CANDIDATES } from '../utils/constants';
// import type { SchemaFormat, TransformationResult } from "./schemaTypes";
export interface SchemaRegistryConfig {
  dataPageName: string;
  docTypeParamName?: string;
  schemaFieldCandidates?: string[];
}

export interface JsonSchemaProperty {
  type?: string;
  description?: string;
  pattern?: string;
  format?: string;
  enum?: string[];
  minLength?: number;
  maxLength?: number;
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

export interface JsonSchemaDocument {
  title?: string;
  description?: string;
  type?: string;
  /** Display name returned by the schema registry's DocTypeDisplay column. */
  docTypeDisplay?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

type FetchFn = (
  dataPage: string,
  parameters: Parameters,
  type?: DataPageType
) => Promise<DataPagePayload>;

/**
 * Registry service:
 * - Fetches doc_type -> schema JSON from a datapage
 * - Keeps in-memory cache keyed by doc_type
 */
export class SchemaRegistryService {
  private readonly config: Required<SchemaRegistryConfig>;

  private readonly fetchFn: FetchFn;

  private readonly schemaCache = new Map<string, JsonSchemaDocument>();

  private readonly responseTypeCache = new Map<string, string>();

  /** The ResponseType value from the most recent schema data page fetch. */
  private ResponseType = '';

  constructor(fetchFn: FetchFn, config: SchemaRegistryConfig) {
    this.fetchFn = fetchFn;
    this.config = {
      dataPageName: config.dataPageName,
      docTypeParamName: config.docTypeParamName ?? 'DocType',
      schemaFieldCandidates: config.schemaFieldCandidates ?? DEFAULT_SCHEMA_FIELD_CANDIDATES
    };
  }

  async getSchemaForDocType(docType: string): Promise<JsonSchemaDocument | null> {
    const cacheHit = this.schemaCache.get(docType);
    if (cacheHit) {
      this.ResponseType = this.responseTypeCache.get(docType) ?? '';
      return cacheHit;
    }

    const payload = await this.fetchFn(
      this.config.dataPageName,
      { [this.config.docTypeParamName]: docType },
      'page'
    );

    const record = SchemaRegistryService.pickSchemaRecord(payload);
    const rf = record['ResponseType'] ?? record['responseType'];
    this.ResponseType = typeof rf === 'string' ? rf : '';

    const schema = this.parseSchemaRecord(record);
    if (!schema) {
      return null;
    }
    const docTypeDisplay = record['DocTypeDisplay'];
    if (typeof docTypeDisplay === 'string') {
      schema.docTypeDisplay = docTypeDisplay;
    }

    this.schemaCache.set(docType, schema);
    this.responseTypeCache.set(docType, this.ResponseType);
    return schema;
  }

  /** Returns the ResponseType value read from the last schema data page fetch. */
  getResponseType(): string {
    return this.ResponseType;
  }

  clearCache(): void {
    this.schemaCache.clear();
    this.responseTypeCache.clear();
    this.ResponseType = '';
  }

  private static pickSchemaRecord(payload: DataPagePayload): Record<string, unknown> {
    if (Array.isArray(payload)) {
      return payload[0] ?? {};
    }
    return payload ?? {};
  }

  private parseSchemaRecord(record: Record<string, unknown>): JsonSchemaDocument | null {
    for (const candidate of this.config.schemaFieldCandidates) {
      const rawValue = record[candidate];
      if (typeof rawValue === 'string' && rawValue.trim().length > 0) {
        try {
          return JSON.parse(rawValue) as JsonSchemaDocument;
        } catch (error) {
          console.error(`Failed to parse schema JSON from field "${candidate}": ${String(error)}`);
          return null;
        }
      }

      if (rawValue && typeof rawValue === 'object') {
        return rawValue as JsonSchemaDocument;
      }
    }

    return null;
  }
}
