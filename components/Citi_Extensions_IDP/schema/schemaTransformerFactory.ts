import type {
  ISchemaTransformer,
  ResponseFormat,
  TransformationResult,
} from "./schemaTypes";
import { DelineationTransformer } from "./delineationTransformer";

/**
 * Factory that auto-detects the response format and dispatches
 * to the appropriate transformer.
 *
 * Usage:
 *   const result = SchemaTransformerFactory.transform(rawResponse);
 *
 * To register new transformers (e.g. ClassifyTransformer, TradeLoanTransformer)
 * simply call SchemaTransformerFactory.register(new ClassifyTransformer()) before
 * invoking transform().
 */
export class SchemaTransformerFactory {
  private static readonly transformers: ISchemaTransformer[] = [
    new DelineationTransformer(),
    // ClassifyTransformer and TradeLoanTransformer will be registered here
  ];

  /**
   * Register a new transformer. Later registrations take lower priority
   * than earlier ones — register more-specific transformers first.
   */
  static register(transformer: ISchemaTransformer): void {
    SchemaTransformerFactory.transformers.push(transformer);
  }

  /**
   * Detect format and transform the raw IDP response.
   * Returns an error result if no transformer can handle the source.
   */
  static transform(source: unknown): TransformationResult {
    const transformer = SchemaTransformerFactory.detect(source);

    if (!transformer) {
      return {
        success: false,
        errors: [
          {
            path: "$",
            message: `No transformer found for the given response shape. Registered formats: ${SchemaTransformerFactory.transformers.map((t) => t.format).join(", ")}`,
            code: "UNKNOWN_FORMAT",
            severity: "error",
          },
        ],
      };
    }

    return transformer.transform(source);
  }

  /**
   * Detect which transformer can handle the source, without transforming.
   * Returns undefined if no match is found.
   */
  static detect(source: unknown): ISchemaTransformer | undefined {
    return SchemaTransformerFactory.transformers.find((t) =>
      t.canTransform(source),
    );
  }

  /**
   * Returns the detected ResponseFormat, or undefined if unknown.
   */
  static detectFormat(source: unknown): ResponseFormat | undefined {
    return SchemaTransformerFactory.detect(source)?.format;
  }
}
