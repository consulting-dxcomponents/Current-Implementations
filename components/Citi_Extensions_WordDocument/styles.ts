// individual style, comment out above, and uncomment here and add styles
import styled, { css } from 'styled-components';

export default styled.div(() => {
  return css`
    margin: 0px 0;

    [data-testid='word-doc-editor'] {
      direction: ltr !important;
      unicode-bidi: embed !important;
      text-align: left;
    }

    [data-testid='word-doc-editor'] *,
    [data-testid='word-doc-editor'] p,
    [data-testid='word-doc-editor'] div,
    [data-testid='word-doc-editor'] span,
    [data-testid='word-doc-editor'] li,
    [data-testid='word-doc-editor'] td,
    [data-testid='word-doc-editor'] th {
      direction: ltr !important;
      unicode-bidi: embed !important;
    }
  `;
});
