import { useState, useCallback } from 'react';
import { withConfiguration } from '@pega/cosmos-react-core';
import type { PConnFieldProps } from './PConnProps';
import './create-nonce';
import StyledCitiExtensionsAccordionWidgetWrapper from './styles';

// ── Types ──────────────────────────────────────────────────────────────────────
interface CitiExtensionsAccordionWidgetProps extends PConnFieldProps {
  title?: string;
  subtitle?: string;
  /** Comma-separated panel labels e.g. "Personal Info,Account,Security" */
  panelLabels?: string;
  /** Comma-separated hint texts matching the same order (leave blank entries empty) */
  panelTooltips?: string;
  /**
   * One entry per view/section added in the App Studio CONTENTPICKER.
   * Each entry becomes the body of one accordion panel.
   */
  children?: any[];
}

// ── Inline SVG icons (placeholder — swap for Pega icons later) ────────────────
/** Radio button — unselected */
const RadioUncheckedIcon = () => (
  <svg width='16' height='16' viewBox='0 0 16 16' fill='none' aria-hidden='true'>
    <circle cx='8' cy='8' r='6.5' stroke='currentColor' strokeWidth='1.6' />
  </svg>
);

/** Radio button — selected */
const RadioCheckedIcon = () => (
  <svg width='16' height='16' viewBox='0 0 16 16' fill='none' aria-hidden='true'>
    <circle cx='8' cy='8' r='6.5' stroke='currentColor' strokeWidth='1.6' />
    <circle cx='8' cy='8' r='3.5' fill='currentColor' />
  </svg>
);

/** Chevron pointing down (collapsed — click to expand) */
const ChevronRightIcon = () => (
  <svg width='14' height='14' viewBox='0 0 14 14' fill='none' aria-hidden='true'>
    <path d='M3 5L7 9L11 5' stroke='currentColor' strokeWidth='1.7'
      strokeLinecap='round' strokeLinejoin='round' />
  </svg>
);

/** Chevron pointing up (expanded — click to collapse) */
const ChevronDownIcon = () => (
  <svg width='14' height='14' viewBox='0 0 14 14' fill='none' aria-hidden='true'>
    <path d='M3 9L7 5L11 9' stroke='currentColor' strokeWidth='1.7'
      strokeLinecap='round' strokeLinejoin='round' />
  </svg>
);

/** Double-chevron expand (used in the "Expand all" button) */
const ExpandIcon = () => (
  <svg width='14' height='14' viewBox='0 0 14 14' fill='none' aria-hidden='true'>
    <path d='M2 5.5L7 10.5L12 5.5' stroke='currentColor' strokeWidth='1.6'
      strokeLinecap='round' strokeLinejoin='round' />
    <path d='M2 2.5L7 7.5L12 2.5' stroke='currentColor' strokeWidth='1.6'
      strokeLinecap='round' strokeLinejoin='round' opacity='0.45' />
  </svg>
);

/** Double-chevron collapse (used in the "Collapse all" button) */
const CollapseIcon = () => (
  <svg width='14' height='14' viewBox='0 0 14 14' fill='none' aria-hidden='true'>
    <path d='M2 8.5L7 3.5L12 8.5' stroke='currentColor' strokeWidth='1.6'
      strokeLinecap='round' strokeLinejoin='round' />
    <path d='M2 11.5L7 6.5L12 11.5' stroke='currentColor' strokeWidth='1.6'
      strokeLinecap='round' strokeLinejoin='round' opacity='0.45' />
  </svg>
);

// ── Pega region renderer ──────────────────────────────────────────────────────
function PegaRegion({ child }: { child: any }) {
  if (!child) {
    return (
      <p className='accordion-region-empty'>
        No fields configured. Add fields via the Content Picker in App Studio.
      </p>
    );
  }
  // Render the child element directly — Pega manages its own context.
  return <>{child}</>;
}

