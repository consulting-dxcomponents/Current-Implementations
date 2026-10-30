import styled, { css } from 'styled-components';
import { defaultThemeProp } from '@pega/cosmos-react-core';

/** Root wrapper — flex column for the review panel and footer. */
export default styled.div(() => {
  return css`
    display: flex;
    flex-direction: column;
    margin: 0;
  `;
});

/**
 * Right pane — DOM-driven review panel.
 * Takes the remaining width and scrolls independently.
 */
export const StyledReviewPanel = styled.div(() => {
  return css`
    flex: 0 1 auto;
    min-width: 0;
    min-height: 830px;
    max-height: 830px;
    overflow-y: auto;
  `;
});

/**
 * Wrapper for a FieldGroup accordion section that may have a validation-error
 * indicator. When `data-has-error` is set on this wrapper the action button
 * injected into the FieldGroup legend is styled as a plain non-interactive
 * red icon instead of a clickable button.
 *
 * We identify the error-indicator action buttons by the *absence* of the
 * `aria-expanded` attribute (which only the collapse/expand caret button
 * carries), so we never accidentally target the wrong button.
 */
export const StyledFieldGroupWrapper = styled.div`
  border: 1px solid var(--app-border-color, #d0d7e2);
  border-radius: 4px;
  overflow: hidden;
  padding: 4px;

  /* Cosmos applies transform:rotate to every StyledIcon inside its expand
     button (including icons inside the name/label slot). This override stops
     that rotation for our error-badge icon specifically, without touching the
     caret animation on the expand/collapse button itself. */
  [data-idp-error-badge] * {
    transform: none !important;
    transition: none !important;
  }
`;

// ─── Changes Log ──────────────────────────────────────────────────────────────

/**
 * Outer wrapper for the Changes Log section rendered below the review panel.
 */
export const StyledChangeLog = styled.div(() => {
  return css`
    flex-shrink: 0;
    margin-top: 16px;
    border: 1px solid var(--app-border-color, #d0d7e2);
    border-radius: 6px;
    overflow: hidden;
  `;
});

/** Placeholder shown when there are no changes yet. */
export const StyledChangeLogEmpty = styled.div(() => {
  return css`
    padding: 16px;
    text-align: center;
    color: #aaa;
    font-size: 0.8rem;
    font-style: italic;
  `;
});

