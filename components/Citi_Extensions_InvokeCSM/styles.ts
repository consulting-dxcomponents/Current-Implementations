// Layout-only styles — colors / typography inherited from the platform theme.
import styled, { css } from 'styled-components';

export default styled.div(() => {
  return css`
    .invoke-csm {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.75rem;
      width: 100%;
    }

    .invoke-csm__error {
      margin: 0;
      font-size: 0.875em;
      color: var(--app-error-color, #c62828);
    }

    /* Hidden iframe used only for the silent RSM logoff — never visible. */
    .invoke-csm__logoff-frame {
      display: none;
    }
  `;
});
