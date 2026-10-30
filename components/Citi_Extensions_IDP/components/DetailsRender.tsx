import { Fragment, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, ReactElement } from 'react';
import styled from 'styled-components';
import {
  Input,
  TextArea,
  Select,
  Checkbox,
  RadioButton,
  FieldGroup,
  DateInput,
  PhoneInput,
  CurrencyInput,
  Text,
  Button,
  Icon,
  forceRegisterIcon,
  Configuration
} from '@pega/cosmos-react-core';
import * as trashIcon from '@pega/cosmos-react-core/lib/components/Icon/icons/trash.icon';
import * as plusIcon from '@pega/cosmos-react-core/lib/components/Icon/icons/plus.icon';
import {
  StyledRepeatableTable,
  StyledRepeatableTableWrapper,
  StyledRequiredMark,
  StyledChipWrapper,
  StyledChipList,
  StyledChip,
  StyledChipRemoveButton,
  StyledChipInput,
  StyledChipLabel
} from '../styles';

import { DISPLAY_TYPE_MAP, sortByOrder } from '../idpTypes';
import type { IdpFieldSpec } from '../idpTypes';
import { toISOBySpec, formatDateBySpec } from '../utils/dateUtils';
import {
  getConfidenceBorderColor,
  resolveDisplayType,
  validateFieldFormat
} from '../utils/helpers';

// Register icons eagerly — Pega's bundler may not resolve lazy dynamic imports.
forceRegisterIcon(trashIcon);
forceRegisterIcon(plusIcon);

// ─── Field component factory ─────────────────────────────────────────────────
// displayType → Cosmos widget. Only for editable fields; read-only renders as Text.

type FieldRenderFn = (
  spec: IdpFieldSpec,
  value: string,
  onChange: (val: string) => void
) => ReactElement;

/** Shorthand: builds the additionalInfo prop from spec.helpText (undefined when absent). */
const ai = (spec: IdpFieldSpec) => (spec.helpText ? { content: spec.helpText } : undefined);

/** Returns true when the spec's displayType is date or datetime. */
const isDateField = (spec: IdpFieldSpec) =>
  spec.displayType === 'date' || spec.displayType === 'datetime';

/** Adds a visible required marker to a required radio FieldGroup legend. */
const RadioFieldGroup = styled(FieldGroup)`
  legend span::after {
    content: ' *';
    color: var(--app-error, #c00);
    font-weight: 700;
  }
`;

/** Builds an Input entry; `type` defaults to 'text'. */
const inputEntry =
  (type: 'text' | 'email' | 'url' = 'text'): FieldRenderFn =>
  (s, v, fn) => (
    <Input
      type={type}
      label={s.label}
      required={s.required}
      value={v}
      placeholder={s.placeholder}
      additionalInfo={ai(s)}
      onChange={(e: ChangeEvent<HTMLInputElement>) => {
        const val =
          s.maxLength !== undefined ? e.target.value.slice(0, s.maxLength) : e.target.value;
        fn(val);
      }}
    />
  );

/** Maps a display pattern to the BCP-47 locale that produces the same segment order in Cosmos DateInput. */
function localeForPattern(pattern: string): string | undefined {
  const upper = pattern.toUpperCase();
  if (upper.startsWith('DD')) return 'en-GB'; // DD/MM/YYYY
  if (upper.startsWith('MM')) return 'en-US'; // MM/DD/YYYY
  if (upper.startsWith('YYYY')) return 'zh-CN'; // YYYY/MM/DD
  return undefined;
}

/** Builds a DateInput entry for 'date' or 'datetime' variant. */
const dateEntry =
  (variant: 'date' | 'datetime'): FieldRenderFn =>
  (s, v, fn) => {
    const locale = s.pattern ? localeForPattern(s.pattern) : undefined;
    const input = (
      <DateInput
        variant={variant}
        label={s.label}
        required={s.required}
        value={toISOBySpec(v, s)}
        additionalInfo={ai(s)}
        onChange={d =>
          fn(
            variant === 'date'
              ? d?.valueAsISOString?.substring(0, 10) ?? ''
              : d?.valueAsISOString ?? ''
          )
        }
      />
    );
    // Wrap with Configuration only when we need to override the app locale.
    return locale ? <Configuration locale={locale}>{input}</Configuration> : input;
  };

