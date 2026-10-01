import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Button,
  FieldValueList,
  Text,
  withConfiguration
} from '@pega/cosmos-react-core';

import type { PConnFieldProps } from './PConnProps';
import './create-nonce';

import StyledCitiExtensionsElementSelectorWrapper, { 
  StyledOverlay, 
  StyledHighlight,
  StyledInfoBox 
} from './styles';

// Crosshair icon SVG component
const CrosshairIcon = () => (
  <svg 
    width="16" 
    height="16" 
    viewBox="0 0 16 16" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <line x1="8" y1="0" x2="8" y2="4" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="8" y1="12" x2="8" y2="16" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="0" y1="8" x2="4" y2="8" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="12" y1="8" x2="16" y2="8" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
  </svg>
);

// interface for props
interface CitiExtensionsElementSelectorProps extends PConnFieldProps {
  // Additional props
  variant?: any;
}

// Interface for element info
interface ElementInfo {
  tagName: string;
  testId: string;
  value: string;
  property: string;
  mappedProperty?: string;
}

// props passed in combination of props from property panel (config.json) and run time props from Constellation
function CitiExtensionsElementSelector(props: CitiExtensionsElementSelectorProps) {
  const { 
    getPConnect, 
    value, 
    disabled = false, 
    displayMode, 
    readOnly = false, 
    label, 
    hideLabel = false, 
    testId, 
    variant = 'inline',
    datapage,
    datapageParameters,
    objectIndexProperty
  } = props;

  const pConn = getPConnect();
  const actions = pConn.getActionsApi();
  const stateProps = pConn.getStateProps();
  const propName: string = stateProps?.value || 'ElementSelectorData';

  // State management
  const [isSelecting, setIsSelecting] = useState(false);
  const [hoveredElement, setHoveredElement] = useState<HTMLElement | null>(null);
  const [selectedElementInfo, setSelectedElementInfo] = useState<ElementInfo | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const datapageOptionsRef = useRef<any[]>([]);
  const selectedDocumentRef = useRef<{ DocID: any }>({ DocID: null });

  // Get element information
  const getElementInfo = useCallback((element: HTMLElement): ElementInfo => {
    // Get value based on element type
    let elementValue = '';
    let elementTestId = element.getAttribute('data-testid') || '';
    
    // Remove control suffixes from testId
    // Handles patterns like ":input:control", ":phone-input", etc.
    // Example: "input-firstName:input:control" -> "input-firstName"
    // Example: "input-ContactNumber:phone-input" -> "input-ContactNumber"
    elementTestId = elementTestId.replace(/:[a-zA-Z0-9\-:]*$/, '');
    
    // Parse testId format: "controlType-mappedProperty-property" or "controlType-mappedProperty-page-property-path"
    // Example: "input-category-firstName" 
    // Example: "date-status-PageA-PageB-firstName"
    const testIdParts = elementTestId.split('-');
    const controlType = testIdParts[0] || '';
    const mappedProperty = testIdParts[1] || '';
    const propertyParts = testIdParts.slice(2);
    const property = propertyParts.join('.') || '';
    
    // Handle date field special case
    if (controlType === 'date') {
      // Use the property path to get value from PConnect
      const propertyRef = `.${property}`;
      try {
        // Use PConnect.getValue() to get the value
        elementValue = pConn.getValue(propertyRef) || '';
      } catch (error) {
        console.warn(`Failed to get value for property: ${propertyRef}`, error);
        elementValue = '';
      }
    } else if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      elementValue = element.value;
    } else if (element instanceof HTMLSelectElement) {
      elementValue = element.value;
    } else {
      // For other elements, get text content
      elementValue = element.textContent?.trim() || '';
    }

    return {
      tagName: element.tagName.toLowerCase(),
      testId: elementTestId,
      value: elementValue,
      property: `.${property}`,
      mappedProperty
    };
  }, [pConn]);

  // Get the selected object from parsed datapage response based on objectIndexProperty
  const getSelectedDatapageObject = useCallback((): any => {
    try {
      // If no property specified or no objects available, return null
      if (!objectIndexProperty || !datapageOptionsRef.current || datapageOptionsRef.current.length === 0) {
        return null;
      }

      let indexValue: any = null;

      // Handle deep property paths like ".MFEState.DocumentID" or multipage references
      if (objectIndexProperty.includes('.')) {
        // Split the property path and navigate through the object hierarchy
        const propertyParts = objectIndexProperty.split('.').filter(part => part.length > 0);
        
        let currentValue = pConn.getValue('') || {};
        
        // Navigate through each part of the path
        for (const part of propertyParts) {
          if (currentValue && typeof currentValue === 'object') {
            currentValue = currentValue[part];
          } else {
            currentValue = undefined;
            break;
          }
        }
        
        indexValue = currentValue;
      } else {
        // Simple property path - use standard getValue
        indexValue = pConn.getValue(objectIndexProperty);
      }
      
      if (indexValue === undefined || indexValue === null) {
        console.warn(`Property '${objectIndexProperty}' not found in pConnect or has no value`);
        return null;
      }

      // Convert to number if it's a string
      const index = typeof indexValue === 'string' ? parseInt(indexValue, 10) : indexValue;

      // Validate the index is within bounds
      if (typeof index !== 'number' || Number.isNaN(index) || index < 0 || index >= datapageOptionsRef.current.length) {
        console.warn(`Invalid index '${index}' for datapage objects (length: ${datapageOptionsRef.current.length}). Property: '${objectIndexProperty}'`);
        return null;
      }

      return datapageOptionsRef.current[index];
    } catch (error) {
      console.error('Failed to get selected datapage object:', error);
      return null;
    }
  }, [pConn, objectIndexProperty]);



  // Resolve datapage parameters from pConnect
  const resolveDatapageParameters = useCallback((params: string): any => {
    try {
      // Parse parameter format: "caseID":"pyID" or multiple params separated by comma
      // e.g., "caseID":"pyID" or "caseID":"pyID","status":"pyStatus"
      const paramPairs = params.split(',').map((pair: string) => pair.trim()).filter((pair: string) => pair.length > 0);
      const dataViewParameters: any = {};
      
      for (const paramPair of paramPairs) {
        // Parse each pair: "key":"propertyPath"
        const match = paramPair.match(/^"([^"]+)"\s*:\s*"([^"]+)"$/);
        
        if (match && match[1] && match[2]) {
          const paramKey = match[1];
          const propertyPath = match[2];
          
          // Fetch value from pConnect using the property path
          // If propertyPath doesn't start with ".", prepend it
          const fullPropertyPath = propertyPath.startsWith('.') ? propertyPath : `.${propertyPath}`;
          const paramValue = pConn.getValue(fullPropertyPath);
          
          if (paramValue !== undefined && paramValue !== null) {
            // Set the key-value pair in dataViewParameters
            dataViewParameters[paramKey] = paramValue;
          }
        } else {
          console.warn(`Invalid parameter format: '${paramPair}'. Expected format: "key":"propertyPath"`);
        }
      }
      
      return Object.keys(dataViewParameters).length > 0 ? { dataViewParameters } : {};
    } catch (error) {
      console.warn(`Failed to resolve parameter '${params}':`, error);
      return {};
    }
  }, [pConn]);

  // Parse datapage response items (handles both JSON strings and objects)
  const parseDatapageItems = (dataArray: any[]): any[] => {
    const parsedObjects: any[] = [];
    
    for (const item of dataArray) {
      try {
        if (typeof item === 'string') {
          const parsedObj = JSON.parse(item);
          parsedObjects.push(parsedObj);
        } else {
          parsedObjects.push(item);
        }
      } catch (parseError) {
        console.warn('Failed to parse JSON string:', item, parseError);
        parsedObjects.push(item);
      }
    }
    
    return parsedObjects;
  };

  // Find matching entry in the selected object by fieldName from BoundingBoxJSON
  const findMappedFieldEntry = useCallback((): any => {
    try {
      // Get the stored document ID from ref
      const documentID = selectedDocumentRef.current.DocID;
      
      if (!documentID) {
        console.warn('No document ID available from ref');
        return null;
      }

      // Parse BoundingBoxJSON string to get the object with fieldName
      let boundingBoxObject: any = null;
      if (documentID.BoundingBoxJSON) {
        try {
          boundingBoxObject = typeof documentID.BoundingBoxJSON === 'string' 
            ? JSON.parse(documentID.BoundingBoxJSON) 
            : documentID.BoundingBoxJSON;
        } catch (parseError) {
          console.error('Failed to parse BoundingBoxJSON:', documentID.BoundingBoxJSON, parseError);
          return null;
        }
      }

      if (!boundingBoxObject) {
        console.warn('No BoundingBoxJSON available in selected document');
        return null;
      }

      // Get the fieldName from the parsed BoundingBoxJSON
      const fieldNameFromDocument = boundingBoxObject.fieldName;
      
      if (!fieldNameFromDocument) {
        console.warn('No fieldName found in BoundingBoxJSON');
        return null;
      }

      // Get the selected object from datapage
      const selectedObject = getSelectedDatapageObject();
      
      if (!selectedObject) {
        console.warn('No selected object available from datapage');
        return null;
      }

      // Handle array of objects - find the entry matching the fieldName from BoundingBoxJSON
      if (Array.isArray(selectedObject)) {
        for (const entry of selectedObject) {
          if (entry && typeof entry === 'object' && entry.fieldName === fieldNameFromDocument) {
            return entry;
          }
        }
      } 
      // Handle object with fieldName directly
      else if (typeof selectedObject === 'object' && selectedObject.fieldName === fieldNameFromDocument) {
        return selectedObject;
      }
      // Handle object as a collection where each property might be an entry
      else if (typeof selectedObject === 'object') {
        for (const key in selectedObject) {
          if (Object.prototype.hasOwnProperty.call(selectedObject, key)) {
            const entry = selectedObject[key];
            if (entry && typeof entry === 'object' && entry.fieldName === fieldNameFromDocument) {
              return entry;
            }
          }
        }
      }

      console.warn(`No entry found with fieldName '${fieldNameFromDocument}' in selected object`);
      return null;
    } catch (error) {
      console.error('Failed to find mapped field entry:', error);
      return null;
    }
  }, [getSelectedDatapageObject]);

  // Fetch data from datapage on component load
  useEffect(() => {
    const fetchDatapageData = async () => {
      if (!datapage) {
        return;
      }

      try {
        // @ts-ignore - PCore is available globally in Pega runtime
        if (typeof PCore !== 'undefined' && PCore.getDataApiUtils) {
          // Construct parameters from datapageParameters prop
          const parameters = datapageParameters ? resolveDatapageParameters(datapageParameters) : {};
          
          const response = await PCore.getDataApiUtils().getData(
            datapage,
            parameters,
            pConn.getContextName?.() ?? "root",
            {
              invalidateCache: false,
            }
          );

          // Extract and parse the datapage response
          if (response.data?.data && Array.isArray(response.data.data)) {
            const parsedObjects = parseDatapageItems(response.data.data);
            datapageOptionsRef.current = parsedObjects;
          }
        }
      } catch (error) {
        console.error('Failed to fetch datapage data:', error);
        datapageOptionsRef.current = [];
      }
    };

    fetchDatapageData();
  }, [datapage, datapageParameters, pConn, resolveDatapageParameters]);

  // Handle mouse move to highlight hovered element
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isSelecting) return;

    e.preventDefault();
    e.stopPropagation();

    const target = e.target as HTMLElement;
    
    // Ignore our own overlay and highlight elements
    // Also ignore the selected element info display
    if (
      target === overlayRef.current || 
      target === highlightRef.current ||
      target.closest('[data-element-selector-overlay]') ||
      target.closest('[data-element-selector-info]')
    ) {
      return;
    }

    setHoveredElement(target);

    // Update highlight position
    if (highlightRef.current) {
      const rect = target.getBoundingClientRect();
      // Use fixed positioning with viewport coordinates (no scroll offset needed)
      highlightRef.current.style.top = `${rect.top}px`;
      highlightRef.current.style.left = `${rect.left}px`;
      highlightRef.current.style.width = `${rect.width}px`;
      highlightRef.current.style.height = `${rect.height}px`;
      highlightRef.current.style.display = 'block';
    }
  }, [isSelecting]);

  // Handle element click
  const handleElementClick = useCallback((e: MouseEvent) => {
    if (!isSelecting) return;

    e.preventDefault();
    e.stopPropagation();

    const target = e.target as HTMLElement;
    
    // Ignore our own overlay and highlight elements
    // Also ignore the selected element info display
    if (
      target === overlayRef.current || 
      target === highlightRef.current ||
      target.closest('[data-element-selector-overlay]') ||
      target.closest('[data-element-selector-info]')
    ) {
      return;
    }

    const elementInfo = getElementInfo(target);
    setSelectedElementInfo(elementInfo);
    
    // Update the field value with the selector
    const selectorValue = JSON.stringify(elementInfo, null, 2);
    actions.updateFieldValue(propName, selectorValue);

    // Fetch the current selected object from datapage (in case it changed since load)
    const selectedObject = getSelectedDatapageObject();
    selectedDocumentRef.current.DocID = selectedObject;

    // Try to find the mapped field entry if mappedProperty is available
    let mappedFieldEntry = null;
    if (elementInfo.mappedProperty) {
      mappedFieldEntry = findMappedFieldEntry();
    }

    // Publish element info via PubSub with tag, value, testid, property, and mapped field entry
    try {
      // @ts-ignore - PCore is available globally in Pega runtime
      if (typeof PCore !== 'undefined' && PCore.getPubSubUtils) {
        const pubSubData = {
          tag: elementInfo.tagName,
          value: elementInfo.value,
          testid: elementInfo.testId,
          property: elementInfo.property,
          mappedProperty: elementInfo.mappedProperty,
          selectedElement: mappedFieldEntry
        };
        console.log('ElementPropagate data:', pubSubData);
        PCore.getPubSubUtils().publish('ElementPropagate', pubSubData);
      }
    } catch (error) {
      console.warn('Failed to publish element info via PubSub:', error);
    }

    // Exit selection mode
    setIsSelecting(false);
    setHoveredElement(null);
  }, [isSelecting, actions, propName, getElementInfo, getSelectedDatapageObject, findMappedFieldEntry]);

  // Handle escape key to cancel selection
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isSelecting) {
      setIsSelecting(false);
      setHoveredElement(null);
    }
  }, [isSelecting]);

  // Setup and cleanup event listeners
  useEffect(() => {
    if (isSelecting) {
      document.addEventListener('mousemove', handleMouseMove, true);
      document.addEventListener('click', handleElementClick, true);
      document.addEventListener('keydown', handleKeyDown, true);
      document.body.style.cursor = 'crosshair';
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove, true);
        document.removeEventListener('click', handleElementClick, true);
        document.removeEventListener('keydown', handleKeyDown, true);
        document.body.style.cursor = '';
      };
    }
  }, [isSelecting, handleMouseMove, handleElementClick, handleKeyDown]);

  // Start element selection
  const toggleSelection = () => {
    if (isSelecting) {
      // If currently selecting, turn it off
      setIsSelecting(false);
      setHoveredElement(null);
    } else {
      // If not selecting, turn it on
      setIsSelecting(true);
      setSelectedElementInfo(null);
    }
  };

  // Display modes
  if (displayMode === 'LABELS_LEFT' || displayMode === 'DISPLAY_ONLY') {
    const displayComp = value || <span aria-hidden='true'>&ndash;&ndash;</span>;
    return displayMode === 'DISPLAY_ONLY' ? (
      <StyledCitiExtensionsElementSelectorWrapper> 
        {displayComp} 
      </StyledCitiExtensionsElementSelectorWrapper>
    ) : (
      <StyledCitiExtensionsElementSelectorWrapper>
        <FieldValueList
          variant={hideLabel ? 'stacked' : variant}
          data-testid={testId}
          fields={[{ id: '1', name: hideLabel ? '' : label, value: displayComp }]}
        />
      </StyledCitiExtensionsElementSelectorWrapper>
    );
  }

  if (displayMode === 'STACKED_LARGE_VAL') {
    const isValDefined = typeof value !== 'undefined' && value !== '';
    const val = isValDefined ? (
      <Text variant='h1' as='span'>
        {value}
      </Text>
    ) : (
      ''
    );
    return (
      <StyledCitiExtensionsElementSelectorWrapper>
        <FieldValueList
          variant='stacked'
          data-testid={testId}
          fields={[{ id: '2', name: hideLabel ? '' : label, value: val }]}
        />
      </StyledCitiExtensionsElementSelectorWrapper>
    );
  }

  return (
    <StyledCitiExtensionsElementSelectorWrapper>
      <div style={{ marginBottom: '8px' }}>
        {!hideLabel && label && <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>{label}</label>}
        <Button
          variant='secondary'
          onClick={toggleSelection}
          disabled={disabled || readOnly}
          data-testid={testId}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <CrosshairIcon />
            <span>{isSelecting ? 'Stop Selecting (or press ESC)' : 'Select Element'}</span>
          </span>
        </Button>
      </div>

      {selectedElementInfo && (
        <div 
          style={{ 
            padding: '12px', 
            backgroundColor: '#f5f5f5', 
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'monospace'
          }}
          data-element-selector-info="true"
        >
          <div style={{ marginBottom: '8px', fontWeight: 600 }}>Selected Element:</div>
          <div><strong>Tag:</strong> {selectedElementInfo.tagName}</div>
          {selectedElementInfo.testId && <div><strong>Test ID:</strong> {selectedElementInfo.testId}</div>}
          {selectedElementInfo.mappedProperty && <div><strong>Mapped Property:</strong> {selectedElementInfo.mappedProperty}</div>}
          <div><strong>Value:</strong> {selectedElementInfo.value || '(empty)'}</div>
          <div><strong>Property:</strong> {selectedElementInfo.property || '(empty)'}</div>
        </div>
      )}

      {isSelecting && (
        <>
          <StyledOverlay ref={overlayRef} data-element-selector-overlay="true" />
          <StyledHighlight ref={highlightRef} data-element-selector-overlay="true">
            {hoveredElement && (
              <StyledInfoBox>
                {hoveredElement.tagName.toLowerCase()}
                {hoveredElement.getAttribute('data-testid') && ` [${hoveredElement.getAttribute('data-testid')}]`}
              </StyledInfoBox>
            )}
          </StyledHighlight>
        </>
      )}
    </StyledCitiExtensionsElementSelectorWrapper>
  );
}

export default withConfiguration(CitiExtensionsElementSelector);
