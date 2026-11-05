// @ts-nocheck
import type { Meta, StoryObj } from '@storybook/react';

import CitiExtensionsActionBar from './index';

const meta: Meta<typeof CitiExtensionsActionBar> = {
  title: 'Citi/Extensions/ActionBar',
  component: CitiExtensionsActionBar,
  excludeStories: /.*Data$/,
  parameters: {
    type: 'Widget',
    layout: 'padded',
    docs: {
      description: {
        component:
          'Footer action bar with Cancel on the left and Save / Save & Submit on the right. ' +
          'Cancel cancels the current assignment, Save saves it, and Save & Submit finishes ' +
          'the assignment and publishes the configured pub/sub event. ' +
          'The Save & Submit button is shown only when the "Enable Save & Submit" toggle is on.'
      }
    }
  }
};

export default meta;
type Story = StoryObj<typeof CitiExtensionsActionBar>;

/** Mock pConn with the assignment action APIs stubbed for the storybook demo. */
const makeGetPConnect = () => () => ({
  getCaseInfo: () => ({ getKey: () => 'CITI-WORK T-1001' }),
  getActionsApi: () => ({
    cancelAssignment: () => {
      alert('Assignment cancelled');
      return Promise.resolve();
    },
    saveAssignment: () => {
      alert('Assignment saved');
      return Promise.resolve();
    },
    finishAssignment: () => {
      alert('Assignment submitted');
      return Promise.resolve();
    }
  })
});

/** Base — Cancel / Save / Save & Submit all visible. */
export const BaseActionBar: Story = args => (
  <CitiExtensionsActionBar {...args} getPConnect={makeGetPConnect()} />
);

BaseActionBar.args = {
  enableSave: true,
  submitEventName: 'CitiIDPSaveAndSubmit',
  cancelButtonLabel: 'Cancel',
  saveButtonLabel: 'Save',
  saveAndSubmitButtonLabel: 'Save & Submit'
};

/** Save disabled — only Cancel and Save & Submit are shown. */
export const WithoutSave: Story = args => (
  <CitiExtensionsActionBar {...args} getPConnect={makeGetPConnect()} />
);

WithoutSave.args = {
  enableSave: false,
  submitEventName: 'CitiIDPSaveAndSubmit'
};
