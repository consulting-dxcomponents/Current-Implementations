/* eslint-disable class-methods-use-this */
import type {
  ISchemaTransformer,
  ResponseFormat,
  NormalizedFieldMetadata,
  TransformationResult,
  SchemaError,
  SelectOption,
} from "./schemaTypes";

/**
 * Base abstract transformer class with common utilities
 */
export abstract class BaseSchemaTransformer implements ISchemaTransformer {
  abstract format: ResponseFormat;

  abstract canTransform(source: any): boolean;

  abstract transform(source: any): TransformationResult;

  /**
   * Utility: normalize field properties from various formats
   */
  protected normalizeField(
    source: any,
    defaults: Partial<NormalizedFieldMetadata> = {},
  ): NormalizedFieldMetadata {
    const field: NormalizedFieldMetadata = {
      fieldKey:
        source.fieldKey ||
        source.name ||
        source.field_name ||
        source.id ||
        "unknown",
      label: source.label || source.title || source.fieldKey || "Field",
      valueType: this.normalizeValueType(
        source.valueType || source.type || "string",
      ),
      required: source.required ?? false,
      readonly: source.readonly ?? source.editable === false,
      displayType: source.displayType || source.controlType || "textbox",
      order: source.order ?? 0,
      ...defaults,
    };

    // Optional properties
    if (source.placeholder || source.placeholder_text) {
      field.placeholder = source.placeholder || source.placeholder_text;
    }
    if (source.helpText || source.help_text || source.description) {
      field.helpText =
        source.helpText || source.help_text || source.description;
    }
    if (source.tooltip) {
      field.tooltip = source.tooltip;
    }
    if (source.format) {
      field.format = source.format;
    }
    if (source.min !== undefined) {
      field.min = source.min;
    }
    if (source.max !== undefined) {
      field.max = source.max;
    }
    if (source.minLength !== undefined) {
      field.minLength = source.minLength;
    }
    if (source.maxLength !== undefined) {
      field.maxLength = source.maxLength;
    }
    if (source.pattern) {
      field.pattern = source.pattern;
    }
    if (source.options || source.choices) {
      field.options = this.normalizeOptions(source.options || source.choices);
    }
    if (source.reportingKey) {
      field.reportingKey = source.reportingKey;
    }
    if (source.codexName) {
      field.codexName = source.codexName;
    }
    if (source.dependsOn) {
      field.dependsOn = Array.isArray(source.dependsOn)
        ? source.dependsOn
        : [source.dependsOn];
    }

    return field;
  }

  /**
   * Utility: normalize value types across different format representations
   */
  protected normalizeValueType(
    type: string,
  ):
    | "string"
    | "number"
    | "boolean"
    | "date"
    | "datetime"
    | "object"
    | "array" {
    const lowerType = String(type).toLowerCase();

    const typeMap: Record<string, any> = {
      string: "string",
      text: "string",
      textarea: "string",
      number: "number",
      integer: "number",
      int: "number",
      float: "number",
      decimal: "number",
      boolean: "boolean",
      bool: "boolean",
      checkbox: "boolean",
      date: "date",
      datetime: "datetime",
      timestamp: "datetime",
      object: "object",
      array: "array",
    };

    return typeMap[lowerType] || "string";
  }

  /**
   * Utility: normalize select/dropdown options
   */
  protected normalizeOptions(options: any): SelectOption[] {
    if (!Array.isArray(options)) {
      return [];
    }

    return options.map((opt: any) => ({
      value: opt.value !== undefined ? opt.value : (opt.id ?? opt.label),
      label: opt.label || opt.text || opt.name || String(opt.value),
      disabled: opt.disabled ?? false,
      helpText: opt.helpText || opt.help_text,
    }));
  }

  /**
   * Utility: create validation error
   */
  protected createError(
    path: string,
    message: string,
    code: string,
    severity: "error" | "warning" = "error",
  ): SchemaError {
    return { path, message, code, severity };
  }
}
