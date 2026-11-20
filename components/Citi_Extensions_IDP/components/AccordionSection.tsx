import type { ReactNode } from 'react';
import { FieldGroup, Icon } from '@pega/cosmos-react-core';
import { StyledFieldGroupWrapper } from '../styles';

export interface AccordionSectionProps {
  label: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  hasError?: boolean;
  errorCount?: number;
  additionalInfo?: string | JSX.Element;
  /** Rendered inline beside the label text in the accordion header. */
  labelExtra?: ReactNode;
  /** When provided, a thick left border in this colour is applied to the section wrapper. */
  confidenceBorderColor?: string;
  children: ReactNode;
}

/**
 * Controlled wrapper around Cosmos FieldGroup — collapse state is owned by
 * the parent so the "Expand all / Collapse all" toggle can drive every section.
 * When `hasError` is true an amber warn-solid icon is shown in the header.
 */
export default function AccordionSection({
  label,
  collapsed,
  onToggleCollapsed,
  hasError = false,
  errorCount = 0,
  additionalInfo,
  labelExtra,
  confidenceBorderColor,
  children
}: AccordionSectionProps) {
  return (
    // data-has-error drives the CSS rule in StyledFieldGroupWrapper that turns
    // the action button into a plain red icon (non-interactive).
    <StyledFieldGroupWrapper
      data-has-error={hasError ? true : undefined}
      style={
        confidenceBorderColor ? { borderLeft: `4px solid ${confidenceBorderColor}` } : undefined
      }
    >
      <FieldGroup
        // @ts-ignore — Cosmos FieldGroup.name accepts ReactNode at runtime
        name={
          labelExtra || hasError ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {label}
              {labelExtra}
              {hasError && (
                <span
                  // data-idp-error-badge is targeted by StyledFieldGroupWrapper
                  // CSS to forcefully stop Cosmos's caret-rotation rule from
                  // rotating this Icon (Cosmos applies transform to all
                  // StyledIcon descendants of its expand button, which
                  // includes our badge because `name` renders inside it).
                  data-idp-error-badge
                  aria-label={`${errorCount} required field${
                    errorCount !== 1 ? 's' : ''
                  } incomplete`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    color: '#c30b16',
                    fontSize: '0.75rem',
                    pointerEvents: 'none'
                  }}
                >
                  <Icon name='warn-solid' />
                  {errorCount}
                </span>
              )}
            </span>
          ) : (
            label
          )
        }
        collapsed={collapsed}
        onToggleCollapsed={onToggleCollapsed}
        additionalInfo={
          additionalInfo ? { content: additionalInfo as string | JSX.Element } : undefined
        }
      >
        {/* Padding wrapper so focus rings on edge inputs are not clipped by the
            ExpandCollapse overflow:hidden boundary during/after animation. */}
        <div style={{ padding: '4px 10px 10px' }}>{children}</div>
      </FieldGroup>
    </StyledFieldGroupWrapper>
  );
}
