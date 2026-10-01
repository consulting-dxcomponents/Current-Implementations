# ElementSelector Component

## Overview

The ElementSelector is a DX component that allows users to visually select any DOM element on the page. It provides an interactive interface similar to browser developer tools' element inspector or Pega's Live UI Inspector / ToggleXray feature.

## Features

- **Visual Element Selection**: Click a button with a crosshair icon to activate selection mode
- **Interactive Highlighting**: Hover over any element to see it highlighted with a blue border
- **Element Information Display**: See element details (tag name, ID, classes) in a tooltip while hovering
- **Scroll Support**: Select elements anywhere on the page, including those requiring scrolling
- **Detailed Element Data**: After selection, view complete element information including:
  - Tag name
  - ID attribute
  - CSS classes
  - CSS selector
  - XPath
- **ESC to Cancel**: Press the Escape key to exit selection mode without selecting an element
- **Full-screen Overlay**: Semi-transparent overlay during selection to indicate active mode

## Usage

### Basic Implementation

The component can be added to any Pega view as a field component. When configured, it will:

1. Display a "Select Element" button with a crosshair icon
2. Allow users to click the button to enter selection mode
3. Enable hovering over page elements with visual feedback
4. Capture the selected element's information and store it in the field value

### Configuration Properties

The component supports standard Pega field properties:

- **label**: Label text for the component
- **disabled**: Disable the selection button
- **readOnly**: Make the component read-only
- **hideLabel**: Hide the label text
- **testId**: Test identifier for automated testing

### How It Works

1. **Activation**: Click the "Select Element" button
2. **Selection Mode**: 
   - A semi-transparent overlay appears
   - Mouse cursor changes to crosshair
   - All elements become selectable
3. **Hovering**: 
   - Move mouse over any element
   - Element is highlighted with blue border
   - Tooltip shows element tag, ID, and classes
4. **Selection**: 
   - Click on desired element
   - Element information is captured
   - Selection mode exits automatically
5. **Result**: 
   - Selected element details display below the button
   - Element data is stored in the field value as JSON

### Element Information Captured

When an element is selected, the following information is captured:

```json
{
  "tagName": "input",
  "id": "email-input",
  "className": "form-control input-field",
  "selector": "input.form-control.input-field",
  "xpath": "/html/body/div[1]/form/div[2]/input[1]",
  "testId": "email-field-test"
}
```

- **tagName**: The HTML tag name (e.g., `input`, `button`, `div`)
- **id**: The element's ID attribute (if present)
- **className**: The element's CSS classes (if present)
- **selector**: A CSS selector to uniquely identify the element
- **xpath**: An XPath expression to locate the element
- **testId**: The `data-testid` attribute value (if present) - useful for automated testing

## Technical Implementation

### Key Technologies

- **React Hooks**: useState, useEffect, useRef, useCallback for state management
- **Event Listeners**: Mouse events (mousemove, click) and keyboard events (keydown)
- **DOM Manipulation**: Direct DOM interaction for element inspection
- **Styled Components**: For overlay and highlight styling
- **Fixed Positioning**: Critical for working within Pega's complex layout structure

### Architecture

The component consists of:

1. **Main Component** (`index.tsx`): Core logic and UI
2. **Styled Components** (`styles.ts`): Visual styling for overlay, highlight, and info box
3. **Crosshair Icon**: SVG icon component for the button
4. **Event Handlers**: Mouse and keyboard event management
5. **Positioning System**: Fixed viewport-based positioning for accurate highlighting

### Selection Algorithm

1. **Mouse Move Handler**: 
   - Captures mouse position
   - Identifies element under cursor
   - Updates highlight position using viewport coordinates
   - Uses `getBoundingClientRect()` for accurate positioning
   - Applies fixed positioning to work within Pega's layout
   - Displays element info tooltip

2. **Click Handler**: 
   - Captures clicked element
   - Extracts element information
   - Generates CSS selector and XPath
   - Stores data in field value

3. **Escape Handler**: 
   - Listens for Escape key
   - Exits selection mode
   - Clears highlights

### Positioning Strategy (Critical for Pega)

The component uses **fixed positioning** instead of absolute positioning:

```typescript
// Get viewport-relative position
const rect = target.getBoundingClientRect();

// Apply directly with fixed positioning (no offset calculations)
highlightRef.current.style.top = `${rect.top}px`;
highlightRef.current.style.left = `${rect.left}px`;
```

**Why Fixed Positioning?**
- Pega applications have complex nested layouts (header, nav, work area, summary panel)
- Fixed positioning bypasses all parent positioning contexts
- Works with viewport coordinates, which is exactly what `getBoundingClientRect()` provides
- No need to calculate offsets for Pega's layout elements
- Works perfectly with scrolling and dynamic content

### XPath Generation

The component generates XPath expressions for selected elements:

- Uses element ID if available: `//*[@id="element-id"]`
- Falls back to positional XPath: `/html/body/div[1]/form/div[2]/input[1]`
- Traverses parent hierarchy for accurate path

### CSS Selector Generation

Generates CSS selectors optimized for element identification:

- Prefers ID selector: `#element-id`
- Falls back to tag + classes: `input.form-control.input-field`
- Uses tag name only if no ID or classes: `input`

## Styling

The component uses three styled components:

1. **StyledOverlay**: Full-screen semi-transparent overlay during selection
2. **StyledHighlight**: Blue border box that follows hovered element
3. **StyledInfoBox**: Tooltip showing element information

### Customization

Styles can be modified in `styles.ts`:

```typescript
export const StyledHighlight = styled.div`
  border: 2px solid #0066ff;  // Change border color
  background-color: rgba(0, 102, 255, 0.1);  // Change highlight opacity
  // ... other styles
`;
```

## Integration with Pega

### Field Value

The selected element information is stored as a JSON string in the field value. This can be:

- Displayed to users
- Used in data transforms
- Passed to activities or services
- Stored in the case data

### Use Cases

1. **Automation Testing**: Capture element selectors for test scripts
2. **Configuration**: Allow users to specify target elements for actions
3. **Analytics**: Track which elements users interact with
4. **Custom Integrations**: Identify elements for JavaScript execution
5. **Documentation**: Generate element documentation for training

## Browser Compatibility

The component uses standard web APIs and is compatible with:

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Performance Considerations

- Event listeners are added/removed efficiently using React lifecycle
- Highlight updates use direct DOM manipulation for performance
- Fixed positioning is more performant than absolute with calculations
- No scroll position queries needed on every mouse move
- Browser handles viewport-relative positioning natively
- Event handlers use `useCallback` to prevent unnecessary re-renders
- Minimal reflows and repaints due to fixed positioning
- Works smoothly even with complex Pega layouts and dynamic content

## Accessibility

- Button includes proper semantic HTML
- Keyboard support (ESC to cancel)
- Visual feedback for all interactions
- ARIA attributes for button states

## Limitations

- Cannot select elements in iframes from different origins
- Shadow DOM elements may have limited accessibility
- Extremely dynamic pages may require re-selection

## Future Enhancements

Potential improvements:

- Support for selecting multiple elements
- Element filtering by type or attributes
- Copy selector to clipboard functionality
- History of selected elements
- Advanced XPath/selector generation options
- Screenshot capture of selected element

## Support

For issues or questions, please contact the development team or refer to the main DX component documentation.
