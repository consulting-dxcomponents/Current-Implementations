// @ts-nocheck
import type { Meta, StoryObj } from '@storybook/react';
import CitiExtensionsExcelDocument from './index';
import { configProps } from './mock';

const meta: Meta<typeof CitiExtensionsExcelDocument> = {
  title: 'CitiExtensionsExcelDocument',
  component: CitiExtensionsExcelDocument,
  excludeStories: /.*Data$/
};

export default meta;
type Story = StoryObj<typeof CitiExtensionsExcelDocument>;

const getPConnect = () => ({
  getStateProps: () => ({ value: '.WorkbookContent', hasSuggestions: false }),
  getActionsApi: () => ({
    updateFieldValue: (_propName: string, _value: string) => { /* no-op */ },
    triggerFieldChange: () => { /* no-op */ }
  }),
  getComponentName: () => '',
  getLocalizedValue: (value: string) => value,
  getRawMetadata: () => ({}),
  getChildren: () => [],
  ignoreSuggestion: () => { /* no-op */ },
  acceptSuggestion: () => { /* no-op */ },
  setInheritedProps: () => { /* no-op */ },
  resolveConfigProps: () => { /* no-op */ }
});

export const BaseCitiExtensionsExcelDocument: Story = {
  args: { ...configProps, getPConnect }
};

export const SmallGrid: Story = {
  args: { ...configProps, workbookTitle: 'Small Grid', initialRows: 8, initialCols: 5, getPConnect }
};

export const LargeGrid: Story = {
  args: { ...configProps, workbookTitle: 'Large Dataset', initialRows: 50, initialCols: 15, getPConnect }
};
