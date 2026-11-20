import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  forwardRef,
  useImperativeHandle
} from 'react';
import { Flex, Grid, Button, Banner } from '@pega/cosmos-react-core';
import DetailsRender, { RepeatableRender } from './DetailsRender';
import type { FieldFocusInfo } from './DetailsRender';
import { getConfidenceBorderColor, validateFieldFormat } from '../utils/helpers';
import { buildRenderQueue } from '../idpTypes';
import type { DocumentSpec, IdpFieldSpec, IdpRepeatableSpec, RenderQueueEntry } from '../idpTypes';
import type { ConfidenceData } from '../schema/responseNormalizer';
import AccordionSection from './AccordionSection';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds the content for the AdditionalInfo popup on a repeatable accordion.
 * >2 columns: use the parent array description (spec.helpText) as a single string.
 * ≤2 columns with helpText: plain newline-separated individual field descriptions.
 * Falls back to individual descriptions if parent helpText is absent.
 */
function buildRepeatableAdditionalInfo(spec: IdpRepeatableSpec): string | JSX.Element | undefined {
  if (spec.fields.length > 1) {
    return spec.helpText || undefined;
  }
  const withHelp = spec.fields.filter((f: IdpFieldSpec) => f.helpText);
  if (withHelp.length === 0) return undefined;
  return withHelp.map((f: IdpFieldSpec) => f.helpText).join('\n');
}

// ─── Confidence colour key ────────────────────────────────────────────────────

function ConfidenceColorKey() {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '10px',
        fontSize: '0.73rem',
        color: '#555',
        padding: '6px 10px',
        background: '#f8f9fa',
        borderRadius: '4px',
        border: '1px solid #e0e0e0'
      }}
    >
      <span style={{ fontWeight: 600, marginRight: '2px' }}>Extracted confidence range:</span>
      {(
        [
          { color: '#16a34a', label: 'High', detail: 'score > 3' },
          { color: '#d97706', label: 'Medium', detail: 'score 2–3' },
          { color: '#dc2626', label: 'Low', detail: 'score ≤ 1' }
        ] as { color: string; label: string; detail: string }[]
      ).map(({ color, label, detail }) => (
        <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: color,
              display: 'inline-block',
              flexShrink: 0
            }}
          />
          <span>
            {label} <span style={{ color: '#888' }}>({detail})</span>
          </span>
        </span>
      ))}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ReviewPanelProps {
  idpSpec?: DocumentSpec;
  resolvedValues: Record<string, string>;
  repeatableRows: Record<string, Array<Record<string, string>>>;
  nCols: number;
  onFieldChange?: (sectionLabel: string, spec: IdpFieldSpec, prev: string, next: string) => void;
  onSave?: (
    fieldValues: Record<string, string>,
    rows: Record<string, Array<Record<string, string>>>
  ) => void;
  confidenceData?: ConfidenceData;
  showConfidenceScore?: boolean;
  readOnlyMode?: boolean;
  onFieldFocus?: (info: FieldFocusInfo) => void;
}

// ─── ReviewPanel ──────────────────────────────────────────────────────────────

/**
 * Spec-driven review panel.
 *
 * Uses buildRenderQueue(idpSpec) to merge sections and repeatables into a
 * single list sorted by their `order` property, then renders each entry:
 *
 *   section    → DetailsRender    (fieldSpecs + resolvedValues)
 *   repeatable → RepeatableRender (fieldSpecs + rows from repeatableRows)
 */
export interface ReviewPanelHandle {
  save: () => void;
}

