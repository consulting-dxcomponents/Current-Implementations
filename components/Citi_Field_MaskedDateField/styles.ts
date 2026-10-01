// individual style, comment out above, and uncomment here and add styles
import styled, { css } from 'styled-components';

export default styled.div(() => {
  return css`
    margin: 0px 0;

    /* Flex row: DateInput takes full width; eye button sits beside it */
    .date-field-row {
      display: flex;
      align-items: flex-end;
      gap: 6px;
      width: 100%;
    }

    /* Wrapper scopes the mask overlay to the input area */
    .date-input-wrapper {
      flex: 1;
      position: relative;
      min-width: 0;
    }

    /*
     * When data-masked="true", make the real <input> text invisible.
     * The border, label, placeholder, calendar button and all layout remain
     * 100% intact — we're only hiding the text colour.
     */
    .date-input-wrapper[data-masked='true'] input {
      color: transparent !important;
      /* caret is fine to stay — it shows where the user is typing */
    }

    /*
     * Mask overlay — positioned to cover only the text area of the input.
     * NO background colour so the field border/label are never obscured.
     * pointer-events: none lets all mouse and keyboard events pass through.
     */
    .mask-overlay {
      position: absolute;
      /* Match the inner input's left padding (Cosmos uses ~12px) */
      left: 12px;
      /* Stop before the calendar picker button (~36px from right) */
      right: 40px;
      /* Vertically centre inside the input — the input element itself sits at
         the bottom of the wrapper (label is above). Use bottom offset to align. */
      bottom: 0;
      height: 36px; /* typical single-line Cosmos input height */
      display: flex;
      align-items: center;
      pointer-events: none;
      z-index: 2;
      overflow: hidden;
    }

    .mask-text {
      font-family: inherit;
      font-size: 0.875rem;
      color: var(--app-primary-color, #333);
      letter-spacing: 0.06em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Eye toggle button — flex sibling, never overlaps the calendar button */
    .eye-toggle-button {
      flex-shrink: 0;
      background: none;
      border: 1px solid transparent;
      cursor: pointer;
      padding: 6px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #555;
      transition: background-color 0.15s ease, color 0.15s ease;

      &:hover:not(:disabled) {
        background-color: rgba(0, 0, 0, 0.07);
        color: #000;
      }

      &:focus-visible {
        outline: 2px solid #006fce;
        outline-offset: 2px;
      }

      &:active:not(:disabled) {
        background-color: rgba(0, 0, 0, 0.12);
      }

      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
    }

    .eye-icon {
      line-height: 0;
      pointer-events: none;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  `;
});
