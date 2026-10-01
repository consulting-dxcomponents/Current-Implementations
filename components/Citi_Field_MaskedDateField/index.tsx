import { useEffect, useState } from 'react';
import { DateInput, FieldValueList, DateTimeDisplay, Text, withConfiguration } from '@pega/cosmos-react-core';
import FormattedText from "./FormattedText";

import type { PConnFieldProps } from './PConnProps';
import './create-nonce';

import StyledPegaFieldMaskedDateFieldWrapper from './styles';

// includes in bundle
import {
  datetimedisplayformatter,
  formatExists,
  getFullYear,
  getMaxDate,
  getMinDate,
  datetimeFireChangeBlurEvents,
  getDateFormat
} from "./date";
import type { DateTimeFormat, DateTimeVariant } from '@pega/cosmos-react-core/lib/components/DateTime/DateTime.types.js';

// ─── Eye icons ────────────────────────────────────────────────────────────────

const EyeIcon = () => (
  <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
    <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' />
    <circle cx='12' cy='12' r='3' />
  </svg>
);

const EyeOffIcon = () => (
  <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
    <path d='M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24' />
    <line x1='1' y1='1' x2='23' y2='23' />
  </svg>
);

// ─── Masking helper ───────────────────────────────────────────────────────────

/**
 * Masks all digit characters except the last `visibleChars` digits,
 * preserving date separators (-, /, .) so the format stays recognisable.
 * e.g. "2023-01-31" with visibleChars=4 becomes "****-**-31"
 */
function buildMaskedDate(value: string, visibleChars: number): string {
  if (!value) return '';
  const dateOnly = value.includes('T') ? value.substring(0, value.indexOf('T')) : value;
  if (visibleChars <= 0) return dateOnly.replace(/[0-9]/g, '*');
  if (dateOnly.length <= visibleChars) return dateOnly;

  const digits = dateOnly.replace(/[^0-9]/g, '');
  let revealCount = Math.min(visibleChars, digits.length);

  let result = '';
  for (let i = dateOnly.length - 1; i >= 0; i--) {
    const ch = dateOnly[i];
    if (/[0-9]/.test(ch)) {
      result = (revealCount > 0 ? ch : '*') + result;
      if (revealCount > 0) revealCount--;
    } else {
      result = ch + result;
    }
  }
  return result;
}

// interface for props
interface PegaFieldMaskedDateFieldProps extends PConnFieldProps {
  // If any, enter additional props that only exist on TextInput here
  displayAsStatus?: boolean;
  isTableFormatter?: boolean;
  hasSuggestions?: boolean;
  variant?: any;
  formatter?: string;
  withSeconds: boolean;
  nextYearRange: string;
  previousYearRange: string;
  showWeekNumber: boolean;
  showAsFormattedText: boolean;
  /** Whether the date starts masked on initial render. Defaults to true. */
  defaultMasked?: boolean;
  /** Number of trailing date digits to leave visible when masked. Defaults to 4. */
  visibleChars?: number;
}

// interface for StateProps object
interface StateProps {
  value: string;
  hasSuggestions: boolean;
}

interface ConfigProps {
  formatter?: string | undefined;
}

interface ActionsProps {
  onFocus: any;
}

// Duplicated runtime code from Constellation Design System Component

