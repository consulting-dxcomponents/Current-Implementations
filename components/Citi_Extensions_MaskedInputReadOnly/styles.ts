// Minimal styling — layout only. Everything else inherits from the platform theme.
import styled, { css } from 'styled-components';

const StyledPegaFieldMaskedWithEyeInputWrapper = styled.div(
  () => css`
    .masked-value-row {
      display: flex;
      align-items: flex-start;
      gap: 0.25rem;
    }

    .masked-value-row button {
      margin-left: 0.5rem;
    }

    .masked-value-row button:focus,
    .masked-value-row button:focus-visible {
      outline: none;
      box-shadow: none;
    }
  `
);

export default StyledPegaFieldMaskedWithEyeInputWrapper;
