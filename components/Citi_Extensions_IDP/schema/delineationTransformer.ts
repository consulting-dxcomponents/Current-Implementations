/* eslint-disable class-methods-use-this */
import { BaseSchemaTransformer } from './baseSchemaTransformer';
import { ResponseFormat } from './schemaTypes';
import type {
  NormalizedDocumentSchema,
  NormalizedSectionMetadata,
  NormalizedRepeatableMetadata,
  TransformationResult,
  SchemaError
} from './schemaTypes';

/**
 * Transformer for delineation format
 */
export class DelineationTransformer extends BaseSchemaTransformer {
  format: ResponseFormat = ResponseFormat.Delineation;

  canTransform(source: any): boolean {
    // Check for delineation-specific markers
    return (
      source &&
      typeof source === 'object' &&
      source.response &&
      source.response.delineation_response &&
      Array.isArray(source.response.delineation_response) &&
      Array.isArray(source.response.extract_response)
    );
  }

  transform(source: any): TransformationResult {
    const errors: SchemaError[] = [];

    try {
      const schema: NormalizedDocumentSchema = {
        documentId: source.documentId || 'unknown',
        documentName: source.documentName || 'unknown',
        documentType: source.documentType || 'unknown',
        sections: [],
        repeatables: []
      };

      // Transform sections
      if (Array.isArray(source.sections)) {
        schema.sections = source.sections.map((section: any) => this.transformSection(section));
      }

      // Transform repeatables
      if (Array.isArray(source.repeatables)) {
        schema.repeatables = source.repeatables.map((repeatable: any) =>
          this.transformRepeatable(repeatable)
        );
      }

      return {
        success: errors.length === 0,
        schema,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      return {
        success: false,
        errors: [
          this.createError(
            '$',
            `Transformation failed: ${error instanceof Error ? error.message : String(error)}`,
            'TRANSFORM_ERROR'
          )
        ]
      };
    }
  }

  private transformSection(source: any): NormalizedSectionMetadata {
    return {
      sectionKey: source.sectionKey || 'unknown',
      label: source.label || 'Section',
      order: source.order ?? 0,
      fields: (Array.isArray(source.fields) ? source.fields : []).map((field: any) =>
        this.normalizeField(field, { sectionKey: source.sectionKey })
      )
    };
  }

  private transformRepeatable(source: any): NormalizedRepeatableMetadata {
    return {
      repeatableKey: source.repeatableKey || 'unknown',
      label: source.label || 'Repeatable',
      order: source.order ?? 0,
      helpText: source.helpText,
      fields: (Array.isArray(source.fields) ? source.fields : []).map((field: any) =>
        this.normalizeField(field)
      ),
      reportingKey: source.reportingKey
    };
  }
}
