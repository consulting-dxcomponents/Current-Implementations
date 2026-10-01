
/* eslint-disable react/jsx-no-useless-fragment */
// @ts-nocheck
import type { Meta, StoryObj } from '@storybook/react';
import { configProps, stateProps } from './mock';
import PegaFieldMaskedDateField from './index';

const meta: Meta<typeof PegaFieldMaskedDateField> = {
  title: 'PegaFieldMaskedDateField',
  component: PegaFieldMaskedDateField,
  excludeStories: /.*Data$/
};

export default meta;
type Story = StoryObj<typeof PegaFieldMaskedDateField>;

if (!window.PCore) {
  window.PCore = {} as any;
}

window.PCore.getEnvironmentInfo = () => {
  return {
    getTimeZone: () => {
      return '';
    },
    getLocale: () => {
      return 'en-GB';
    }
  } as any;
};

export const BasePegaFieldMaskedDateField: Story = args => {
  const props = {
    value: configProps.value,
    additionalProps: configProps.additionalProps,
    hasSuggestions: configProps.hasSuggestions,
    getPConnect: () => {
      return {
        getActionsApi: () => {
          return {
            updateFieldValue: () => {/* nothing */},
            triggerFieldChange: () => {/* nothing */}
          };
        },
        getValidationApi: () => {
          return {
            validate: () => {/* nothing */}
          };
        },
        getStateProps: () => {
          return stateProps;
        },
        getConfigProps: () => {
          return configProps;
        },
        ignoreSuggestion: () => {/* nothing */},
        acceptSuggestion: () => {/* nothing */},
        clearErrorMessages: () => {/* nothing */}
      };
    }
  };

  return (
    <>
      <PegaFieldMaskedDateField {...props} {...args} />
    </>
  );
};

BasePegaFieldMaskedDateField.args = {
  label: configProps.label,
  helperText: configProps.helperText,
  showWeekNumber: configProps.showWeekNumber,
  testId: configProps.testId,
  readOnly: configProps.readOnly,
  disabled: configProps.disabled,
  required: configProps.required,
  status: configProps.status,
  hideLabel: configProps.hideLabel,
  nextYearRange: configProps.nextYearRange,
  previousYearRange: configProps.previousYearRange,
  showAsFormattedText: configProps.showAsFormattedText,
  displayMode: configProps.displayMode,
  variant: configProps.variant,
  validatemessage: configProps.validatemessage,
  defaultMasked: configProps.defaultMasked,
  visibleChars: configProps.visibleChars
};
