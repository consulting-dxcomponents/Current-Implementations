import type {
  DelineationExtractResponseDocument,
  DelineationResponse,
  DocumentSpec,
  IdpFieldSpec
} from '../idpTypes';
import type { JsonSchemaDocument, JsonSchemaProperty } from './schemaRegistry';
import { ResponseFormat } from './schemaTypes';

export type SupportedResponseFormat = ResponseFormat;

/** Confidence scores (0–5) keyed by field or repeatable key. */
export interface ConfidenceData {
  fields: Record<string, number>;
  repeatables: Record<string, number>;
}

export interface NormalizedViewModel {
  idpSpec: DocumentSpec;
  resolvedValues: Record<string, string>;
  repeatableRows: Record<string, Array<Record<string, string>>>;
  confidenceData: ConfidenceData;
}

/** Normalises a string to lowercase alphanumeric for fuzzy key matching. */
function toNormalizedKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Converts a snake_case key into Title Case label. */
function toLabel(fieldKey: string): string {
  return fieldKey
    .split('_')
    .filter(Boolean)
    .map(token => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

/** Infers UI display type from a JSON schema property. */
function toDisplayType(property: JsonSchemaProperty, fieldKey?: string): string {
  if (Array.isArray(property.enum) && property.enum.length > 0) return 'radio';
  if (property.format === 'date') return 'date';
  if (property.type === 'number' || property.type === 'integer') return 'number';
  if (property.type === 'boolean') return 'checkbox';
  if (
    property.type === 'string' &&
    fieldKey !== undefined &&
    /address|description/i.test(fieldKey)
  ) {
    return 'textarea';
  }
  return 'textbox';
}

/** Infers value type from a JSON schema property. */
function toValueType(property: JsonSchemaProperty): string {
  if (property.type === 'number' || property.type === 'integer') return 'number';
  if (property.type === 'boolean') return 'boolean';
  if (property.format === 'date') return 'date';
  return 'string';
}

/** Detects the IDP response format from the payload structure. */
export function detectResponseFormat(payload: unknown): SupportedResponseFormat {
  const source = payload as Record<string, any>;

  if (
    Array.isArray(source?.response?.delineation_response) &&
    Array.isArray(source?.response?.extract_response)
  )
    return ResponseFormat.Delineation;

  const classifyRaw = source?.response?.classify_response ?? source?.classify_response;
  if (classifyRaw !== null && classifyRaw !== undefined && typeof classifyRaw === 'object') {
    return ResponseFormat.Classify;
  }

  // Flat batch API: { [correlation_id?,] data: [{document_id, fields, ...}] }
  // No type discriminator check — matches both typed and untyped payloads.
  if (
    Array.isArray(source?.data) &&
    source.data.length > 0 &&
    source.data[0]?.document_id !== undefined &&
    source.data[0]?.fields !== undefined
  ) {
    return ResponseFormat.BatchApi;
  }

  return ResponseFormat.Unknown;
}

/** Finds the delineation extract record for a given documentId. */
function getExtractRecordForDelineation(
  payload: DelineationResponse,
  documentId: string
): DelineationExtractResponseDocument | undefined {
  return payload.response.extract_response.find(extract => extract.document_id === documentId);
}

/**
 * Resolves a flat { field_name: score } map from externally supplied confidence data.
 * Handles: { type: 'confidence', data: [{ document_id, fields: [{ field_name, confidence_score }] }] }
 */
function resolveExternalConfidence(externalData: any, documentId: string): Record<string, unknown> {
  if (externalData.type === 'confidence' && Array.isArray(externalData.data)) {
    const doc = (externalData.data as any[]).find((item: any) => item.document_id === documentId);
    const fieldsArray: Array<{ field_name: string; confidence_score: number }> = doc?.fields ?? [];
    const map: Record<string, unknown> = {};
    fieldsArray.forEach(f => {
      map[f.field_name] = f.confidence_score;
    });
    return map;
  }
  return externalData;
}

/** Retrieves confidence data from the payload for delineation/classify and nested batch formats. */
function getConfidenceDataForDocument(
  payload: unknown,
  documentId: string
): Record<string, unknown> {
  const format = detectResponseFormat(payload);
  const source = payload as Record<string, any>;

  if (format === ResponseFormat.Delineation || format === ResponseFormat.Classify) {
    return (
      (source.response?.extract_response ?? []).find((item: any) => item.document_id === documentId)
        ?.confidence_data ?? {}
    );
  }

  if (format === ResponseFormat.BatchApi) {
    // Flat batch (with or without type discriminator) — confidence always comes via externalConfidenceData.
    if (Array.isArray(source?.data)) return {};
    // Nested results batch: look for a 'confidence' result entry.
    const confidenceResult = (source.results as any[]).find((r: any) => r.type === 'confidence');
    const confidenceDoc = (confidenceResult?.data ?? []).find(
      (item: any) => item.document_id === documentId
    );
    const fieldsArray: Array<{ field_name: string; confidence_score: number }> =
      confidenceDoc?.fields ?? [];
    const result: Record<string, unknown> = {};
    fieldsArray.forEach(f => {
      result[f.field_name] = f.confidence_score;
    });
    return result;
  }

  return {};
}

/** Maps a raw confidence object into a typed ConfidenceData aligned with the idpSpec. */
function extractConfidenceData(
  rawConfidence: Record<string, unknown>,
  idpSpec: DocumentSpec
): ConfidenceData {
  const fields: Record<string, number> = {};
  const repeatables: Record<string, number> = {};

  idpSpec.sections.forEach(section =>
    section.fields.forEach(field => {
      const raw = rawConfidence[field.fieldKey] ?? rawConfidence[field.codexName];
      if (typeof raw === 'number') fields[field.fieldKey] = raw;
    })
  );

  idpSpec.repeatables.forEach(repeatable => {
    const raw = rawConfidence[repeatable.repeatableKey];
    if (typeof raw === 'number') {
      repeatables[repeatable.repeatableKey] = raw;
    } else if (Array.isArray(raw) && raw.length > 0) {
      const nums = (raw as unknown[]).filter(v => typeof v === 'number') as number[];
      if (nums.length > 0) repeatables[repeatable.repeatableKey] = Math.min(...nums);
    }
  });

  return { fields, repeatables };
}

/** Returns the extracted fields object for a given document across all supported formats. */
export function getExtractedDataForDocument(
  payload: unknown,
  documentId: string
): Record<string, unknown> {
  const format = detectResponseFormat(payload);
  const source = payload as Record<string, any>;

  if (format === ResponseFormat.Delineation || format === ResponseFormat.Classify) {
    return (
      getExtractRecordForDelineation(payload as DelineationResponse, documentId)?.extracted_data ??
      {}
    );
  }

  if (format === ResponseFormat.BatchApi) {
    // Flat batch API (with or without type discriminator): { [type,] data: [{document_id, fields}] }
    if (Array.isArray(source?.data)) {
      const doc = (source.data as any[]).find((item: any) => item.document_id === documentId);
      return (doc?.fields ?? {}) as Record<string, unknown>;
    }
    // Nested results batch API: { results: [{type: 'extraction', data: [...]}] }
    const extractionResult = (source.results as any[]).find((r: any) => r.type === 'extraction');
    const extractionDoc = (extractionResult?.data ?? []).find(
      (item: any) => item.document_id === documentId
    );
    return (extractionDoc?.fields ?? {}) as Record<string, unknown>;
  }

  return {};
}

/** Builds a normalised-key → value Map for fuzzy field matching. */
function buildExtractLookup(extractedData: Record<string, unknown>): Map<string, unknown> {
  const lookup = new Map<string, unknown>();
  Object.entries(extractedData).forEach(([key, value]) => lookup.set(toNormalizedKey(key), value));
  return lookup;
}

/** Looks up a field value from extracted data using normalised key matching. */
function mapValueFromExtract(fieldKey: string, extractedData: Record<string, unknown>): string {
  const value = buildExtractLookup(extractedData).get(toNormalizedKey(fieldKey));
  if (value === undefined || value === null) return '';
  return Array.isArray(value) ? value.join(', ') : String(value);
}

/** Builds a DocumentSpec (sections + repeatables) from a JSON schema. */
export function buildDocumentSpecFromJsonSchema(schema: JsonSchemaDocument): DocumentSpec {
  const properties = schema.properties ?? {};
  const requiredSet = new Set(schema.required ?? []);

  const flatEntries = Object.entries(properties).filter(
    ([, p]) => p.type !== 'array' && p.type !== 'object'
  );
  const arrayEntries = Object.entries(properties).filter(([, p]) => p.type === 'array');
  const objectEntries = Object.entries(properties).filter(([, p]) => p.type === 'object');

  const fields: IdpFieldSpec[] = flatEntries.map(([fieldKey, property], index) => ({
    fieldKey,
    codexName: fieldKey,
    reportingKey: fieldKey,
    label: toLabel(fieldKey),
    valueType: toValueType(property),
    required: requiredSet.has(fieldKey),
    editable: true,
    displayType: toDisplayType(property, fieldKey),
    format: property.format ?? '',
    placeholder: '',
    helpText: property.description ?? '',
    ...(Array.isArray(property.enum) && property.enum.length > 0 ? { options: property.enum } : {}),
    ...(property.minLength !== undefined ? { minLength: property.minLength } : {}),
    ...(property.maxLength !== undefined ? { maxLength: property.maxLength } : {}),
    ...(property.pattern ? { pattern: property.pattern } : {}),
    order: index
  }));

  // Object properties become their own sections; sub-field fieldKeys are namespaced as "${objectKey}_${subKey}".
  const objectSections = objectEntries.map(([objectKey, objectProperty], objectIndex) => {
    const nestedProperties = objectProperty.properties ?? {};
    const nestedRequiredSet = new Set(objectProperty.required ?? []);
    const nestedFields: IdpFieldSpec[] = Object.entries(nestedProperties).map(
      ([subKey, subProperty], subIndex) => ({
        fieldKey: `${objectKey}_${subKey}`,
        codexName: subKey,
        reportingKey: subKey,
        label: toLabel(subKey),
        valueType: toValueType(subProperty),
        required: nestedRequiredSet.has(subKey),
        editable: true,
        displayType: toDisplayType(subProperty, subKey),
        format: subProperty.format ?? '',
        placeholder: '',
        helpText: subProperty.description ?? '',
        ...(Array.isArray(subProperty.enum) && subProperty.enum.length > 0
          ? { options: subProperty.enum }
          : {}),
        ...(subProperty.minLength !== undefined ? { minLength: subProperty.minLength } : {}),
        ...(subProperty.maxLength !== undefined ? { maxLength: subProperty.maxLength } : {}),
        ...(subProperty.pattern ? { pattern: subProperty.pattern } : {}),
        order: subIndex
      })
    );
    return {
      sectionKey: objectKey,
      label: toLabel(objectKey),
      order: 1 + objectIndex,
      fields: nestedFields
    };
  });

  const repeatables = arrayEntries.map(([fieldKey, property], index) => {
    const itemProperties = property.items?.properties ?? {};
    const itemRequiredSet = new Set(property.items?.required ?? []);
    const isPrimitiveArray = Object.keys(itemProperties).length === 0;

    const subFields: IdpFieldSpec[] = isPrimitiveArray
      ? [
          {
            fieldKey,
            codexName: fieldKey,
            reportingKey: fieldKey,
            label: toLabel(fieldKey),
            valueType: toValueType(property.items ?? {}),
            required: requiredSet.has(fieldKey),
            editable: true,
            displayType: 'textbox',
            format: '',
            placeholder: '',
            helpText: property.description ?? '',
            order: 0
          }
        ]
      : Object.entries(itemProperties).map(([subKey, subProperty], subIndex) => ({
          fieldKey: subKey,
          codexName: subKey,
          reportingKey: subKey,
          label: toLabel(subKey),
          valueType: toValueType(subProperty),
          required: itemRequiredSet.has(subKey),
          editable: true,
          displayType: toDisplayType(subProperty, subKey),
          format: subProperty.format ?? '',
          placeholder: '',
          helpText: subProperty.description ?? '',
          ...(Array.isArray(subProperty.enum) && subProperty.enum.length > 0
            ? { options: subProperty.enum }
            : {}),
          ...(subProperty.minLength !== undefined ? { minLength: subProperty.minLength } : {}),
          ...(subProperty.maxLength !== undefined ? { maxLength: subProperty.maxLength } : {}),
          ...(subProperty.pattern ? { pattern: subProperty.pattern } : {}),
          ...(subProperty.type === 'array'
            ? { isNestedArray: true, nestedItemType: subProperty.items?.type }
            : {}),
          order: subIndex
        }));

    return {
      repeatableKey: fieldKey,
      reportingKey: fieldKey,
      label: toLabel(fieldKey),
      helpText: property.description ?? '',
      order: 1 + objectEntries.length + index,
      fields: subFields
    };
  });

  return {
    documentId: schema.title ?? 'dynamic-document',
    documentName: '1.0.0',
    documentType: '1.0.0',
    docTypeDisplay: schema.docTypeDisplay,
    sections: [
      { sectionKey: 'extracted_fields', label: 'Generic Details', order: 0, fields },
      ...objectSections
    ],
    repeatables
  };
}

/** Normalises schema and IDP payload into the view model consumed by ReviewPanel. */
export function normalizeResponseToViewModel(params: {
  schema: JsonSchemaDocument;
  payload: any;
  documentId: string;
  externalConfidenceData?: any;
}): NormalizedViewModel {
  const { schema, payload, documentId, externalConfidenceData } = params;
  const idpSpec = buildDocumentSpecFromJsonSchema(schema);
  const extractedData = getExtractedDataForDocument(payload, documentId);

  const resolvedValues: Record<string, string> = {};
  idpSpec.sections.forEach(section => {
    // "extracted_fields" uses the top-level extractedData; object sections use their sectionKey.
    const sectionData: Record<string, unknown> =
      section.sectionKey === 'extracted_fields'
        ? extractedData
        : ((extractedData[section.sectionKey] ?? {}) as Record<string, unknown>);
    section.fields.forEach(field => {
      resolvedValues[field.fieldKey] = mapValueFromExtract(field.codexName, sectionData);
    });
  });

  const repeatableRows: Record<string, Array<Record<string, string>>> = {};
  idpSpec.repeatables.forEach(repeatable => {
    const raw = extractedData[repeatable.repeatableKey];
    const rawArray = Array.isArray(raw) ? raw : [];
    const isPrimitive =
      repeatable.fields.length === 1 && repeatable.fields[0].fieldKey === repeatable.repeatableKey;

    repeatableRows[repeatable.repeatableKey] = rawArray.map((item: unknown) => {
      if (isPrimitive) {
        return {
          [repeatable.repeatableKey]: item !== null && item !== undefined ? String(item) : ''
        };
      }
      const rowLookup = buildExtractLookup((item ?? {}) as Record<string, unknown>);
      const row: Record<string, string> = {};
      repeatable.fields.forEach(field => {
        const val = rowLookup.get(toNormalizedKey(field.fieldKey));
        if (field.isNestedArray) {
          row[field.fieldKey] = Array.isArray(val) ? JSON.stringify(val) : '[]';
        } else {
          row[field.fieldKey] = val !== undefined && val !== null ? String(val) : '';
        }
      });
      return row;
    });
  });

  // Use externalConfidenceData (separate data page column, Batch API) when provided; else extract from payload.
  const rawConfidence =
    externalConfidenceData != null
      ? resolveExternalConfidence(externalConfidenceData, documentId)
      : getConfidenceDataForDocument(payload, documentId);

  return {
    idpSpec,
    resolvedValues,
    repeatableRows,
    confidenceData: extractConfidenceData(rawConfidence, idpSpec)
  };
}

export function checkPayloadDocumentTypeAndCategory(
  payload: unknown,
  documentTypeId: string,
  documentType: string
): boolean {
  if (!payload){
    return false;
  }
  const format = detectResponseFormat(payload);
  if (format === ResponseFormat.Delineation || format === ResponseFormat.Classify) {
    return (
      (payload as any)?.response?.extract_response?.some(
        (item: any) => item.document_id === documentTypeId && item.document_type === documentType
      ) ?? false
    );
  }
  if (format === ResponseFormat.BatchApi) {
    return (
      (payload as any)?.data?.some(
        (item: any) => item.document_id === documentTypeId && item.document_type === documentType
      ) ?? false
    );
  }
  return false;
}


export function getBoundingBoxForDocument(
  rawBoundingBoxData: any,
  documentId: string,
  fieldKey: string | undefined
): any {
  if (!rawBoundingBoxData || !documentId || !fieldKey) return null;
  const boundingBoxDataForSelectedDocument = rawBoundingBoxData.data.find(
    (result: any) => result.document_id === documentId
  );
  const boundingBoxForField = boundingBoxDataForSelectedDocument
    ? boundingBoxDataForSelectedDocument.boxes.find((field: any) => field.fieldName === fieldKey)
    : null;
  return boundingBoxForField;
}
