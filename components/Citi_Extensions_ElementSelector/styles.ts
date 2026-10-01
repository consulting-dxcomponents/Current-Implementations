// individual style, comment out above, and uncomment here and add styles
import styled, { css } from 'styled-components';

export default styled.div(() => {
  return css`
    margin: 0px 0;
  `;
});

// Overlay that covers the entire screen during element selection
export const StyledOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.1);
  z-index: 9998;
  cursor: crosshair;
  pointer-events: none;
`;

// Highlight box that shows around the hovered element
export const StyledHighlight = styled.div`
  position: fixed;
  border: 2px solid #0066ff;
  background-color: rgba(0, 102, 255, 0.1);
  z-index: 9999;
  pointer-events: none;
  display: none;
  transition: all 0.1s ease;
  box-shadow: 0 0 0 1px rgba(0, 102, 255, 0.3);
`;

// Info box that shows element details on hover
export const StyledInfoBox = styled.div`
  position: absolute;
  top: -28px;
  left: 0;
  background-color: #0066ff;
  color: white;
  padding: 4px 8px;
  border-radius: 3px;
  font-size: 11px;
  font-family: monospace;
  white-space: nowrap;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  max-width: 400px;
  overflow: hidden;
  text-overflow: ellipsis;
`;