// ── Single accordion panel ────────────────────────────────────────────────────
function AccordionPanel({
  label, tooltip, isOpen, isSelected, isLast, onToggle, onSelect, child,
}: {
  label: string; tooltip?: string;
  isOpen: boolean; isSelected: boolean; isLast: boolean;
  onToggle: () => void; onSelect: () => void;
  child: any;
}) {
  return (
    <div className='accordion-panel' data-is-last={isLast}>
      {/* ── Header row ── */}
      <div className='accordion-panel__header' data-open={isOpen}>
        {/* Radio icon — clicking this SELECTS this option (radio behaviour) */}
        <button
          type='button'
          role='radio'
          aria-checked={isSelected}
          aria-label={`Select ${label}`}
          onClick={onSelect}
          className='accordion-panel__radio'
        >
          {isSelected ? <RadioCheckedIcon /> : <RadioUncheckedIcon />}
        </button>

        {/* Header area — clicking this EXPANDS/COLLAPSES the panel */}
        <button
          type='button'
          aria-expanded={isOpen}
          onClick={onToggle}
          className='accordion-panel__toggle'
        >
          <span className='accordion-panel__label'>{label}</span>
          <span className='accordion-panel__chevron'>
            {isOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </span>
        </button>
      </div>

      {/* ── Body (CSS height animation) ── */}
      <div className='accordion-panel__collapse' data-open={isOpen}>
        <div className='accordion-panel__collapse-inner'>
          <div className='accordion-panel__body'>
            {tooltip && (
              <p className='accordion-panel__tooltip'>{tooltip}</p>
            )}
            <PegaRegion child={child} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
function CitiExtensionsAccordionWidget(props: CitiExtensionsAccordionWidgetProps) {
  const {
    getPConnect,
    title           = 'Options',
    subtitle        = '',
    panelLabels     = '',
    panelTooltips   = '',
    children        = [],
  } = props;

  // Split comma-separated strings into arrays, trim whitespace
  const labels   = panelLabels.split(',').map(s => s.trim());
  const tooltips = panelTooltips.split(',').map(s => s.trim());

  // Pega passes ONE wrapper child for the CONTENTPICKER. Its pConn.getChildren()
  // returns each view/section the author added, in order. We use those as the
  // per-panel bodies. In Storybook, `children` is already an array of plain
  // React elements so we use it directly.
  const pickedViews: any[] = (() => {
    // Storybook path — children is already a plain array of React elements
    if (children.length > 1 || (children[0] && !children[0]?.props?.getPConnect)) {
      return children;
    }
    // Pega path — extract individual views from the wrapper child
    const wrapper = children[0];
    if (!wrapper?.props?.getPConnect) return [];
    try {
      const pConn = wrapper.props.getPConnect();
      const kids = pConn.getChildren?.() ?? [];
      return kids.map((kid: any) => kid.getPConnect?.().getComponent?.()).filter(Boolean);
    } catch {
      return [wrapper];
    }
  })();

  // Number of panels is driven by the label count. Each panel maps to one
  // picked view (in order). Panels without a matching view still render with
  // the "No fields configured" placeholder.
  const rows = labels
    .map((label, i) => ({
      label,
      tooltip: tooltips[i] ?? '',
      child:   pickedViews[i] ?? null,
    }))
    .filter(row => row.label !== '');

  // Two independent pieces of state:
  //  • selectedIndex — the picked radio option (only one at a time, or none)
  //  • openSet       — which panels are expanded (any number, independent)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [openSet, setOpenSet] = useState<Set<number>>(new Set());

  const toggle = useCallback((i: number) => {
    setOpenSet(prev => {
      const next = new Set(prev);
      if (next.has(i)) { next.delete(i); } else { next.add(i); }
      return next;
    });
  }, []);

  const select = useCallback((i: number) => {
    setSelectedIndex(prev => (prev === i ? null : i));
    // Also expand the selected panel so the user sees its content
    setOpenSet(prev => {
      const next = new Set(prev);
      next.add(i);
      return next;
    });
  }, []);

  const allOpen = rows.length > 0 && openSet.size === rows.length;

  const toggleAll = () => {
    if (allOpen) {
      setOpenSet(new Set());
    } else {
      setOpenSet(new Set(rows.map((_, i) => i)));
    }
  };

  // Render nothing at all when there's no title AND no valid panels —
  // keeps the canvas clean before the author has configured anything.
  if (!title?.trim() && rows.length === 0) {
    return null;
  }

  return (
    <StyledCitiExtensionsAccordionWidgetWrapper>
      <div className='accordion-root'>

        {/* ── Header row ── */}
        <div className='accordion-header'>
          <div>
            {title && (
              <div className='accordion-header__title'>{title}</div>
            )}
            {subtitle && (
              <div className='accordion-header__subtitle'>{subtitle}</div>
            )}
          </div>

          {/* Expand all / Collapse all toggle */}
          {rows.length > 0 && (
            <button
              type='button'
              onClick={toggleAll}
              className='accordion-ghost-btn'
            >
              {allOpen ? <CollapseIcon /> : <ExpandIcon />}
              {allOpen ? 'Collapse all' : 'Expand all'}
            </button>
          )}
        </div>

        {/* ── Accordion list ── */}
        {rows.length === 0 ? (
          <div className='accordion-empty'>
            No accordion panels to display.<br />
            In App Studio, provide a <strong>Panel label</strong> and add fields via the <strong>Content Picker</strong>.
          </div>
        ) : (
          <div
            role='radiogroup'
            aria-label={title || 'Accordion options'}
            className='accordion-list'
          >
            {rows.map((row, i) => (
              <AccordionPanel
                key={row.label || `panel-${i}`}
                label={row.label}
                tooltip={row.tooltip}
                isOpen={openSet.has(i)}
                isSelected={selectedIndex === i}
                isLast={i === rows.length - 1}
                onToggle={() => toggle(i)}
                onSelect={() => select(i)}
                child={row.child}
              />
            ))}
          </div>
        )}
      </div>
    </StyledCitiExtensionsAccordionWidgetWrapper>
  );
}

export default withConfiguration(CitiExtensionsAccordionWidget);
