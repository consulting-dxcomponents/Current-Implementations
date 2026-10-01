
/* eslint-disable react/jsx-no-useless-fragment */
// @ts-nocheck
import { useState, useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { stateProps, configProps } from './mock';

import CitiExtensionsCppd from './index';

const meta: Meta<typeof CitiExtensionsCppd> = {
  title: 'CitiExtensionsCppd',
  component: CitiExtensionsCppd,
  excludeStories: /.*Data$/,
  parameters: {
    docs: {
      description: {
        component:
          'CPPD Component - Supports rendering as a text input field or as a clickable link that invokes a data page and launches a URL in a new window.'
      }
    }
  }
};

export default meta;
type Story = StoryObj<typeof CitiExtensionsCppd>;

// Helper function to create mock getPConnect with optional URL mocking
const createMockPConnect = (dataPageParams?: Record<string, any>) => {
  return {
    getStateProps: () => stateProps,
    getActionsApi: () => ({
      updateFieldValue: (propName: string, theValue: any) => {
        // nothing
      },
      triggerFieldChange: () => {/* nothing */}
    }),
    getRawConfigProps: () => ({
      parameters: dataPageParams || {}
    }),
    resolveConfigProps: (params: any) => params || {},
    getContextName: () => 'cppd_context',
    ignoreSuggestion: () => {/* nothing */},
    acceptSuggestion: () => {/* nothing */},
    setInheritedProps: () => {/* nothing */}
  };
};

// Mock data page responses for testing
// Note: getData returns an array of results
const mockDataPageResponses: Record<string, any> = {
  'D_GetReportURL': [
    {
      reportUrl: 'https://www.example.com',
      reportId: 'RPT-2024-001',
      generatedDate: '2026-08-18'
    }
  ],
  'D_GetDocURL': [
    {
      url: 'https://www.google.com',
      docTitle: 'User Guide',
      version: '1.0.0'
    }
  ],
  'D_GenerateReport': [
    {
      downloadUrl: 'https://www.github.com',
      status: 'ready',
      size: '2.5MB'
    }
  ],
  'D_GetAction': [
    {
      actionUrl: 'https://www.pega.com',
      actionId: 'ACT-789',
      name: 'Process Action'
    }
  ],
  'D_GetServiceConfig': [
    {
      response: {
        data: {
          externalUrl: 'https://www.wikipedia.org',
          serviceName: 'External Portal',
          apiVersion: '2.1'
        }
      }
    }
  ]
};

// Store original window.open for potential restoration
const originalWindowOpen = window.open;

/**
 * Primary Link - Clickable link that invokes data page
 */
export const PrimaryLink: Story = args => {
  const [clickCount, setClickCount] = useState(0);
  const [lastUrl, setLastUrl] = useState('');

  // Data page parameters
  const dataPageParams = { reportType: 'monthly' };

  // Set up mock PCore API on component mount
  useEffect(() => {
    console.log('[Setup] Initializing mock PCore API for PrimaryLink');
    
    // Setup PCore mock
    if (!(window as any).PCore) {
      (window as any).PCore = {};
    }
    (window as any).PCore.getDataApiUtils = () => ({
      getData: async (dataPageName: string, payload: any, contextName: string) => {
        console.log('[Mock API] Calling getData for data page:', dataPageName);
        console.log('[Mock API] Context Name:', contextName);
        console.log('[Mock API] Payload:', payload);
        // Always return an array of results
        const response = mockDataPageResponses[dataPageName] || [{ url: 'https://www.example.com' }];
        console.log('[Mock API] Returning response:', response);
        return response;
      }
    });
    (window as any).PCore.getRestClient = () => ({});
    (window as any).PCore.getContainerUtils = () => ({});
    
    // Override window.open to track calls and actually open the URL
    const originalOpen = window.open;
    window.open = (url: string, target: string, features: string) => {
      console.log('[Mock] Window.open called with:');
      console.log('  URL:', url);
      console.log('  Target:', target);
      console.log('  Features:', features);
      // Track the click and URL for visual feedback
      setClickCount(prev => prev + 1);
      setLastUrl(url);
      // Actually open the URL in a new window
      return originalOpen(url, target, features);
    };
    
    return () => {
      console.log('[Cleanup] Cleaning up PrimaryLink mock');
      window.open = originalWindowOpen;
    };
  }, []);

  const props = {
    hasSuggestions: configProps.hasSuggestions,
    getPConnect: () => createMockPConnect(dataPageParams)
  };

  return (
    <>
      <CitiExtensionsCppd {...props} {...args} />
      {clickCount > 0 && (
        <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#e3f2fd', borderRadius: '4px', fontSize: '14px' }}>
          <strong>✓ Link clicked!</strong> (Click count: {clickCount})<br />
          URL opened: <code style={{ backgroundColor: '#fff', padding: '4px', borderRadius: '2px' }}>{lastUrl}</code>
          <br />
          <span style={{ fontSize: '12px', color: '#666' }}>A new window should open with the URL above.</span>
        </div>
      )}
    </>
  );
};

PrimaryLink.args = {
  label: 'Report Link',
  linkLabel: 'Open Report',
  dataPageName: 'D_GetReportURL',
  linkType: 'primary',
  urlProperty: 'reportUrl',
  windowWidth: '1200',
  windowHeight: '800',
  testId: 'cppd-primary-link',
  disabled: false,
  hideLabel: false
};

PrimaryLink.parameters = {
  docs: {
    description: {
      story:
        'Primary link styled as a button. Clicking it invokes a data page with parameters and launches the resulting URL in a new window. Check browser console to see mock API calls.'
    }
  }
};

/**
 * Secondary Link - Link-style clickable element
 */
export const SecondaryLink: Story = args => {
  const [clickCount, setClickCount] = useState(0);
  const [lastUrl, setLastUrl] = useState('');

  // Data page parameters
  const dataPageParams = { docType: 'user-guide' };

  // Set up mock PCore API on component mount
  useEffect(() => {
    console.log('[Setup] Initializing mock PCore API for SecondaryLink');
    
    // Setup PCore mock
    if (!(window as any).PCore) {
      (window as any).PCore = {};
    }
    (window as any).PCore.getDataApiUtils = () => ({
      getData: async (dataPageName: string, payload: any, contextName: string) => {
        console.log('[Mock API] Calling getData for data page:', dataPageName);
        console.log('[Mock API] Context Name:', contextName);
        console.log('[Mock API] Payload:', payload);
        // Always return an array of results
        const response = mockDataPageResponses[dataPageName] || [{ url: 'https://www.example.com' }];
        console.log('[Mock API] Returning response:', response);
        return response;
      }
    });
    (window as any).PCore.getRestClient = () => ({});
    (window as any).PCore.getContainerUtils = () => ({});
    
    // Override window.open to track calls and actually open the URL
    const originalOpen = window.open;
    window.open = (url: string, target: string, features: string) => {
      console.log('[Mock] Window.open called with:');
      console.log('  URL:', url);
      console.log('  Target:', target);
      console.log('  Features:', features);
      // Track the click and URL for visual feedback
      setClickCount(prev => prev + 1);
      setLastUrl(url);
      // Actually open the URL in a new window
      return originalOpen(url, target, features);
    };
    
    return () => {
      console.log('[Cleanup] Cleaning up SecondaryLink mock');
      window.open = originalWindowOpen;
    };
  }, []);

  const props = {
    hasSuggestions: configProps.hasSuggestions,
    getPConnect: () => createMockPConnect(dataPageParams)
  };

  return (
    <>
      <CitiExtensionsCppd {...props} {...args} />
      {clickCount > 0 && (
        <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#e3f2fd', borderRadius: '4px', fontSize: '14px' }}>
          <strong>✓ Link clicked!</strong> (Click count: {clickCount})<br />
          URL opened: <code style={{ backgroundColor: '#fff', padding: '4px', borderRadius: '2px' }}>{lastUrl}</code>
          <br />
          <span style={{ fontSize: '12px', color: '#666' }}>A new window should open with the URL above.</span>
        </div>
      )}
    </>
  );
};

SecondaryLink.args = {
  label: 'Documentation',
  linkLabel: 'View Full Documentation',
  dataPageName: 'D_GetDocURL',
  linkType: 'secondary',
  urlProperty: 'url',
  windowWidth: '1024',
  windowHeight: '768',
  testId: 'cppd-secondary-link',
  disabled: false,
  hideLabel: false
};

SecondaryLink.parameters = {
  docs: {
    description: {
      story: 'Secondary link styled as underlined text. Has hover effects for better UX. Check browser console to see mock API calls.'
    }
  }
};

/**
 * Disabled Link
 */
export const DisabledLink: Story = args => {
  const [clickCount, setClickCount] = useState(0);
  const [lastUrl, setLastUrl] = useState('');

  // Data page parameters
  const dataPageParams = { reportId: '123' };

  // Set up mock PCore API on component mount
  useEffect(() => {
    console.log('[Setup] Initializing mock PCore API for DisabledLink');
    
    // Setup PCore mock
    if (!(window as any).PCore) {
      (window as any).PCore = {};
    }
    (window as any).PCore.getDataApiUtils = () => ({
      getData: async (dataPageName: string, payload: any, contextName: string) => {
        console.log('[Mock API] Calling getData for data page:', dataPageName);
        console.log('[Mock API] Context Name:', contextName);
        console.log('[Mock API] Payload:', payload);
        // Always return an array of results
        const response = mockDataPageResponses[dataPageName] || [{ url: 'https://www.example.com' }];
        console.log('[Mock API] Returning response:', response);
        return response;
      }
    });
    (window as any).PCore.getRestClient = () => ({});
    (window as any).PCore.getContainerUtils = () => ({});
    
    // Override window.open to track calls and actually open the URL
    const originalOpen = window.open;
    window.open = (url: string, target: string, features: string) => {
      console.log('[Mock] Window.open called with:');
      console.log('  URL:', url);
      console.log('  Target:', target);
      console.log('  Features:', features);
      // Track the click and URL for visual feedback
      setClickCount(prev => prev + 1);
      setLastUrl(url);
      // Actually open the URL in a new window
      return originalOpen(url, target, features);
    };
    
    return () => {
      console.log('[Cleanup] Cleaning up DisabledLink mock');
      window.open = originalWindowOpen;
    };
  }, []);

  const props = {
    hasSuggestions: configProps.hasSuggestions,
    getPConnect: () => createMockPConnect(dataPageParams)
  };

  return (
    <>
      <CitiExtensionsCppd {...props} {...args} />
      {clickCount > 0 && (
        <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#e3f2fd', borderRadius: '4px', fontSize: '14px' }}>
          <strong>✓ Link clicked!</strong> (Click count: {clickCount})<br />
          URL opened: <code style={{ backgroundColor: '#fff', padding: '4px', borderRadius: '2px' }}>{lastUrl}</code>
          <br />
          <span style={{ fontSize: '12px', color: '#666' }}>A new window should open with the URL above.</span>
        </div>
      )}
    </>
  );
};

DisabledLink.args = {
  label: 'Unavailable Report',
  linkLabel: 'Generate Report',
  dataPageName: 'D_GenerateReport',
  linkType: 'primary',
  urlProperty: 'downloadUrl',
  windowWidth: '900',
  windowHeight: '700',
  testId: 'cppd-disabled-link',
  disabled: true,
  hideLabel: false
};

DisabledLink.parameters = {
  docs: {
    description: {
      story: 'Disabled link that cannot be clicked. Click handler will not fire.'
    }
  }
};