const FIELD_COMPONENT_FACTORY: Record<string, FieldRenderFn> = {
  textbox: inputEntry(),
  email: inputEntry('email'),
  url: inputEntry('url'),
  autocomplete: inputEntry(),
  date: dateEntry('date'),
  datetime: dateEntry('datetime'),
  textarea: (s, v, fn) => (
    <TextArea
      label={s.label}
      required={s.required}
      value={v}
      placeholder={s.placeholder}
      additionalInfo={ai(s)}
      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
        const val =
          s.maxLength !== undefined ? e.target.value.slice(0, s.maxLength) : e.target.value;
        fn(val);
      }}
    />
  ),
  dropdown: (s, v, fn) => (
    <Select
      label={s.label}
      required={s.required}
      value={v}
      additionalInfo={ai(s)}
      onChange={(e: ChangeEvent<HTMLSelectElement>) => fn(e.target.value)}
    >
      {!v && <option value=''>{s.placeholder || 'Select…'}</option>}
    </Select>
  ),
  checkbox: (s, v, fn) => (
    <Checkbox
      checked={v === 'true'}
      label={s.label}
      required={s.required}
      additionalInfo={ai(s)}
      onChange={(e: ChangeEvent<HTMLInputElement>) => fn(String(e.target.checked))}
    />
  ),
  // type='text'+inputMode avoids native spinner; pattern limits to digits/decimals
  number: (s, v, fn) => (
    <Input
      type='text'
      inputMode='numeric'
      pattern='[0-9]*\.?[0-9]*'
      label={s.label}
      required={s.required}
      value={v}
      placeholder={s.placeholder}
      additionalInfo={ai(s)}
      onChange={(e: ChangeEvent<HTMLInputElement>) => fn(e.target.value)}
    />
  ),
  currency: (s, v, fn) => (
    <CurrencyInput
      label={s.label}
      required={s.required}
      value={v}
      additionalInfo={ai(s)}
      onChange={(val: string) => fn(val ?? '')}
    />
  ),
  phone: (s, v, fn) => (
    <PhoneInput
      label={s.label}
      required={s.required}
      value={v}
      showCountryCode
      additionalInfo={ai(s)}
      onChange={(val: string) => fn(val ?? '')}
    />
  ),
  radio: (s, v, fn) => {
    if (!Array.isArray(s.options) || s.options.length === 0) {
      return <Text as='span' aria-label={s.label}>{v || '—'}</Text>;
    }

    const RadioGroup = s.required ? RadioFieldGroup : FieldGroup;

    return (
      <RadioGroup name={s.label} additionalInfo={ai(s)}>
        {s.options.map(o => (
          <RadioButton
            key={o}
            name={s.fieldKey}
            label={o}
            checked={v === o}
            onChange={() => fn(o)}
          />
        ))}
      </RadioGroup>
    );
  }
};

// ─── Field focus info ────────────────────────────────────────────────────────

export interface FieldFocusInfo {
  /** Where the focused field lives in the UI. */
  type: 'section' | 'repeatable-table' | 'primitive-chip';
  /** Section / primitive-chip: the focused field key. */
  fieldName?: string;
  /** Repeatable-table: the repeatable group name. */
  repeatableFieldName?: string;
  /** Repeatable-table: the column field key. */
  columnFieldName?: string;
  /** Repeatable-table: the row index of the focused cell. Primitive-chip: the index of the selected chip. */
  rowIndex?: number;
  /** Current field value; repeatable rows/chips are JSON-stringified. */
  value?: string;
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface DetailsRenderProps {
  children?: never;
  fieldSpecs: IdpFieldSpec[];
  resolvedValues: Record<string, string>;
  nCols?: number;
  onFieldChange?: (spec: IdpFieldSpec, prev: string, next: string) => void;
  onLiveChange?: (spec: IdpFieldSpec, value: string) => void;
  validated?: boolean;
  fieldConfidence?: Record<string, number>;
  onFormatErrorCountChange?: (count: number) => void;
  readOnlyMode?: boolean;
  onFieldFocus?: (info: FieldFocusInfo) => void;
}

const ErrorSpan = ({ message }: { message: string }) => (
  <span
    style={{
      color: 'var(--app-error, #c00)',
      fontSize: '0.75rem',
      display: 'block',
      marginTop: '2px'
    }}
  >
    {message}
  </span>
);

// ─── DetailsRender ───────────────────────────────────────────────────────────
/** Renders all fields in a section; shows required/format errors after blur or Save. */
const DetailsRender = ({
  fieldSpecs,
  resolvedValues,
  nCols = 2,
  onFieldChange,
  onLiveChange,
  validated = false,
  fieldConfidence,
  onFormatErrorCountChange,
  readOnlyMode = false,
  onFieldFocus
}: DetailsRenderProps): ReactElement => {
  const orderedFields = sortByOrder(fieldSpecs).map(f =>
    readOnlyMode ? { ...f, editable: false } : f
  );

  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => ({
    ...resolvedValues
  }));
  const [touched, setTouched] = useState<Set<string>>(new Set());

  // Report format-error count to parent
  const formatErrorCount = orderedFields.filter(
    s =>
      s.editable &&
      (validated || touched.has(s.fieldKey)) &&
      validateFieldFormat(s, fieldValues[s.fieldKey] ?? '') !== null
  ).length;
  const prevFormatErrorCountRef = useRef(formatErrorCount);
  useEffect(() => {
    if (formatErrorCount !== prevFormatErrorCountRef.current) {
      prevFormatErrorCountRef.current = formatErrorCount;
      onFormatErrorCountChange?.(formatErrorCount);
    }
  });

  // Sync state when resolvedValues prop changes
  const prevResolvedRef = useRef(resolvedValues);
  useEffect(() => {
    if (resolvedValues !== prevResolvedRef.current) {
      prevResolvedRef.current = resolvedValues;
      setFieldValues({ ...resolvedValues });
      setTouched(new Set());
    }
  }, [resolvedValues]);

