
/* eslint-disable react/jsx-no-useless-fragment */
// @ts-nocheck
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { stateProps, configProps } from './mock';

import CitiExtensionsElementSelector from './index';

const meta: Meta<typeof CitiExtensionsElementSelector> = {
  title: 'CitiExtensionsElementSelector',
  component: CitiExtensionsElementSelector,
  excludeStories: /.*Data$/
};

export default meta;
type Story = StoryObj<typeof CitiExtensionsElementSelector>;

export const BaseCitiExtensionsElementSelector: Story = args => {

  const [value, setValue] = useState(configProps.value);

  const props = {
    value,
    hasSuggestions: configProps.hasSuggestions,

    getPConnect: () => {
      return {
        getStateProps: () => {
          return stateProps;
        },
        getActionsApi: () => {
          return {
            updateFieldValue: (propName, theValue) => {
              setValue(theValue);
            },
            triggerFieldChange: () => {/* nothing */}
          };
        },
        ignoreSuggestion: () => {/* nothing */},
        acceptSuggestion: () => {/* nothing */},
        setInheritedProps: () => {/* nothing */},
        resolveConfigProps: () => {/* nothing */}
      };
    }
  };

  return (
    <>
      <div style={{ padding: '20px', backgroundColor: '#fff' }}>
        <h2>Element Selector Demo</h2>
        <p>Click the button below to start selecting elements on the page. You can select any element, including those in the form below.</p>
        
        <CitiExtensionsElementSelector {...props} {...args} />
        
        <div style={{ marginTop: '30px', padding: '20px', border: '1px solid #ccc', borderRadius: '4px' }}>
          <h3>Sample Form Elements</h3>
          <p>Try selecting elements from this sample form:</p>
          
          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="name-input" style={{ display: 'block', marginBottom: '5px' }}>Name:</label>
            <input 
              id="name-input" 
              type="text" 
              placeholder="Enter your name" 
              data-testid="participant-name-field"
              style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="email-input" style={{ display: 'block', marginBottom: '5px' }}>Email:</label>
            <input 
              id="email-input" 
              type="email" 
              placeholder="Enter your email" 
              data-testid="participant-email-field"
              style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="message-input" style={{ display: 'block', marginBottom: '5px' }}>Message:</label>
            <textarea 
              id="message-input" 
              placeholder="Enter your message" 
              rows={4}
              data-testid="participant-message-field"
              style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </div>
          
          <button 
            type="button"
            data-testid="submit-button"
            style={{ padding: '10px 20px', backgroundColor: '#0066ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Submit
          </button>
        </div>
        
        <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
          <h3>Instructions</h3>
          <ul>
            <li>Click the "Select Element" button to activate the element selector</li>
            <li>Move your mouse over any element on the page - it will be highlighted in blue</li>
            <li>The element's tag name, ID, and classes will appear in a tooltip</li>
            <li>Click on an element to select it</li>
            <li>The selected element's details (tag, ID, classes, test ID, CSS selector, XPath) will be displayed</li>
            <li>Press ESC to cancel the selection mode</li>
            <li>You can scroll the page to select elements that are out of view</li>
            <li>Try selecting the form fields above - they have data-testid attributes</li>
          </ul>
        </div>
      </div>
    </>
  );
};

BaseCitiExtensionsElementSelector.args = {
  label: 'Element Selector',
  helperText: configProps.helperText,
  placeholder: configProps.placeholder,
  testId: configProps.testId,
  readOnly: configProps.readOnly,
  disabled: configProps.disabled,
  required: configProps.required,
  status: configProps.status,
  hideLabel: false,
  displayMode: configProps.displayMode,
  validatemessage: configProps.validatemessage
};

