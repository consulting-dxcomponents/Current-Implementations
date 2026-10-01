// Layout-only styles for the Accordion widget.
// Colors, typography and font families are intentionally inherited from the
// application's theme so the widget blends with the surrounding app.
import styled, { css } from 'styled-components';

export default styled.div(() => {
  return css`
    box-sizing: border-box;
    width: 100%;
    max-width: 860px;

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    /* ── Header row ─────────────────────────────────────────────── */
    .accordion-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 0.75rem;
    }

    .accordion-header__title {
      font-weight: 600;
      line-height: 1.3;
    }

    .accordion-header__subtitle {
      font-size: 0.85em;
      opacity: 0.75;
      margin-top: 0.15rem;
    }

    /* ── Ghost / link-style buttons (Expand all etc.) ───────────── */
    .accordion-ghost-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: none;
      border: none;
      padding: 0.25rem 0.5rem;
      margin: 0;
      cursor: pointer;
      font: inherit;
      color: inherit;
      border-radius: 4px;
      flex-shrink: 0;
    }

    .accordion-ghost-btn:hover {
      background: rgba(0, 0, 0, 0.04);
    }

    button:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 2px;
      border-radius: 4px;
    }

    /* ── Accordion container ────────────────────────────────────── */
    .accordion-list {
      border: none;
      border-radius: 0;
      overflow: hidden;
    }

    /* ── Individual panel ───────────────────────────────────────── */
    .accordion-panel {
      border-bottom: 1px solid rgba(0, 0, 0, 0.28);
    }

    .accordion-panel[data-is-last='true'] {
      border-bottom: none;
    }

    .accordion-panel__header {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.625rem 0.875rem;
    }

    .accordion-panel__header[data-open='true'] {
      background: rgba(0, 0, 0, 0.025);
    }

    .accordion-panel__radio {
      flex-shrink: 0;
      background: none;
      border: none;
      padding: 0;
      margin: 0;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      color: inherit;
    }

    .accordion-panel__toggle {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 0.625rem;
      background: none;
      border: none;
      padding: 0;
      margin: 0;
      cursor: pointer;
      text-align: left;
      font: inherit;
      color: inherit;
    }

    .accordion-panel__label {
      flex: 1;
      line-height: 1.4;
    }

    .accordion-panel__chevron {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      opacity: 0.7;
    }

    /* ── Panel body (animated grid trick) ───────────────────────── */
    .accordion-panel__collapse {
      display: grid;
      grid-template-rows: 0fr;
      transition: grid-template-rows 0.28s ease;
    }

    .accordion-panel__collapse[data-open='true'] {
      grid-template-rows: 1fr;
    }

    .accordion-panel__collapse-inner {
      overflow: hidden;
    }

    .accordion-panel__body {
      padding: 0.5rem 0.875rem 0.875rem 2.5rem;
    }

    .accordion-panel__tooltip {
      margin: 0 0 0.5rem 0;
      font-size: 0.85em;
      opacity: 0.7;
    }

    /* ── Empty / placeholder states ─────────────────────────────── */
    .accordion-empty {
      padding: 1.25rem;
      text-align: center;
      border: 1px dashed rgba(0, 0, 0, 0.18);
      border-radius: 8px;
      font-size: 0.9em;
      opacity: 0.75;
    }

    .accordion-region-empty {
      margin: 0;
      font-size: 0.85em;
      opacity: 0.6;
    }
  `;
});