  // Sync refs keep handleCommit accurate when onBlur fires before React flushes state
  const focusValueRef = useRef<string>('');
  const currentEditFieldRef = useRef<string>('');
  const currentEditValueRef = useRef<string>('');

  const handleFocus = (fieldKey: string) => {
    const stateVal = fieldValues[fieldKey] ?? '';
    const spec = orderedFields.find(s => s.fieldKey === fieldKey);
    focusValueRef.current = stateVal;
    currentEditValueRef.current = stateVal;
    currentEditFieldRef.current = fieldKey;
    // Radio: browser fires focus before change, so the correct value is reported from handleChange
    if (spec?.displayType === 'radio') return;
    onFieldFocus?.({ type: 'section', fieldName: fieldKey, value: stateVal });
  };

  const handleChange = (fieldKey: string, newValue: string) => {
    currentEditValueRef.current = newValue;
    currentEditFieldRef.current = fieldKey;
    setFieldValues(prev => ({ ...prev, [fieldKey]: newValue }));
    const spec = orderedFields.find(s => s.fieldKey === fieldKey);
    if (spec) onLiveChange?.(spec, newValue);
    if (spec?.displayType === 'radio') {
      onFieldFocus?.({ type: 'section', fieldName: fieldKey, value: newValue });
    }
  };

