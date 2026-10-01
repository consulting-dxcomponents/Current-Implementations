import { useState } from 'react';
import { Button, FieldValueList, withConfiguration } from '@pega/cosmos-react-core';

import type { PConnFieldProps } from './PConnProps';
import './create-nonce';

import StyledPegaFieldMaskedWithEyeInputWrapper from './styles';

// ─── Icons ────────────────────────────────────────────────────────────────────

const EyeIcon = () => (
  <svg
    width='16'
    height='16'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' />
    <circle cx='12' cy='12' r='3' />
  </svg>
);

const EyeOffIcon = () => (
  <svg
    width='16'
    height='16'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <path d='M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24' />
    <line x1='1' y1='1' x2='23' y2='23' />
  </svg>
);

// ─── Props ────────────────────────────────────────────────────────────────────

interface PegaFieldMaskedWithEyeInputProps extends PConnFieldProps {
  defaultMasked?: boolean;
  /**
   * Number of trailing characters to leave visible while masked.
   * Defaults to `4`.
   */
  visibleChars?: number;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Masks all characters except the last `visibleChars`.
 * If the value is shorter than or equal to `visibleChars`, it is returned as-is.
 */
function buildMaskedDisplay(value: string, visibleChars: number): string {
  if (!value) return '';
  if (value.length <= visibleChars) return value;
  return '*'.repeat(value.length - visibleChars) + value.slice(-visibleChars);
}

// ─── Component ────────────────────────────────────────────────────────────────
//
// READ-ONLY display field. The Pega property value is never mutated;
// the eye icon only toggles a local display state between a masked string and
// the original value. Rendering uses Cosmos primitives (FieldValueList +
// Button) so every aspect of styling is inherited from the platform theme.

function PegaFieldMaskedWithEyeInput(props: PegaFieldMaskedWithEyeInputProps) {
  const {
    value,
    disabled = false,
    label,
    hideLabel = true,
    testId,
    defaultMasked = true,
    visibleChars = 4
  } = props;

  const [isTextMasked, setIsTextMasked] = useState(defaultMasked);

  const stringValue = String(value ?? '');
  const maskedDisplay = buildMaskedDisplay(stringValue, visibleChars);
  const displayValue = isTextMasked ? maskedDisplay : stringValue;

  const toggleMasking = () => {
    setIsTextMasked(prev => !prev);
  };

  // The value + eye-toggle pair rendered as the right-hand side of a
  // FieldValueList row (or on its own when the label is hidden).
  const valueWithToggle = (
    <div className='masked-value-row'>
      <span data-testid={testId}>{displayValue}</span>
      <Button
        variant='simple'
        compact
        icon
        aria-pressed={!isTextMasked}
        onClick={toggleMasking}
        disabled={disabled}
      >
        {isTextMasked ? <EyeIcon /> : <EyeOffIcon />}
      </Button>
    </div>
  );

  return (
    <StyledPegaFieldMaskedWithEyeInputWrapper>
      {hideLabel || !label ? (
        valueWithToggle
      ) : (
        <FieldValueList
          variant='inline'
          fields={[{ id: '1', name: label, value: valueWithToggle }]}
        />
      )}
    </StyledPegaFieldMaskedWithEyeInputWrapper>
  );
}

export default withConfiguration(PegaFieldMaskedWithEyeInput);
