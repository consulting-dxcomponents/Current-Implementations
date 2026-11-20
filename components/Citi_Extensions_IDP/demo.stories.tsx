// @ts-nocheck
import type { Meta, StoryObj } from '@storybook/react';

import CitiExtensionsIdp from './index';
import { idpSpec, mockResolvedValues, mockDocumentUrl, mockDocumentMimeType } from './mock';

const meta: Meta<typeof CitiExtensionsIdp> = {
  title: 'Citi/Extensions/IDP',
  component: CitiExtensionsIdp,
  excludeStories: /.*Data$/,
  parameters: {
    type: 'Template',
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Intelligent Document Processing review template. ' +
          'Renders the source trade document on the left and a spec-driven review panel on the right. ' +
          'Section/repeatable render order is controlled by the `order` property in the IDP spec. ' +
          'Each field\'s displayType is resolved through DISPLAY_TYPE_MAP (idpTypes.ts) to the correct Cosmos component. ' +
          'Footer provides Submit for Authorization and Close Case actions only.'
      }
    }
  }
};

export default meta;
type Story = StoryObj<typeof CitiExtensionsIdp>;

// ─── Shared mock row data ─────────────────────────────────────────────────────

/**
 * Mock repeatable rows for the beneficialOwners group.
 * Each object is one row; key = IdpFieldSpec.fieldKey.
 */
// Rows cover all 4 field types defined in the beneficialOwners repeatable:
//   uboName (textbox), uboDob (date), uboEmail (email), uboOwnershipPct (number)
const mockRepeatableRows = {
  beneficialOwners: [
    {
      uboName:         'Jane Smith',
      uboDob:          '1978-04-22',
      uboEmail:        'jane.smith@example.com',
      uboOwnershipPct: '45.00'
    },
    {
      uboName:         'John Doe',
      uboDob:          '1965-11-03',
      uboEmail:        'john.doe@example.com',
      uboOwnershipPct: '30.00'
    },
    {
      uboName:         'Priya Nair',
      uboDob:          '1990-07-18',
      uboEmail:        'p.nair@example.com',
      uboOwnershipPct: '25.00'
    }
  ]
};

// ─── Stories ──────────────────────────────────────────────────────────────────

/**
 * Base — full three-pane IDP layout.
 *   Left   : live PDF viewer
 *   Right  : review panel ordered by spec (Case Summary → Beneficial Owners)
 *   Footer : Submit for Authorization + Close Case
 */
export const BaseCitiExtensionsIdp: Story = args => {
  const getPConnect = () => ({ getInheritedProps: () => ({}) });

  return (
    <CitiExtensionsIdp
      {...args}
      getPConnect={getPConnect}
      idpSpec={idpSpec}
      resolvedValues={mockResolvedValues}
      repeatableRows={mockRepeatableRows}
    />
  );
};

BaseCitiExtensionsIdp.args = {
  documentUrl:              mockDocumentUrl,
  documentMimeType:         mockDocumentMimeType,
  label:                    'IDP Review — Client Onboarding',
  showLabel:                true,
  NumCols:                  '1',
  onSubmitForAuthorization: () => alert('Submitted for Authorization'),
  onCloseCase:              () => alert('Case Closed')
};

BaseCitiExtensionsIdp.argTypes = {
  documentMimeType: {
    control: { type: 'select' },
    options: ['application/pdf', 'image/tiff', 'image/png', 'image/jpeg'],
    description: 'MIME type of the source document'
  },
  NumCols: {
    control: { type: 'select' },
    options: ['1', '2', '3'],
    description: 'Number of columns in the review panel grid'
  }
};

/**
 * No document — viewer shows empty state; review panel renders normally.
 */
export const NoDocument: Story = args => {
  const getPConnect = () => ({ getInheritedProps: () => ({}) });

  return (
    <CitiExtensionsIdp
      {...args}
      getPConnect={getPConnect}
      idpSpec={idpSpec}
      resolvedValues={mockResolvedValues}
      repeatableRows={mockRepeatableRows}
    />
  );
};

NoDocument.args = {
  ...BaseCitiExtensionsIdp.args,
  documentUrl: '',
  label:       'IDP Review — No Document'
};

/**
 * No spec — review panel shows "No review data available" empty state.
 */
export const NoReviewData: Story = args => {
  const getPConnect = () => ({ getInheritedProps: () => ({}) });

  return (
    <CitiExtensionsIdp
      {...args}
      getPConnect={getPConnect}
    />
  );
};

NoReviewData.args = {
  ...BaseCitiExtensionsIdp.args,
  label: 'IDP Review — No Data'
};

/**
 * Display-only mode — DISPLAY_ONLY branch; all fields rendered read-only
 * with inline FieldValueList variant.
 */
export const DisplayOnly: Story = args => {
  const getPConnect = () => ({ getInheritedProps: () => ({}) });

  return (
    <CitiExtensionsIdp
      {...args}
      getPConnect={getPConnect}
      idpSpec={idpSpec}
      resolvedValues={mockResolvedValues}
      repeatableRows={mockRepeatableRows}
    />
  );
};

DisplayOnly.args = {
  ...BaseCitiExtensionsIdp.args,
  label:       'IDP Review — Display Only',
  readOnly:    true,
  displayMode: 'DISPLAY_ONLY'
};
