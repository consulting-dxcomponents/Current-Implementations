/**
 * responseBuilder.ts
 *
 * Reconstructs a full IDP payload from user-modified form values.
 *
 * The reverse of normalizeResponseToViewModel:
 *   - Flat section fields   → top-level keys in extracted_data (using codexName)
 *   - Object section fields → nested under their sectionKey
 *   - Primitive repeatables → array of raw primitives (string / number / boolean)
 *   - Object repeatables    → array of objects (one key per field.fieldKey)
 *
 * Only the `extracted_data` block for the selected `documentId` is mutated.
 * All other documents, confidence_data, response_metadata, etc. are
 * preserved verbatim from the original payload.
 */

import type { DocumentSpec, IdpRepeatableSpec } from '../idpTypes';
import { detectResponseFormat, getExtractedDataForDocument } from './responseNormalizer';
import { ResponseFormat } from './schemaTypes';

// ─── Skeleton builder ─────────────────────────────────────────────────────────

/**
 * Builds a minimal IDP payload skeleton for the given ResponseType so that
 * buildModifiedIdpPayload can populate extracted_data into it for a fresh v1 save.
 */
export function buildSkeletonPayload(
  ResponseType: string,
  documentId: string,
  documentType: string
): unknown {
  const extractDoc = { document_id: documentId, document_type: documentType, extracted_data: {} };
  if (ResponseType === ResponseFormat.Delineation) {
    return {
      response: {
        delineation_response: [{ document_id: documentId, document_type: documentType }],
        extract_response: [extractDoc]
      }
    };
  }
  if (ResponseType === ResponseFormat.BatchApi) {
    // Default skeleton uses the flat batch API shape matching the current IDP response format.
    return {
      type: 'extraction',
      data: [
        {
          document_id: documentId,
          document_type: documentType,
          fields: {}
        }
      ]
    };
  }
  return {
      type: 'extraction',
      data: [
        {
          document_id: documentId,
          document_type: documentType,
          fields: {}
        }
      ]
    };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Casts a string form value back to its original primitive type using the
 * field's `valueType` from the IDP spec, so that numbers are not serialised
 * as quoted strings and booleans are not serialised as the literal "true".
 */
function castToOriginalType(value: string, valueType: string): unknown {
  if (valueType === 'number') {
    const n = Number(value);
    return Number.isNaN(n) ? value : n;
  }
  if (valueType === 'boolean') {
    return value === 'true';
  }
  return value;
}

// ─── Core reconstruction ──────────────────────────────────────────────────────

/**
 * Rebuilds the `extracted_data` object for a single document from the
 * live (user-modified) field values and repeatable rows, preserving the
 * original data structure.
 *
 * Structure rules:
 * - If the original fieldKey value was an array of strings, the result keeps
 *   it as an array of strings (one element per row added by the user).
 * - If the original fieldKey value was an array of objects, the result keeps
 *   it as an array of objects with one key per field in that repeatable.
 * - Scalar section values are written back as their original primitive type.
 */
function buildExtractedData(
  idpSpec: DocumentSpec,
  currentFieldValues: Record<string, string>,
  currentRepeatableRows: Record<string, Array<Record<string, string>>>,
  originalExtractedData: Record<string, unknown>
): Record<string, unknown> {
  // Start from a shallow copy of the original so that any keys not managed
  // by the spec (e.g. confidence_data siblings, extra metadata) are preserved.
  const result: Record<string, unknown> = { ...originalExtractedData };

  // ── Section fields ─────────────────────────────────────────────────────────
  idpSpec.sections.forEach(section => {
    if (section.sectionKey === 'extracted_fields') {
      // Main section: values live at the top level of extracted_data.
      // Use codexName (the raw backend key) — not fieldKey which may be
      // namespaced for object-derived sections.
      section.fields.forEach(field => {
        result[field.codexName] = castToOriginalType(
          currentFieldValues[field.fieldKey] ?? '',
          field.valueType
        );
      });
    } else {
      // Object-derived section: values are nested under the sectionKey.
      const existing = (originalExtractedData[section.sectionKey] ?? {}) as Record<string, unknown>;
      const nested: Record<string, unknown> = { ...existing };
      section.fields.forEach(field => {
        // codexName = raw sub-key; fieldKey = "${sectionKey}_${subKey}" (namespaced).
        nested[field.codexName] = castToOriginalType(
          currentFieldValues[field.fieldKey] ?? '',
          field.valueType
        );
      });
      result[section.sectionKey] = nested;
    }
  });

  // ── Repeatable fields ──────────────────────────────────────────────────────
  idpSpec.repeatables.forEach((repeatable: IdpRepeatableSpec) => {
    const rows = currentRepeatableRows[repeatable.repeatableKey] ?? [];

    // A primitive repeatable has exactly one field whose fieldKey equals the
    // repeatableKey (e.g. an array of strings like ["val1", "val2"]).
    const isPrimitive =
      repeatable.fields.length === 1 && repeatable.fields[0].fieldKey === repeatable.repeatableKey;

    if (isPrimitive) {
      // Preserve the element type (string/number/boolean) from the spec.
      const fieldSpec = repeatable.fields[0];
      result[repeatable.repeatableKey] = rows.map(row =>
        castToOriginalType(row[repeatable.repeatableKey] ?? '', fieldSpec.valueType)
      );
    } else {
      // Array of objects — one object per row, one key per field.
      result[repeatable.repeatableKey] = rows.map(row => {
        const obj: Record<string, unknown> = {};
        repeatable.fields.forEach(field => {
          if (field.isNestedArray) {
            let arr: unknown[] = [];
            try {
              arr = JSON.parse(row[field.fieldKey] || '[]');
            } catch {
              /* use empty */
            }
            obj[field.fieldKey] = Array.isArray(arr)
              ? arr.map(v => castToOriginalType(String(v), field.nestedItemType ?? 'string'))
              : [];
          } else {
            obj[field.fieldKey] = castToOriginalType(row[field.fieldKey] ?? '', field.valueType);
          }
        });
        return obj;
      });
    }
  });

  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Builds a modified copy of the full IDP payload where the `extracted_data`
 * for `documentId` is replaced with the user-modified values while every
 * other part of the payload is left unchanged.
 *
 * Supports all three formats recognised by `detectResponseFormat`:
 *   - `delineation` / `classify`  →  `response.extract_response[]`
 *   - `trade-loan`                →  `response.trade_loan_response[]`
 *                                    or root-level `trade_loan_response[]`
 *
 * @param originalPayload  The raw IDP payload object as fetched from the data page.
 * @param documentId       The `document_id` of the document being reviewed.
 * @param idpSpec          The normalised document spec (from normalizeResponseToViewModel).
 * @param currentFieldValues  Live flat field values keyed by IdpFieldSpec.fieldKey.
 * @param currentRepeatableRows  Live row data keyed by IdpRepeatableSpec.repeatableKey.
 * @returns A new payload object with the modified extracted_data for the given document.
 */
export function buildModifiedIdpPayload(params: {
  originalPayload: unknown;
  documentId: string;
  documentType?: string;
  idpSpec: DocumentSpec;
  currentFieldValues: Record<string, string>;
  currentRepeatableRows: Record<string, Array<Record<string, string>>>;
}): unknown {
  const {
    originalPayload,
    documentId,
    documentType = '',
    idpSpec,
    currentFieldValues,
    currentRepeatableRows
  } = params;

  const format = detectResponseFormat(originalPayload);
  const source = originalPayload as Record<string, any>;

  // Grab the original extracted_data so we can fall back to it for any keys
  // not covered by the spec.
  const originalExtractedData = getExtractedDataForDocument(originalPayload, documentId);

  const modifiedExtractedData = buildExtractedData(
    idpSpec,
    currentFieldValues,
    currentRepeatableRows,
    originalExtractedData
  );

  // ── delineation / classify ─────────────────────────────────────────────────
  if (format === ResponseFormat.Delineation || format === ResponseFormat.Classify) {
    const existingExtract: Record<string, unknown>[] = source.response?.extract_response ?? [];
    const foundInExtract = existingExtract.some((item: any) => item.document_id === documentId);
    const updatedExtractResponse = foundInExtract
      ? existingExtract.map((item: Record<string, unknown>) =>
          item.document_id === documentId
            ? { ...item, extracted_data: modifiedExtractedData }
            : item
        )
      : [
          ...existingExtract,
          {
            document_id: documentId,
            document_type: documentType,
            extracted_data: modifiedExtractedData
          }
        ];

    if (format === ResponseFormat.Delineation) {
      const existingDelineation: Record<string, unknown>[] =
        source.response?.delineation_response ?? [];
      const foundInDelineation = existingDelineation.some(
        (item: any) => item.document_id === documentId
      );
      const updatedDelineationResponse = foundInDelineation
        ? existingDelineation
        : [...existingDelineation, { document_id: documentId, document_type: documentType }];
      return {
        ...source,
        response: {
          ...source.response,
          delineation_response: updatedDelineationResponse,
          extract_response: updatedExtractResponse
        }
      };
    }

    return {
      ...source,
      response: {
        ...source.response,
        extract_response: updatedExtractResponse
      }
    };
  }

  // ── batch-api ──────────────────────────────────────────────────────────────
  if (format === ResponseFormat.BatchApi) {
    // Flat batch API (with or without type discriminator): { [type,] data: [{document_id, fields}] }
    if (Array.isArray(source?.data)) {
      const existingData = source.data as Record<string, unknown>[];
      const found = existingData.some((item: any) => item.document_id === documentId);
      const updatedData = found
        ? existingData.map((item: Record<string, unknown>) =>
            item.document_id === documentId ? { ...item, fields: modifiedExtractedData } : item
          )
        : [
            ...existingData,
            { document_id: documentId, document_type: documentType, fields: modifiedExtractedData }
          ];
      return { ...source, data: updatedData };
    }
    // Nested results batch API: { results: [{type:'extraction', data:[...]}] }
    const updatedResults = (source.results as any[]).map((result: Record<string, unknown>) => {
      if (result.type !== 'extraction') return result;
      const existingData: Record<string, unknown>[] =
        (result.data as Record<string, unknown>[]) ?? [];
      const found = existingData.some((item: any) => item.document_id === documentId);
      const updatedData = found
        ? existingData.map((item: Record<string, unknown>) =>
            item.document_id === documentId ? { ...item, fields: modifiedExtractedData } : item
          )
        : [
            ...existingData,
            { document_id: documentId, document_type: documentType, fields: modifiedExtractedData }
          ];
      return { ...result, data: updatedData };
    });
    return { ...source, results: updatedResults };
  }

  // Unknown format — return the payload unchanged.
  return originalPayload;
}
