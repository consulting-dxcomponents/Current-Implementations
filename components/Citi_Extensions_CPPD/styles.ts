// individual style, comment out above, and uncomment here and add styles
import styled, { css } from 'styled-components';

export default styled.div(() => {
  return css`
    margin: 0px 0;

    /* Primary link type: styled with border and rounded corners */
    &.cppd-link-primary a {
      display: inline-block;
      padding: 8px 16px;
      border: 1px solid currentColor;
      border-radius: 4px;
      text-decoration: none;
      transition: all 0.2s ease;

      &:hover:not([disabled]) {
        background-color: rgba(0, 0, 0, 0.05);
      }

      &:focus-visible {
        outline: 2px solid currentColor;
        outline-offset: 2px;
      }
    }

    /* Secondary link type: rendered as normal link */
    &.cppd-link-secondary a {
      padding: 0;
      border: none;
      border-radius: 0;
      display: inline;

      &:hover:not([disabled]) {
        background-color: transparent;
      }
    }
  `;
});