// props passed in combination of props from property panel (config.json) and run time props from Constellation
// any default values in config.pros should be set in defaultProps at bottom of this file
function PegaFieldMaskedDateField (props: PegaFieldMaskedDateFieldProps)  {
  const {
    getPConnect,
    value,
    validatemessage,
    label,
    hideLabel = false,
    helperText = '',
    nextYearRange,
    previousYearRange,
    showWeekNumber = false,
    testId,
    showAsFormattedText = false,
    additionalProps = {},
    displayMode,
    variant = 'inline',
    hasSuggestions = false,
    defaultMasked = true,
    visibleChars = 4
   } = props;

  let {formatter = 'defaultDate' } = props;
  const pConn = getPConnect();
  const actions = pConn.getActionsApi();
  const actionsProps = pConn.getActionsApi() as unknown as ActionsProps;
  const stateProps = pConn.getStateProps() as StateProps;
  const propName: string = stateProps.value;

 let { readOnly = false, required = false, disabled = false } = props;
  [readOnly, required, disabled] = [readOnly, required, disabled].map(
    (prop) => prop === true || (typeof prop === "string" && prop === "true")
  );

  const [status, setStatus] = useState(hasSuggestions ? 'pending' : '');
  const [isTextMasked, setIsTextMasked] = useState(defaultMasked);

  // cast status
  let myStatus: 'success' | 'warning' | 'error' | 'pending';
  // eslint-disable-next-line prefer-const
  myStatus = status as 'success' | 'warning' | 'error' | 'pending';

  useEffect(() => {
    if (validatemessage !== '') {
      setStatus('error');
    }
    if (hasSuggestions) {
      setStatus('pending');
    } else if (!hasSuggestions && myStatus !== 'success') {
      // @ts-ignore
      setStatus(validatemessage !== '' ? 'error' : undefined);
    }
  }, [validatemessage, hasSuggestions, myStatus]);

  // calculate min and max range of calendar
  const currentYear = getFullYear(null);

  const yearFromValue = getFullYear(value);
  const maxDate = getMaxDate(
    parseInt(nextYearRange, 10),
    currentYear,
    yearFromValue
  );
  const minDate = getMinDate(
    parseInt(previousYearRange, 10),
    currentYear,
    yearFromValue
  );

  const toggleMasking = () => setIsTextMasked(prev => !prev);

  const handleEyeKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleMasking();
    }
  };

  function handleBlur(onBlurValue: any) {
    const { valueAsISOString: date, state: errorState } = onBlurValue;
    const trimmedDate = date ? date.substring(0, date.indexOf('T')) : date;
    datetimeFireChangeBlurEvents(errorState, value, trimmedDate, actions, propName, pConn);
    const isValueChanged = !(value === undefined && trimmedDate === '') && value !== trimmedDate;
    if (hasSuggestions && isValueChanged) {
      pConn.ignoreSuggestion("");
    }
  }

  function handleChange(onChangeValue: any) {
    const { valueAsISOString: date } = onChangeValue;
    const trimmedDate = date ? date.substring(0, date.indexOf('T')) : date;
    if (hasSuggestions && value !== trimmedDate) {
      setStatus("");
    }
    pConn.clearErrorMessages({
      category: "",
      property: propName,
      context: ""
    })
  }

  if (displayMode === 'LABELS_LEFT' || displayMode === 'STACKED_LARGE_VAL' || displayMode === 'DISPLAY_ONLY') {
     let variantValue = "date";
     let formatValue = "long";
     if (pConn && pConn.getConfigProps()){
        const configProps = pConn.getConfigProps() as ConfigProps;
        const runtimeformatter = configProps?.formatter;

        if (formatter !== runtimeformatter) {
          formatter = runtimeformatter!;
        }
     }

    if (formatter !== "" && formatExists(formatter)) {
        // @ts-ignore
        const {variantVal, formatVal} = datetimedisplayformatter(formatter);
        variantValue = variantVal;
        formatValue = formatVal;
    }

    const maskedDateStr = buildMaskedDate(value, visibleChars);
    const displayValue = isTextMasked ? maskedDateStr : value;

    const displayComp = (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <DateTimeDisplay
          variant={variantValue as DateTimeVariant}
          format={formatValue as DateTimeFormat}
          value={displayValue}
        />
        <button
          type='button'
          className='eye-toggle-button'
          onClick={toggleMasking}
          onKeyDown={handleEyeKeyDown}
          aria-label={isTextMasked ? 'Show date' : 'Hide date'}
          aria-pressed={!isTextMasked}
        >
          <span className='eye-icon' role='img' aria-hidden='true'>
            {isTextMasked ? <EyeIcon /> : <EyeOffIcon />}
          </span>
        </button>
      </span>
    );

    switch(displayMode){
      case 'DISPLAY_ONLY': {
        return ( <StyledPegaFieldMaskedDateFieldWrapper> {displayComp} </StyledPegaFieldMaskedDateFieldWrapper>);
      }
      case "LABELS_LEFT" : {
        return (
          <StyledPegaFieldMaskedDateFieldWrapper>
          <FieldValueList
            variant={hideLabel ? "stacked" : variant}
            data-testid={testId}
            fields={[{ id: '1', name: hideLabel ? "" :label, value: displayComp }]}
          />
          </StyledPegaFieldMaskedDateFieldWrapper>
        );
      }
      case "STACKED_LARGE_VAL" : {
        return (
          <StyledPegaFieldMaskedDateFieldWrapper>
          <FieldValueList
            variant='stacked'
            data-testid={testId}
            fields={[{ id: '2', name: hideLabel ? "" :label, value: <Text variant='h1' as='span'>{displayComp}</Text> }]}
          />
          </StyledPegaFieldMaskedDateFieldWrapper>
        );
      }
      // no default
    }
  }

  let dateComponent;

  if (readOnly && showAsFormattedText) {
    const environmentInfo = PCore.getEnvironmentInfo();
    const locale = environmentInfo && environmentInfo.getLocale();
    const textAdditionalProps = {
      format: getDateFormat(locale as string, {}),
      fieldType: 'Date'
    };
    const maskedDateStr = buildMaskedDate(value, visibleChars);
    dateComponent = (
      <StyledPegaFieldMaskedDateFieldWrapper>
        <div className='date-field-row'>
          <FormattedText
            formatType='date'
            value={isTextMasked ? maskedDateStr : value}
            label={label}
            hideLabel={hideLabel}
            testId={testId}
            additionalProps={textAdditionalProps}
            customFormat={getDateFormat(locale, null)}
          />
          <button
            type='button'
            className='eye-toggle-button'
            onClick={toggleMasking}
            onKeyDown={handleEyeKeyDown}
            aria-label={isTextMasked ? 'Show date' : 'Hide date'}
            aria-pressed={!isTextMasked}
            disabled={disabled}
            tabIndex={disabled ? -1 : 0}
          >
            <span className='eye-icon' role='img' aria-hidden='true'>
              {isTextMasked ? <EyeIcon /> : <EyeOffIcon />}
            </span>
          </button>
        </div>
      </StyledPegaFieldMaskedDateFieldWrapper>
    );
  } else {
    const maskedDateStr = buildMaskedDate(value, visibleChars);
    dateComponent = (
      <StyledPegaFieldMaskedDateFieldWrapper>
        {/*
          * date-field-row: flex row so the eye button sits BESIDE the DateInput.
          * The eye button is NEVER inside/overlapping the DateInput, so the
          * calendar picker button on the right of the input is always accessible.
          */}
        <div className='date-field-row'>
          {/* data-masked makes real input text transparent via CSS — no overlay background needed */}
          <div className='date-input-wrapper' data-masked={isTextMasked && value ? 'true' : undefined}>
            <DateInput
              {...additionalProps}
              label={label}
              labelHidden={hideLabel}
              info={validatemessage || helperText}
              status={myStatus}
              value={value || undefined}
              disabled={disabled}
              readOnly={readOnly}
              required={required}
              showWeekNumber={showWeekNumber}
              min={minDate}
              max={maxDate}
              data-testid={testId}
              onFocus={actionsProps.onFocus}
              onChange={handleChange}
              onBlur={handleBlur}
            />
            {/*
              * Overlay shows masked text over the input's text area.
              * No background — the real input text is made transparent via CSS
              * so there is no bleed-through. Label, border, and calendar button
              * are completely unaffected.
              * pointer-events: none so all clicks pass through to the input.
              */}
            {isTextMasked && value && (
              <div className='mask-overlay' aria-hidden='true'>
                <span className='mask-text'>{maskedDateStr}</span>
              </div>
            )}
          </div>
          {/* Eye button — flex sibling, never overlaps the calendar icon */}
          <button
            type='button'
            className='eye-toggle-button'
            onClick={toggleMasking}
            onKeyDown={handleEyeKeyDown}
            aria-label={isTextMasked ? 'Show date' : 'Hide date'}
            aria-pressed={!isTextMasked}
            disabled={disabled}
            tabIndex={disabled ? -1 : 0}
          >
            <span className='eye-icon' role='img' aria-hidden='true'>
              {isTextMasked ? <EyeIcon /> : <EyeOffIcon />}
            </span>
          </button>
        </div>
      </StyledPegaFieldMaskedDateFieldWrapper>
    );
  }
  return dateComponent;
}


export default withConfiguration(PegaFieldMaskedDateField);