  const handleCommit = (fieldKey: string) => {
    setTouched(prev => new Set(prev).add(fieldKey));
    const prev = focusValueRef.current;
    const next =
      currentEditFieldRef.current === fieldKey
        ? currentEditValueRef.current
        : fieldValues[fieldKey] ?? prev;
    const spec = orderedFields.find(s => s.fieldKey === fieldKey);
    const isDate = spec && isDateField(spec);
    const normPrev = isDate ? toISOBySpec(prev, spec) : prev;
    const normNext = isDate ? toISOBySpec(next, spec) : next;
    if (normPrev === normNext) return;
    if (spec)
      onFieldChange?.(
        spec,
        isDate ? formatDateBySpec(normPrev, spec, prev) : prev,
        isDate ? formatDateBySpec(normNext, spec, prev) : next
      );
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${nCols}, minmax(0, 1fr))`,
        gap: '8px 16px'
      }}
    >
      {orderedFields.map((spec, idx) => {
        const key = `field-${spec.fieldKey}-${idx}`;
        const pegaType = DISPLAY_TYPE_MAP[spec.displayType];

        const currentValue = fieldValues[spec.fieldKey] ?? '';
        const shouldValidate = validated || touched.has(spec.fieldKey);
        const hasError =
          shouldValidate &&
          spec.required &&
          (spec.displayType === 'checkbox' ? currentValue !== 'true' : !currentValue.trim());
        const formatError =
          shouldValidate && spec.editable && spec.displayType !== 'checkbox'
            ? validateFieldFormat(spec, currentValue)
            : null;
        const fieldHasAnyError = hasError || formatError !== null;

        let editableWidget: ReactElement | null = null;
        if (spec.editable && spec.displayType !== 'checkbox') {
          const effectiveDisplayType = resolveDisplayType(spec);
          const renderFn = FIELD_COMPONENT_FACTORY[effectiveDisplayType];
          if (renderFn) {
            const isDateFld = isDateField({ ...spec, displayType: effectiveDisplayType });
            editableWidget = renderFn(spec, currentValue, (val: string) => {
              if (isDateFld) {
                // val is ISO from Cosmos DateInput; convert to the field's display format
                // using spec.format (if a display pattern like "DD/MM/YYYY") or detection
                const formatted = formatDateBySpec(val, spec, focusValueRef.current || val);
                currentEditValueRef.current = formatted;
                currentEditFieldRef.current = spec.fieldKey;
                setFieldValues(prev => ({ ...prev, [spec.fieldKey]: formatted }));
                onLiveChange?.(spec, formatted);
                handleCommit(spec.fieldKey); // reads focusValueRef (old) and currentEditValueRef (new)
                focusValueRef.current = formatted; // advance baseline in display format
              } else {
                handleChange(spec.fieldKey, val);
              }
            });
          } else {
            editableWidget = (
              <Input
                label={spec.label}
                required={spec.required}
                value={currentValue}
                placeholder={spec.placeholder}
                additionalInfo={ai(spec)}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  handleChange(spec.fieldKey, e.target.value)
                }
              />
            );
          }
        }

        const confScore = fieldConfidence?.[spec.fieldKey];

        // Pick rendering strategy: checkbox | read-only | editable
        let fieldContent: ReactElement;

        if (spec.displayType === 'checkbox') {
          // Checkbox is self-labelled — skip FieldValueList to avoid a duplicate label
          const checkboxEl: ReactElement = FIELD_COMPONENT_FACTORY.checkbox(
            spec,
            currentValue,
            (val: string) => handleChange(spec.fieldKey, val)
          );
          fieldContent = (
            <div
              data-testid={spec.fieldKey}
              data-idp-field-error={hasError || undefined}
              style={{ marginTop: '4px', marginBottom: '4px' }}
              onFocus={() =>
                onFieldFocus?.({ type: 'section', fieldName: spec.fieldKey, value: currentValue })
              }
              onBlur={() => handleCommit(spec.fieldKey)}
            >
              <div style={{ display: 'inline-flex', alignItems: 'center' }}>{checkboxEl}</div>
              {hasError && <ErrorSpan message='This field is required' />}
            </div>
          );
        } else if (!spec.editable) {
          // Read-only: FieldGroup supplies the label (+ optional info icon), Text supplies the value
          const displayValue =
            isDateField(spec) && currentValue
              ? formatDateBySpec(toISOBySpec(currentValue, spec), spec, currentValue)
              : currentValue;
          // Read-only fields aren't focusable, so a click triggers the bounding-box highlight.
          fieldContent = (
            <div
              style={{ cursor: 'pointer' }}
              onClick={() =>
                onFieldFocus?.({ type: 'section', fieldName: spec.fieldKey, value: currentValue })
              }
            >
              <FieldGroup
                name={spec.label}
                data-testid={spec.fieldKey}
                additionalInfo={spec.helpText ? { content: spec.helpText } : undefined}
              >
                <Text as='span' data-pega-type={pegaType ?? spec.displayType}>
                  {displayValue || '\u2014'}
                </Text>
              </FieldGroup>
            </div>
          );
        } else {
          // Editable: Cosmos label prop handles Constellation styling + required asterisk
          fieldContent = (
            <div
              data-testid={spec.fieldKey}
              data-idp-field-error={fieldHasAnyError || undefined}
              onFocus={() => handleFocus(spec.fieldKey)}
              onBlur={() => handleCommit(spec.fieldKey)}
            >
              {editableWidget}
              {hasError && <ErrorSpan message='This field is required' />}
              {!hasError && formatError && <ErrorSpan message={formatError} />}
            </div>
          );
        }

        return (
          <Fragment key={key}>
            {confScore !== undefined ? (
              <div
                style={{
                  borderLeft: `4px solid ${getConfidenceBorderColor(confScore)}`,
                  paddingLeft: '8px'
                }}
              >
                {fieldContent}
              </div>
            ) : (
              fieldContent
            )}
          </Fragment>
        );
      })}
    </div>
  );
};

/** Audit serialization: single-field → string[], multi-field → object[]. */
/** Returns the audit "prev" rows when deleting: newly added row deletions use nextRows so add-then-delete nets to no change. */
/** Returns formatted next value and audit prev rows for a repeatable cell commit. */
function resolveCommitAudit(
  rowIdx: number,
  initialRowCount: number,
  spec: IdpFieldSpec,
  normNext: string,
  rawNext: string,
  isDate: boolean,
  focusPrev: string,
  focusRows: Array<Record<string, string>>
) {
  const formattedNext = isDate ? formatDateBySpec(normNext, spec, focusPrev) : rawNext;
  const prevRowsForAudit =
    rowIdx >= initialRowCount ? focusRows.filter((_, i) => i !== rowIdx) : focusRows;
  return { formattedNext, prevRowsForAudit };
}

/** Resolves prev/next values for a repeatable cell commit; extracted to reduce RepeatableRender complexity. */
function resolveRepeatableCellCommit(
  rowIdx: number,
  spec: IdpFieldSpec,
  focusValue: string,
  focusRows: Array<Record<string, string>>,
  editKey: { rowIdx: number; fieldKey: string } | null,
  editValue: string
) {
  const rawNext =
    editKey && editKey.rowIdx === rowIdx && editKey.fieldKey === spec.fieldKey
      ? editValue
      : focusRows[rowIdx]?.[spec.fieldKey] ?? focusValue;
  const isDate = spec.displayType === 'date' || spec.displayType === 'datetime';
  return {
    normPrev: isDate ? toISOBySpec(focusValue, spec) : focusValue,
    normNext: isDate ? toISOBySpec(rawNext, spec) : rawNext,
    rawNext,
    isDate,
    focusPrev: focusValue
  };
}

function serializeRepeatableRows(
  rows: Array<Record<string, string>>,
  specs: IdpFieldSpec[]
): unknown {
  if (specs.length === 1) {
    const key = specs[0].fieldKey;
    return rows.map(r => r[key] ?? '');
  }
  return rows.map(r => Object.fromEntries(specs.map(s => [s.label, r[s.fieldKey] ?? ''])));
}

/** Fires onFieldChange for a row deletion; no-ops when spec or callback is absent. */
function fireDeleteRowChangeIfNeeded(
  spec: IdpFieldSpec | undefined,
  rowIdx: number,
  rowValues: Array<Record<string, string>>,
  orderedSpecs: IdpFieldSpec[],
  onFieldChange: ((s: IdpFieldSpec, prev: string, next: string) => void) | undefined
): void {
  if (!onFieldChange || !spec) return;
  const nextRows = rowValues.filter((_, i) => i !== rowIdx);
  // Always log the removal as its own audit entry (previous rows → rows after
  // deletion), matching the "one row per change" behaviour.
  onFieldChange(
    spec,
    JSON.stringify(serializeRepeatableRows(rowValues, orderedSpecs)),
    JSON.stringify(serializeRepeatableRows(nextRows, orderedSpecs))
  );
}

function parseNestedArray(raw: string | undefined): string[] {
  try {
    return raw ? (JSON.parse(raw) as unknown[]).map(String) : [];
  } catch {
    return raw
      ? raw
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
      : [];
  }
}

/** Chip/tag control for inline editing of nested array fields inside the repeatable table. */
/** Unified chip control for both nested-array table cells and primitive array repeatables. */
const ChipControl = ({
  chips,
  initialCount,
  label,
  isNumeric = false,
  hasError = false,
  readOnly = false,
  showError = false,
  showLabel = false,
  bordered = false,
  required = false,
  onFocus,
  onBlur,
  onChipSelect,
  onChipsChange
}: {
  chips: string[];
  initialCount: number;
  label: string;
  isNumeric?: boolean;
  hasError?: boolean;
  readOnly?: boolean;
  showError?: boolean;
  showLabel?: boolean;
  bordered?: boolean;
  required?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  /** Fired when an existing chip is selected (clicked/focused); receives the chip value and its index. */
  onChipSelect?: (chipValue: string, index: number) => void;
  onChipsChange: (newChips: string[]) => void;
}): ReactElement => {
  const [inputVal, setInputVal] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const tryAdd = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    if (isNumeric && !/^-?\d+(\.\d+)?$/.test(v)) return;
    if (chips.some(c => c.toLowerCase() === v.toLowerCase())) return; // reject duplicates (case-insensitive)
    onChipsChange([...chips, v]);
    setInputVal('');
  };
  if (readOnly && chips.filter(c => c.trim()).length === 0) {
    return (
      <div>
        {showLabel && <StyledChipLabel>{label}</StyledChipLabel>}
        <span>—</span>
      </div>
    );
  }
  return (
    <div>
      {showLabel && (
        <StyledChipLabel>
          {label}
          {!readOnly && required && <StyledRequiredMark aria-hidden='true'>*</StyledRequiredMark>}
        </StyledChipLabel>
      )}
      <StyledChipWrapper
        $hasError={hasError}
        $bordered={bordered && !readOnly}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        <StyledChipList>
          {(() => {
            const seen: Record<string, number> = {};
            return chips.map((chip, idx) => {
              seen[chip] = (seen[chip] ?? 0) + 1;
              const chipKey = `${chip}__${seen[chip]}`;
              const isNew = idx >= initialCount;
              return (
                <StyledChip
                  key={chipKey}
                  $isNew={isNew}
                  $isSelected={selectedIndex === idx}
                  tabIndex={0}
                  role='button'
                  aria-pressed={selectedIndex === idx}
                  aria-label={`Select ${chip}`}
                  onFocus={e => {
                    e.stopPropagation();
                    setSelectedIndex(idx);
                    onChipSelect?.(chip, idx);
                  }}
                  onBlur={e => {
                    e.stopPropagation();
                    // only clear if focus isn't moving to another chip that already claimed selection
                    setSelectedIndex(prev => (prev === idx ? null : prev));
                  }}
                >
                  {chip}
                  {!readOnly && (
                    <StyledChipRemoveButton
                      type='button'
                      aria-label={`Remove ${chip}`}
                      onMouseDown={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        onChipsChange(chips.filter((_, i) => i !== idx));
                      }}
                    >
                      &#x2715;
                    </StyledChipRemoveButton>
                  )}
                </StyledChip>
              );
            });
          })()}
          {!readOnly && (
            <StyledChipInput
              type='text'
              aria-label={`Add item to ${label}`}
              inputMode={isNumeric ? 'numeric' : undefined}
              value={inputVal}
              onChange={e =>
                setInputVal(isNumeric ? e.target.value.replace(/[^0-9.-]/g, '') : e.target.value)
              }
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  tryAdd(inputVal);
                }
                if (e.key === 'Backspace' && !inputVal && chips.length > 0 && !readOnly) {
                  onChipsChange(chips.slice(0, -1));
                }
              }}
            />
          )}
        </StyledChipList>
      </StyledChipWrapper>
      {showError && hasError && <ErrorSpan message='This field is required' />}
      {!readOnly && (
        <span
          style={{
            fontSize: '0.75rem',
            color: 'var(--app-secondary-text, #666)',
            marginTop: '4px',
            display: 'block'
          }}
        >
          Type a value and press Enter to add
        </span>
      )}
    </div>
  );
};

/** Thin component wrapper so ChipControl can snapshot initialLength via useState. */
const NestedArrayCell = ({
  value,
  spec,
  hasError,
  onFocus,
  onBlur,
  onChange
}: {
  value: string;
  spec: IdpFieldSpec;
  hasError: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onChange: (v: string) => void;
}): ReactElement => {
  const [initialLength] = useState(() => parseNestedArray(value).length);
  const chips = parseNestedArray(value);
  return (
    <ChipControl
      chips={chips}
      initialCount={initialLength}
      label={spec.label}
      isNumeric={spec.nestedItemType === 'number'}
      hasError={hasError}
      onFocus={onFocus}
      onBlur={onBlur}
      onChipsChange={newChips => onChange(JSON.stringify(newChips))}
    />
  );
};

interface RenderCellContext {
  validated: boolean;
  touchedCells: Set<string>;
  onFocus: (value: string) => void;
  onCommit: (rowIdx: number, spec: IdpFieldSpec) => void;
  onChange: (rowIdx: number, fieldKey: string, val: string) => void;
  onFieldFocus?: (info: FieldFocusInfo) => void;
  repeatableLabel?: string;
  allRows: Array<Record<string, string>>;
}

function renderRepeatableCell(
  spec: IdpFieldSpec,
  value: string,
  rowIdx: number,
  ctx: RenderCellContext
): ReactElement {
  if (!spec.editable)
    return (
      // Read-only cells aren't focusable, so a click triggers the bounding-box highlight.
      <span
        style={{ cursor: 'pointer' }}
        onClick={() =>
          ctx.onFieldFocus?.({
            type: 'repeatable-table',
            repeatableFieldName: ctx.repeatableLabel,
            columnFieldName: spec.fieldKey,
            rowIndex: rowIdx,
            value
          })
        }
      >
        {spec.isNestedArray ? parseNestedArray(value).join(', ') || '—' : value || '—'}
      </span>
    );

  const cellKey = `${rowIdx}_${spec.fieldKey}`;
  const shouldValidate = ctx.validated || ctx.touchedCells.has(cellKey);
  let cellIsEmpty: boolean;
  if (spec.displayType === 'checkbox') cellIsEmpty = value !== 'true';
  else if (spec.isNestedArray)
    cellIsEmpty = parseNestedArray(value).filter(v => v.trim()).length === 0;
  else cellIsEmpty = !value.trim();
  const cellHasError = shouldValidate && spec.required && cellIsEmpty;

  const onFocus = () => {
    ctx.onFocus(value);
    const focusInfo: FieldFocusInfo = {
      type: 'repeatable-table',
      repeatableFieldName: ctx.repeatableLabel,
      columnFieldName: spec.fieldKey,
      rowIndex: rowIdx,
      value
    };
    console.log('[IDP] Repeatable-table column focused:', focusInfo);
    ctx.onFieldFocus?.(focusInfo);
  };
  const onBlur = () => ctx.onCommit(rowIdx, spec);
  const onChange = (val: string) => ctx.onChange(rowIdx, spec.fieldKey, val);
  const errSpan = cellHasError ? <ErrorSpan message='Required' /> : null;

  if (spec.isNestedArray) {
    return (
      <>
        <NestedArrayCell
          value={value}
          spec={spec}
          hasError={!!cellHasError}
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={onChange}
        />
        {errSpan}
      </>
    );
  }

  if (spec.displayType === 'checkbox') {
    return (
      <input
        type='checkbox'
        checked={value === 'true'}
        aria-label={spec.label}
        data-idp-field-error={cellHasError || undefined}
        style={cellHasError ? { outline: '2px solid #c00' } : undefined}
        onChange={e => onChange(String(e.target.checked))}
      />
    );
  }

  const sp = {
    'aria-label': spec.label,
    'data-idp-field-error': cellHasError || undefined,
    style: cellHasError ? { borderColor: '#c00' } : undefined,
    onFocus,
    onBlur
  };

  if (isDateField(spec)) {
    return (
      <>
        <input
          type={spec.displayType === 'date' ? 'date' : 'datetime-local'}
          value={toISOBySpec(value, spec)}
          {...sp}
          onChange={e => onChange(e.target.value)}
        />
        {errSpan}
      </>
    );
  }
  if (spec.displayType === 'textarea') {
    return (
      <>
        <textarea value={value} {...sp} onChange={e => onChange(e.target.value)} />
        {errSpan}
      </>
    );
  }
  if (spec.displayType === 'radio') {
    return (
      <>
        <select value={value} {...sp} onChange={e => onChange(e.target.value)}>
          <option value=''>Select…</option>
          {spec.options?.map(opt => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        {errSpan}
      </>
    );
  }
  const inputType =
    ({ number: 'text', email: 'email', url: 'url' } as Record<string, string>)[spec.displayType] ??
    'text';
  const extraProps =
    spec.displayType === 'number'
      ? { inputMode: 'numeric' as const, pattern: '[0-9]*.?[0-9]*' }
      : {};
  return (
    <>
      <input
        type={inputType}
        value={value}
        {...sp}
        onChange={e => onChange(e.target.value)}
        {...extraProps}
      />
      {errSpan}
    </>
  );
}

// ─── RepeatableRender ─────────────────────────────────────────────────────────

function getDuplicateRowIndices(rowValues: Array<Record<string, string>>): Set<number> {
  return new Set<number>(
    rowValues.reduce<number[]>((acc, row, idx) => {
      const key = JSON.stringify(row);
      const firstIdx = rowValues.findIndex(r => JSON.stringify(r) === key);
      if (
        firstIdx !== idx &&
        rowValues.some((other, i) => i !== idx && JSON.stringify(other) === key)
      )
        acc.push(idx);
      return acc;
    }, [])
  );
}

/** Inline error shown when a required repeatable has no rows/items. */
const RepeatableEmptyError = ({ isTable = false }: { isTable?: boolean }): ReactElement => (
  <ErrorSpan
    message={
      isTable ? 'At least one row is required to be populated' : 'At least one item is required'
    }
  />
);

export interface RepeatableRenderProps {
  children?: never;
  fieldSpecs: IdpFieldSpec[];
  rows: Array<Record<string, string>>;
  onFieldChange?: (spec: IdpFieldSpec, prev: string, next: string) => void;
  onLiveRowsChange?: (rows: Array<Record<string, string>>) => void;
  validated?: boolean;
  readOnlyMode?: boolean;
  /** When true, at least one row/chip is required; shows inline error if empty. */
  required?: boolean;
  label?: string;
  onFieldFocus?: (info: FieldFocusInfo) => void;
}

/** Chip control for primitive (single-value) repeatable arrays. */
/** Repeatable group rendered as an editable table. */
export const RepeatableRender = ({
  fieldSpecs,
  rows,
  onFieldChange,
  onLiveRowsChange,
  validated = false,
  readOnlyMode = false,
  required = false,
  label,
  onFieldFocus
}: RepeatableRenderProps): ReactElement => {
  const orderedSpecs = sortByOrder(fieldSpecs).map(f =>
    readOnlyMode ? { ...f, editable: false } : f
  );

  // rowValues: live edit state seeded from the rows prop
  const [rowValues, setRowValues] = useState<Array<Record<string, string>>>(() =>
    (rows ?? []).map(r => ({ ...r }))
  );

  const [initialRowCount, setInitialRowCount] = useState<number>(() => (rows ?? []).length);
  const [touchedCells, setTouchedCells] = useState<Set<string>>(new Set());

  // Sync state when rows prop changes (e.g. document switch)
  const prevRowsRef = useRef(rows);
  useEffect(() => {
    if (rows !== prevRowsRef.current) {
      prevRowsRef.current = rows;
      const normalized = (rows ?? []).map(r => ({ ...r }));
      setRowValues(normalized);
      setInitialRowCount(normalized.length);
      setTouchedCells(new Set());
    }
  }, [rows]);

  const onLiveRowsChangeRef = useRef(onLiveRowsChange);
  onLiveRowsChangeRef.current = onLiveRowsChange;
  useEffect(() => {
    onLiveRowsChangeRef.current?.(rowValues);
  }, [rowValues]);

  // Sync refs keep handleCommit accurate when onBlur fires before React flushes
  const focusValueRef = useRef<string>('');
  const focusRowsRef = useRef<Array<Record<string, string>>>([]);
  const currentEditValueRef = useRef<string>('');
  const currentEditKeyRef = useRef<{ rowIdx: number; fieldKey: string } | null>(null);

  const handleChange = (rowIdx: number, fieldKey: string, val: string) => {
    currentEditValueRef.current = val;
    currentEditKeyRef.current = { rowIdx, fieldKey };
    setRowValues(prev => prev.map((row, i) => (i === rowIdx ? { ...row, [fieldKey]: val } : row)));
  };

  const handleCommit = (rowIdx: number, spec: IdpFieldSpec) => {
    setTouchedCells(prev => new Set(prev).add(`${rowIdx}_${spec.fieldKey}`));
    const { normPrev, normNext, rawNext, isDate, focusPrev } = resolveRepeatableCellCommit(
      rowIdx,
      spec,
      focusValueRef.current,
      focusRowsRef.current,
      currentEditKeyRef.current,
      currentEditValueRef.current
    );
    if (normPrev === normNext) return;
    const { formattedNext, prevRowsForAudit } = resolveCommitAudit(
      rowIdx,
      initialRowCount,
      spec,
      normNext,
      rawNext,
      isDate,
      focusPrev,
      focusRowsRef.current
    );
    const nextRows = focusRowsRef.current.map((r, i) =>
      i === rowIdx ? { ...r, [spec.fieldKey]: formattedNext } : r
    );
    onFieldChange?.(
      spec,
      JSON.stringify(serializeRepeatableRows(prevRowsForAudit, orderedSpecs)),
      JSON.stringify(serializeRepeatableRows(nextRows, orderedSpecs))
    );
    if (isDate) {
      setRowValues(curr =>
        curr.map((r, i) => (i === rowIdx ? { ...r, [spec.fieldKey]: formattedNext } : r))
      );
    }
  };

  const handleAddRow = () =>
    setRowValues(prev => [
      ...prev,
      Object.fromEntries(orderedSpecs.map(s => [s.fieldKey, s.isNestedArray ? '[]' : '']))
    ]);

  const handleDeleteRow = (rowIdx: number) => {
    fireDeleteRowChangeIfNeeded(orderedSpecs[0], rowIdx, rowValues, orderedSpecs, onFieldChange);
    setRowValues(prev => prev.filter((_, i) => i !== rowIdx));
    // keep initialRowCount accurate so re-added rows are not mistaken for original rows
    setInitialRowCount(prev => Math.max(0, prev - Number(rowIdx < prev)));
  };

  // Indices of rows that are exact duplicates of an earlier row
  const duplicateRowIndices = getDuplicateRowIndices(rowValues);

  const renderCell = (spec: IdpFieldSpec, value: string, rowIdx: number): ReactElement =>
    renderRepeatableCell(spec, value, rowIdx, {
      validated,
      touchedCells,
      onFocus: (val: string) => {
        focusValueRef.current = val;
        currentEditValueRef.current = val;
        currentEditKeyRef.current = null;
        focusRowsRef.current = rowValues.map(r => ({ ...r }));
      },
      onCommit: handleCommit,
      onChange: handleChange,
      onFieldFocus,
      repeatableLabel: label,
      allRows: rowValues
    });

  // true when the repeatable itself or any column field is required
  const effectiveRequired = required || orderedSpecs.some(s => s.required);
  // tracks whether the user has interacted with the chip control (for early inline error)
  const [chipTouched, setChipTouched] = useState(false);

  // Primitive array (single-field repeatable): render as chip control instead of a table
  if (orderedSpecs.length === 1 && !orderedSpecs[0].isNestedArray) {
    const spec = orderedSpecs[0];
    const chips = rowValues.map(r => r[spec.fieldKey] ?? '');
    const chipsEmpty = chips.filter(c => c.trim()).length === 0;
    // inline error: show after the user has interacted (chipTouched) OR after Save
    const chipInlineError = (chipTouched || validated) && effectiveRequired && chipsEmpty;
    return (
      <ChipControl
        chips={chips}
        initialCount={initialRowCount}
        label={spec.label}
        isNumeric={spec.valueType === 'number'}
        hasError={chipInlineError}
        readOnly={readOnlyMode}
        required={effectiveRequired}
        bordered
        showLabel
        showError
        onFocus={() =>
          onFieldFocus?.({
            type: 'primitive-chip',
            fieldName: spec.fieldKey,
            value: JSON.stringify(chips)
          })
        }
        onChipSelect={(chipValue, chipIndex) => {
          const focusInfo: FieldFocusInfo = {
            type: 'primitive-chip',
            fieldName: spec.fieldKey,
            value: chipValue,
            rowIndex: chipIndex
          };
          console.log('[IDP] Chip selected:', focusInfo);
          onFieldFocus?.(focusInfo);
        }}
        onBlur={() => setChipTouched(true)}
        onChipsChange={newChips => {
          setChipTouched(true);
          const added = newChips.length > chips.length;
          const nextRows = newChips.map(v => ({ [spec.fieldKey]: v }));
          if (added) {
            onFieldChange?.(
              spec,
              JSON.stringify(serializeRepeatableRows(rowValues, orderedSpecs)),
              JSON.stringify(serializeRepeatableRows(nextRows, orderedSpecs))
            );
          } else {
            const firstMismatch = chips.findIndex((chip, i) => chip !== newChips[i]);
            const deletedIdx = firstMismatch >= 0 ? firstMismatch : chips.length - 1;
            handleDeleteRow(deletedIdx);
            return;
          }
          setRowValues(nextRows);
        }}
      />
    ) as ReactElement;
  }

  // only multi-column tables show the "at least one row" inline message
  const tableIsEmpty =
    validated && effectiveRequired && rowValues.length === 0 && orderedSpecs.length > 1;

  return (
    <>
      <StyledRepeatableTableWrapper>
        <StyledRepeatableTable>
          <thead>
            <tr>
              {orderedSpecs.map(spec => (
                <th key={spec.fieldKey}>
                  {spec.label}
                  {!readOnlyMode && spec.required && <StyledRequiredMark>*</StyledRequiredMark>}
                </th>
              ))}
              <th aria-label='Actions' style={{ width: '2.5rem' }} />
            </tr>
          </thead>
          <tbody>
            {rowValues.length === 0 ? (
              <tr>
                <td
                  colSpan={orderedSpecs.length + 1}
                  style={{ textAlign: 'center', padding: '12px' }}
                >
                  <Text variant='secondary'>No items. Use the button below to add a row.</Text>
                </td>
              </tr>
            ) : (
              rowValues.map((row, rowIdx) => (
                // eslint-disable-next-line react/no-array-index-key
                <tr key={rowIdx}>
                  {orderedSpecs.map(spec => (
                    <td key={spec.fieldKey}>
                      {renderCell(spec, row[spec.fieldKey] ?? '', rowIdx)}
                      {duplicateRowIndices.has(rowIdx) && spec === orderedSpecs[0] && (
                        <ErrorSpan message='Duplicate row — each row must be unique' />
                      )}
                    </td>
                  ))}
                  <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                    {!readOnlyMode && (
                      <Button
                        variant='simple'
                        compact
                        icon
                        aria-label='Delete row'
                        onClick={() => handleDeleteRow(rowIdx)}
                      >
                        <Icon name='trash' />
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </StyledRepeatableTable>
      </StyledRepeatableTableWrapper>
      {!readOnlyMode && (
        <div style={{ marginTop: '8px' }}>
          <Button variant='link' compact onClick={handleAddRow}>
            <Icon name='plus' />
            Add row
          </Button>
        </div>
      )}
      {tableIsEmpty && <RepeatableEmptyError isTable />}
    </>
  ) as ReactElement;
};

export default DetailsRender;