const ReviewPanel = forwardRef<ReviewPanelHandle, ReviewPanelProps>(function ReviewPanel(
  {
    idpSpec,
    resolvedValues,
    repeatableRows,
    nCols,
    onFieldChange,
    onSave,
    confidenceData,
    showConfidenceScore,
    readOnlyMode = false,
    onFieldFocus
  },
  ref
) {
  const [validated, setValidated] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});
  const [currentFieldValues, setCurrentFieldValues] = useState<Record<string, string>>(() => ({
    ...resolvedValues
  }));
  const [currentRepeatableRows, setCurrentRepeatableRows] = useState<
    Record<string, Array<Record<string, string>>>
  >(() => ({ ...repeatableRows }));
  const [sectionFormatErrors, setSectionFormatErrors] = useState<Record<string, number>>({});

  const bannerRef = useRef<HTMLDivElement>(null);

  const prevResolvedRef = useRef(resolvedValues);
  useEffect(() => {
    if (resolvedValues !== prevResolvedRef.current) {
      prevResolvedRef.current = resolvedValues;
      setCurrentFieldValues({ ...resolvedValues });
    }
  }, [resolvedValues]);

  const prevRepeatableRowsRef = useRef(repeatableRows);
  useEffect(() => {
    if (repeatableRows !== prevRepeatableRowsRef.current) {
      prevRepeatableRowsRef.current = repeatableRows;
      setCurrentRepeatableRows({ ...repeatableRows });
    }
  }, [repeatableRows]);

  const renderQueue: RenderQueueEntry[] = useMemo(
    () => (idpSpec ? buildRenderQueue(idpSpec) : []),
    [idpSpec]
  );

  const totalFormatErrorCount = Object.values(sectionFormatErrors).reduce((a, b) => a + b, 0);

  const rawErrorCount = renderQueue.reduce((total, entry) => {
    if (entry.kind === 'section') {
      return (
        total +
        entry.spec.fields.filter(f => f.required && !(currentFieldValues[f.fieldKey] ?? '').trim())
          .length
      );
    }
    const repeatableKey = (entry.spec as { repeatableKey: string }).repeatableKey;
    const rows = currentRepeatableRows[repeatableKey] ?? [];
    const specRequired =
      (entry.spec as { required?: boolean }).required || entry.spec.fields.some(f => f.required);
    const emptyRepeatable = specRequired && rows.length === 0 ? 1 : 0;
    return (
      total +
      emptyRepeatable +
      rows.reduce(
        (rowTotal, row) =>
          rowTotal +
          entry.spec.fields.filter(f => f.required && !(row[f.fieldKey] ?? '').trim()).length,
        0
      )
    );
  }, 0);

  const totalErrorCount = validated ? rawErrorCount + totalFormatErrorCount : 0;

  useEffect(() => {
    if (showBanner && rawErrorCount === 0 && totalFormatErrorCount === 0) {
      setShowBanner(false);
      setValidated(false);
    }
  }, [showBanner, rawErrorCount, totalFormatErrorCount]);

  const handleSave = useCallback(() => {
    setCollapsedMap(prev => {
      const next = { ...prev };
      renderQueue.forEach(e => {
        const k = `${e.kind}-${e.order}-${e.spec.label}`;
        const hasFieldError =
          e.kind === 'section'
            ? e.spec.fields.some(
                f =>
                  (f.required && !(currentFieldValues[f.fieldKey] ?? '').trim()) ||
                  validateFieldFormat(f, currentFieldValues[f.fieldKey] ?? '') !== null
              )
            : (() => {
                const rKey = (e.spec as { repeatableKey: string }).repeatableKey;
                const rRows = currentRepeatableRows[rKey] ?? [];
                // expand if required repeatable is empty OR any required cell is blank
                const isEmpty =
                  ((e.spec as { required?: boolean }).required ||
                    e.spec.fields.some(f => f.required)) &&
                  rRows.length === 0;
                return (
                  isEmpty ||
                  rRows.some(row =>
                    e.spec.fields.some(f => f.required && !(row[f.fieldKey] ?? '').trim())
                  )
                );
              })();
        if (hasFieldError) next[k] = false;
      });
      return next;
    });

    setValidated(true);
    setShowBanner(true);
    if (rawErrorCount === 0 && totalFormatErrorCount === 0) {
      onSave?.(currentFieldValues, currentRepeatableRows);
    } else {
      // Scroll every ancestor back to the top so the validation banner is visible.
      setTimeout(() => {
        const el = bannerRef.current;
        if (!el) return;
        let node: HTMLElement | null = el.parentElement;
        while (node && node !== document.documentElement) {
          if (node.scrollTop > 0) node.scrollTop = 0;
          node = node.parentElement;
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 0);
    }
    requestAnimationFrame(() => {
      const firstError = document.querySelector<HTMLElement>(
        '[data-idp-field-error] input, [data-idp-field-error] textarea, ' +
          '[data-idp-field-error] select, ' +
          'input[data-idp-field-error], textarea[data-idp-field-error], ' +
          'select[data-idp-field-error]'
      );
      firstError?.focus();
    });
  }, [
    renderQueue,
    currentFieldValues,
    currentRepeatableRows,
    rawErrorCount,
    totalFormatErrorCount,
    onSave
  ]);

  useImperativeHandle(ref, () => ({ save: handleSave }), [handleSave]);

  if (!idpSpec || renderQueue.length === 0) {
    return null;
  }

  const allCollapsed =
    renderQueue.length > 0 &&
    renderQueue.every(e => collapsedMap[`${e.kind}-${e.order}-${e.spec.label}`] === true);

  const handleToggleAll = () => {
    const next = !allCollapsed;
    const updated: Record<string, boolean> = {};
    renderQueue.forEach(e => {
      updated[`${e.kind}-${e.order}-${e.spec.label}`] = next;
    });
    setCollapsedMap(updated);
  };

  const handleInternalFieldChange = (
    sectionLabel: string,
    spec: IdpFieldSpec,
    prev: string,
    next: string
  ) => {
    setCurrentFieldValues(cv => ({ ...cv, [spec.fieldKey]: next }));
    onFieldChange?.(sectionLabel, spec, prev, next);
  };

  const handleLiveFieldChange = (spec: IdpFieldSpec, value: string) => {
    setCurrentFieldValues(cv => ({ ...cv, [spec.fieldKey]: value }));
  };

  const sectionErrorCounts: Record<string, number> = validated
    ? Object.fromEntries(
        renderQueue.map(entry => {
          const key = `${entry.kind}-${entry.order}-${entry.spec.label}`;
          if (entry.kind === 'section') {
            const requiredCount = entry.spec.fields.filter(
              f => f.required && !(currentFieldValues[f.fieldKey] ?? '').trim()
            ).length;
            return [key, requiredCount + (sectionFormatErrors[key] ?? 0)];
          }
          const repeatableKey = (entry.spec as { repeatableKey: string }).repeatableKey;
          const rows = currentRepeatableRows[repeatableKey] ?? [];
          const specRequired =
            (entry.spec as { required?: boolean }).required ||
            entry.spec.fields.some(f => f.required);
          const emptyRepeatable = specRequired && rows.length === 0 ? 1 : 0;
          return [
            key,
            emptyRepeatable +
              rows.reduce(
                (t, row) =>
                  t +
                  entry.spec.fields.filter(f => f.required && !(row[f.fieldKey] ?? '').trim())
                    .length,
                0
              )
          ];
        })
      )
    : {};

  const hasConfidenceData =
    !!confidenceData &&
    (Object.keys(confidenceData.fields).length > 0 ||
      Object.keys(confidenceData.repeatables).length > 0);

  return (
    <Flex container={{ direction: 'column', rowGap: 2 }}>
      <div ref={bannerRef}>
        {showBanner && totalErrorCount > 0 && (
          <Banner
            variant='urgent'
            messages={[
              {
                label: 'Validation errors found',
                description: `${totalErrorCount} field${
                  totalErrorCount !== 1 ? 's have' : ' has'
                } errors that must be fixed before saving.`
              }
            ]}
            onDismiss={() => setShowBanner(false)}
          />
        )}
      </div>

      {renderQueue.length > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Button variant='link' compact onClick={handleToggleAll}>
            {allCollapsed ? 'Expand all' : 'Collapse all'}
          </Button>
        </div>
      )}

      {showConfidenceScore && hasConfidenceData && <ConfidenceColorKey />}

      {renderQueue
        .filter(
          (entry: RenderQueueEntry) => !(entry.kind === 'section' && entry.spec.fields.length === 0)
        )
        .map((entry: RenderQueueEntry) => {
          const entryKey = `${entry.kind}-${entry.order}-${entry.spec.label}`;
          const sectionLabel = entry.spec.label;

          const repeatableKey =
            entry.kind === 'repeatable' ? (entry.spec as IdpRepeatableSpec).repeatableKey : '';
          const repeatableConf = confidenceData?.repeatables[repeatableKey];
          const accordionConf =
            showConfidenceScore && typeof repeatableConf === 'number' ? repeatableConf : undefined;

          return (
            <AccordionSection
              key={entryKey}
              label={sectionLabel}
              collapsed={collapsedMap[entryKey] ?? false}
              hasError={(sectionErrorCounts[entryKey] ?? 0) > 0}
              errorCount={sectionErrorCounts[entryKey] ?? 0}
              confidenceBorderColor={
                accordionConf !== undefined ? getConfidenceBorderColor(accordionConf) : undefined
              }
              additionalInfo={
                entry.kind === 'repeatable'
                  ? buildRepeatableAdditionalInfo(entry.spec as IdpRepeatableSpec)
                  : undefined
              }
              onToggleCollapsed={() =>
                setCollapsedMap(prev => ({
                  ...prev,
                  [entryKey]: !(prev[entryKey] ?? false)
                }))
              }
            >
              <Grid
                // @ts-ignore
                container={{ cols: `repeat(${nCols}, minmax(0, 1fr))`, gap: 2 }}
              >
                {entry.kind === 'repeatable' ? (
                  <RepeatableRender
                    fieldSpecs={entry.spec.fields}
                    rows={
                      repeatableRows[(entry.spec as { repeatableKey: string }).repeatableKey] ?? []
                    }
                    validated={validated}
                    readOnlyMode={readOnlyMode}
                    required={(entry.spec as { required?: boolean }).required}
                    label={entry.spec.label}
                    onFieldFocus={onFieldFocus}
                    onFieldChange={(spec: IdpFieldSpec, prev: string, next: string) =>
                      handleInternalFieldChange(sectionLabel, spec, prev, next)
                    }
                    onLiveRowsChange={rows => {
                      const key = (entry.spec as { repeatableKey: string }).repeatableKey;
                      setCurrentRepeatableRows(prev => ({ ...prev, [key]: rows }));
                    }}
                  />
                ) : (
                  <DetailsRender
                    fieldSpecs={entry.spec.fields}
                    resolvedValues={resolvedValues}
                    validated={validated}
                    readOnlyMode={readOnlyMode}
                    fieldConfidence={showConfidenceScore ? confidenceData?.fields : undefined}
                    onFormatErrorCountChange={(count: number) => {
                      const k = `${entry.kind}-${entry.order}-${entry.spec.label}`;
                      setSectionFormatErrors(prev => ({ ...prev, [k]: count }));
                    }}
                    onFieldFocus={onFieldFocus}
                    onFieldChange={(spec: IdpFieldSpec, prev: string, next: string) =>
                      handleInternalFieldChange(sectionLabel, spec, prev, next)
                    }
                    onLiveChange={(spec: IdpFieldSpec, value: string) =>
                      handleLiveFieldChange(spec, value)
                    }
                  />
                )}
              </Grid>
            </AccordionSection>
          );
        })}
    </Flex>
  );
});

export default ReviewPanel;
