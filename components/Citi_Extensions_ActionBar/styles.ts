import styled, { css, createGlobalStyle } from 'styled-components';

/**
 * Hides Pega's OOTB flow action buttons (Cancel / Submit) region while this
 * Action Bar widget is mounted, so only this widget provides the actions.
 *
 * These buttons are rendered by the Constellation runtime *outside* this
 * component's DOM subtree, so a global style is required.
 *
 * We deliberately avoid the hashed styled-components classes (e.g. `jCSTUI`,
 * `sc-gswNZR`) because those change on every build. Instead we anchor on the
 * stable `data-testid=":form:"` on the flow form and the button's `name`
 * attribute, hiding the container `div` that holds the action buttons.
 */
export const HideOOTBActionButtons = createGlobalStyle`
  form[data-testid=':form:'] div:has(> button[name='cancel']),
  form[data-testid=':form:'] div:has(> button[name='submit']) {
    display: none !important;
  }
`;

/**
 * Footer action bar — Cancel on the left, Save / Save & Submit on the right.
 */
export default styled.div(() => {
  return css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
    margin-bottom: 4px;
    gap: 8px;

    .action-bar-right {
      display: flex;
      gap: 8px;
    }
  `;
});