/** Entry-count badge in the ChangeLog header. */
export const StyledChangeLogCountBadge = styled.span(() => {
  return css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: 10px;
    background: var(--app-primary-color, #0063bf);
    color: #fff;
    font-size: 0.72rem;
    font-weight: 700;
  `;
});

/** Pagination bar — right-aligned, sits below the audit log table. */
export const StyledPaginationBar = styled.div(() => {
  return css`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    padding: 8px 12px;
    border-top: 1px solid var(--app-border-color, #d0d7e2);
    font-size: 0.8rem;
    color: #555;
  `;
});

/** Case ID cell in the Audit Log table — wide enough to show the full ID. */
export const StyledAuditCaseId = styled.span(() => {
  return css`
    display: inline-block;
    min-width: 108px;
    white-space: nowrap;
  `;
});

/** Previous-value cell in the Audit Log table — muted strikethrough. */
export const StyledAuditPrevValue = styled.span(() => {
  return css`
    display: inline-block;
    min-width: 220px;
    opacity: 0.55;
    text-decoration: line-through;
    white-space: pre-line;
  `;
});

/** New-value cell in the Audit Log table — emphasised. */
export const StyledAuditNextValue = styled.span(() => {
  return css`
    display: inline-block;
    min-width: 220px;
    font-weight: 600;
    color: #0063bf;
    white-space: pre-line;
  `;
});

/** Save-button row — right-aligned below the ChangeLog. */
export const StyledSaveRow = styled.div(() => {
  return css`
    display: flex;
    justify-content: flex-end;
    margin-top: 8px;
    margin-bottom: 4px;
  `;
});

/** ChangeLog + Save row — rendered as the last element in normal document flow. */
export const StyledBreakoutWrapper = styled.div(() => {
  return css`
    margin-top: 16px;
  `;
});

/** Field extraction stats bar shown above the Audit Log table. */
export const StyledExtractedFieldCount = styled.div(() => {
  return css`
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--app-border-color, #d0d7e2);
    font-size: var(--app-font-size-s, 0.8125rem);
    color: var(--app-text-color-muted, #5c6b7a);
    line-height: 1.4;

    strong {
      font-weight: 600;
      color: var(--app-text-color, #1a1a1a);
    }

    span {
      color: var(--app-border-color, #c0cad5);
    }
  `;
});

// ─── Repeatable editable table ─────────────────────────────────────────────

/**
 * Editable repeatable table styled with proper Constellation design tokens.
 * Uses props.theme (injected by Cosmos ThemeProvider) so colours, spacing
 * and border radii all follow the active theme automatically.
 */
export const StyledRepeatableTable = styled.table(
  ({
    theme: {
      base: { spacing, 'border-radius': baseRadius, palette },
      components: {
        table: tableTokens,
        'form-control': {
          'foreground-color': inputFg,
          'background-color': inputBg,
          'border-color': inputBorderColor,
          'border-width': inputBorderWidth,
          'border-radius': inputBorderRadius,
          ':hover': { 'border-color': hoverBorderColor },
          ':focus': { 'border-color': focusBorderColor, 'box-shadow': focusShadow }
        }
      }
    }
  }) => {
    const hSpacingHeader = `calc(${tableTokens.header['horizontal-spacing']} * ${spacing})`;
    const vSpacingHeader = `calc(${tableTokens.header['vertical-spacing']} * ${spacing})`;
    const hSpacingBody = `calc(${tableTokens.body['horizontal-spacing']} * ${spacing})`;
    const vSpacingBody = `calc(${tableTokens.body['vertical-spacing']} * ${spacing})`;
    const borderHeader = `${tableTokens.header['border-width']} solid ${tableTokens.header['border-color']}`;
    const borderBody = `${tableTokens.body['border-width']} solid ${tableTokens.body['border-color']}`;
    const inputRadius = `calc(${baseRadius} * ${inputBorderRadius})`;

    return css`
      width: 100%;
      border-collapse: collapse;
      font-size: inherit;
      border: ${borderBody};

      thead {
        background: ${tableTokens.header['background-color']};

        th {
          text-align: left;
          padding: ${vSpacingHeader} ${hSpacingHeader};
          font-weight: ${tableTokens.header['font-weight']};
          color: ${tableTokens.header['foreground-color']};
          border-bottom: ${borderHeader};
          border-right: ${borderHeader};
          white-space: nowrap;

          &:last-child {
            border-right: none;
          }
        }
      }

      tbody {
        tr {
          color: ${tableTokens.body['foreground-color']};
          background: ${tableTokens.body['background-color']};
          border-bottom: ${borderBody};

          &:last-child {
            border-bottom: none;
          }

          &:hover {
            background: ${palette['secondary-background']};
          }
        }

        td {
          padding: ${vSpacingBody} ${hSpacingBody};
          vertical-align: middle;
          border-right: ${borderBody};

          &:last-child {
            border-right: none;
          }
        }
      }

      input:not([type='checkbox']),
      select,
      textarea {
        width: 100%;
        color: ${inputFg};
        background: ${inputBg};
        border: ${inputBorderWidth} solid ${inputBorderColor};
        border-radius: ${inputRadius};
        padding: calc(0.5 * ${spacing}) ${spacing};
        font: inherit;
        font-size: inherit;
        box-sizing: border-box;

        &:hover:not(:disabled):not(:focus) {
          border-color: ${hoverBorderColor};
        }

        &:focus {
          border-color: ${focusBorderColor};
          box-shadow: ${focusShadow};
          outline: none;
        }
      }

      textarea {
        min-height: 60px;
        resize: vertical;
      }
    `;
  }
);
StyledRepeatableTable.defaultProps = defaultThemeProp;

export const StyledRepeatableTableWrapper = styled.div`
  overflow-x: auto;
  width: 100%;
`;

/**
 * Red asterisk for required column headers. Uses the Constellation `urgent`
 * palette colour so it respects theme overrides (e.g. dark mode).
 */
export const StyledRequiredMark = styled.span(
  ({
    theme: {
      base: { palette }
    }
  }) => css`
    color: ${palette['urgent']};
    margin-left: 2px;
    font-weight: 700;
  `
);
StyledRequiredMark.defaultProps = defaultThemeProp;

// ─── Chip control ─────────────────────────────────────────────────────────────

export const StyledChipWrapper = styled.div<{ $hasError?: boolean; $bordered?: boolean }>(
  ({
    $hasError,
    $bordered,
    theme: {
      components: {
        'form-control': {
          'border-color': borderColor,
          'border-width': borderWidth,
          ':hover': { 'border-color': hoverBorderColor },
          ':focus': { 'border-color': focusBorderColor, 'box-shadow': focusShadow }
        }
      }
    }
  }) => css`
    border: ${$bordered ? `${borderWidth} solid ${$hasError ? '#c00' : borderColor}` : 'none'};
    border-radius: 4px;
    padding: 3px 6px;
    min-height: 32px;
    cursor: text;

    ${$bordered &&
    css`
      &:hover:not(:has(input:focus)) {
        border-color: ${$hasError ? '#c00' : hoverBorderColor};
      }
      &:has(input:focus) {
        border-color: ${$hasError ? '#c00' : focusBorderColor};
        box-shadow: ${focusShadow};
        outline: none;
      }
    `}
  `
);
StyledChipWrapper.defaultProps = defaultThemeProp;

export const StyledChipList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
`;

export const StyledChip = styled.span<{ $isNew?: boolean; $isSelected?: boolean }>(
  ({
    $isNew,
    $isSelected,
    theme: {
      components: {
        'form-control': {
          ':focus': { 'border-color': focusBorderColor, 'box-shadow': focusShadow }
        }
      }
    }
  }) => css`
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 2px 10px;
    border-radius: 12px;
    font-size: 0.8125rem;
    font-weight: 500;
    line-height: 1.5;
    user-select: none;
    cursor: pointer;
    background: ${$isNew
      ? 'var(--app-success-subtle, #d1fae5)'
      : 'var(--app-primary-subtle, #e0e7ff)'};
    color: ${$isNew ? 'var(--app-success-dark, #065f46)' : 'var(--app-primary-dark, #3730a3)'};
    border: 1px solid
      ${$isNew ? 'var(--app-success-border, #6ee7b7)' : 'var(--app-primary-border, #a5b4fc)'};

    ${$isSelected &&
    css`
      border-color: ${focusBorderColor};
      box-shadow: ${focusShadow};
      outline: none;
    `}
  `
);
StyledChip.defaultProps = defaultThemeProp;

export const StyledChipRemoveButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 0 0 0 2px;
  line-height: 1;
  color: var(--app-text-muted, #64748b);
  font-size: 0.85rem;
`;

export const StyledChipInput = styled.input`
  border: none;
  outline: none;
  min-width: 90px;
  flex: 1;
  font: inherit;
  font-size: inherit;
  padding: 2px 0;
  background: transparent;
`;

export const StyledChipLabel = styled.div`
  font-weight: 500;
  font-size: 0.875rem;
  margin-bottom: 4px;
  color: var(--app-label-color, inherit);
`;
