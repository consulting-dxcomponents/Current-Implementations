
/* eslint-disable react/jsx-no-useless-fragment */
// @ts-nocheck
import type { Meta, StoryObj } from '@storybook/react';

import CitiExtensionsUrlSameWindow from './index';
import { stateProps, configProps } from './mock';

const meta: Meta<typeof CitiExtensionsUrlSameWindow> = {
  title: 'CitiExtensionsUrlSameWindow',
  component: CitiExtensionsUrlSameWindow,
  excludeStories: /.*Data$/
};

export default meta;
type Story = StoryObj<typeof CitiExtensionsUrlSameWindow>;

export const BaseCitiExtensionsUrlSameWindow: Story = args => {

  const props = {
    value: configProps.value,
    hasSuggestions: configProps.hasSuggestions,
    getPConnect: () => {
      return {
        getStateProps: () => {
          return stateProps;
        },
        getActionsApi: () => {
          return {
            updateFieldValue: () => {/* nothing */},
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
      <CitiExtensionsUrlSameWindow {...props} {...args} />
    </>
  );
};

BaseCitiExtensionsUrlSameWindow.args = {
  label: configProps.label,
  helperText: configProps.helperText,
  placeholder: configProps.placeholder,
  testId: configProps.testId,
  readOnly: configProps.readOnly,
  disabled: configProps.disabled,
  required: configProps.required,
  status: configProps.status,
  hideLabel: configProps.hideLabel,
  displayMode: configProps.displayMode,
  variant: configProps.variant,
  validatemessage: configProps.validatemessage
};

// Renders the field in read-only mode with an external URL so the same-window navigation can be verified
export const ExternalUrlCitiExtensionsUrlSameWindow: Story = args => {

  const props = {
    value: 'https://www.wikipedia.org',
    hasSuggestions: false,
    getPConnect: () => {
      return {
        getStateProps: () => {
          return stateProps;
        },
        getActionsApi: () => {
          return {
            updateFieldValue: () => {/* nothing */},
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
      <CitiExtensionsUrlSameWindow {...props} {...args} />
    </>
  );
};

ExternalUrlCitiExtensionsUrlSameWindow.args = {
  label: 'External URL',
  testId: 'url-external-12345',
  hideLabel: false,
  readOnly: true,
  disabled: false,
  required: false,
  displayMode: 'DISPLAY_ONLY',
  displayAs: 'defaultURL',
  variant: configProps.variant
};
