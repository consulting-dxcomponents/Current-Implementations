/* eslint-disable react/jsx-no-useless-fragment */
// @ts-nocheck
import type { Meta, StoryObj } from '@storybook/react';
import CitiExtensionsAccordionWidget from './index';
import { MOCK_CHILDREN } from './mock';

// ── Mock getPConnect ──────────────────────────────────────────────────────────
const mockGetPConnect = () => ({
  getValue: (v: any) => v,
  getContextName: () => 'app/primary_1',
  getLocalizedValue: (v: any) => v,
  getInheritedProps: () => ({}),
  getActionsApi: () => ({ updateFieldValue: () => {}, triggerFieldChange: () => {} }),
  ignoreSuggestion: () => {},
  acceptSuggestion: () => {},
  setInheritedProps: () => {},
  resolveConfigProps: () => {},
});

// ── Meta ──────────────────────────────────────────────────────────────────────
/**
 * ## Citi_Extensions_AccordionWidget
 *
 * An accordion widget where the **number of panels is driven by a comma-separated
 * label string** configured in App Studio. Each panel renders an independently
 * customisable Pega view.
 *
 * ### App Studio configuration
 *
 * 1. Set **Widget title** and optional **Subtitle**.
 * 2. Enter **Panel labels** as a comma-separated string e.g. `Personal Info,Account,Security`.
 * 3. Optionally enter **Panel hint texts** in the same order e.g. `Fill your details,,Change password`.
 * 4. In the **Panel views (Fields)** content picker, add one Pega view/region per label entry
 *    in the **same order**.
 *
 * ### Props
 *
 * | Prop | Type | Default | Description |
 * |---|---|---|---|
 * | `title` | `string` | `'Options'` | Widget heading |
 * | `subtitle` | `string` | `''` | Instruction text below the heading |
 * | `panelLabels` | `string` | `''` | Comma-separated panel labels |
 * | `panelTooltips` | `string` | `''` | Comma-separated hint texts (positional) |
 * | `children` | `ReactNode[]` | `[]` | Pega view regions from the CONTENTPICKER |
 */
const meta: Meta<typeof CitiExtensionsAccordionWidget> = {
  title: 'CitiExtensionsAccordionWidget',
  component: CitiExtensionsAccordionWidget,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Accordion widget whose panels are driven by comma-separated label strings in App Studio. ' +
          'Each panel renders a customisable Pega view region. ' +
          'A radio icon and chevron indicate selected/expanded state. ' +
          'A single Expand all / Collapse all toggle is always available.',
      },
    },
  },
  argTypes: {
    title:         { control: 'text', description: 'Widget heading',                      table: { category: 'Display', defaultValue: { summary: 'Options' } } },
    subtitle:      { control: 'text', description: 'Instruction text below heading',      table: { category: 'Display' } },
    panelLabels:   { control: 'text', description: 'Comma-separated panel labels',        table: { category: 'Data' } },
    panelTooltips: { control: 'text', description: 'Comma-separated hint texts',          table: { category: 'Data' } },
  },
};

export default meta;
type Story = StoryObj<typeof CitiExtensionsAccordionWidget>;

// ── Story: Default ────────────────────────────────────────────────────────────
/**
 * Seven accordion panels — one per dispute reason — each backed by an editable form view.
 */
export const Default: Story = {
  name: 'Default — Dispute Reasons',
  render: args => (
    <CitiExtensionsAccordionWidget
      {...args}
      getPConnect={mockGetPConnect}
      children={MOCK_CHILDREN}
    />
  ),
  args: {
    title: 'Select Dispute Reason',
    subtitle: 'Choose the reason that best matches your dispute and provide the supporting details.',
    panelLabels:
      'Transaction Cancelled,Unauthorized Charge,Duplicate Charge,Goods not Received,Service not as Expected,Damaged Item,Returned Goods',
    panelTooltips:
      'The transaction was formally cancelled by the merchant or payment network, but the funds have not been credited back.,You never provided your card number to this merchant. You have checked with anyone else authorised to use your card and still do not recognise this charge.,You were charged more than once for the same purchase.,The company is out of business or unable to provide goods/services. You are missing items or did not get what you paid for.,You received something different than what you ordered. The terms and conditions of the sale were not met.,You agreed to a trial offer or your order was damaged during shipping. A product is defective or broken.,You returned something and were never credited for it.',
  },
};

// ── Story: ThreePanels ────────────────────────────────────────────────────────
/**
 * Minimal 3-panel variant — useful when only a subset of dispute reasons is needed.
 */
export const ThreePanels: Story = {
  name: 'Three panels',
  render: args => (
    <CitiExtensionsAccordionWidget
      {...args}
      getPConnect={mockGetPConnect}
      children={MOCK_CHILDREN.slice(0, 3)}
    />
  ),
  args: {
    title: 'Quick Dispute',
    subtitle: '',
    panelLabels: 'Transaction Cancelled,Unauthorized Charge,Duplicate Charge',
    panelTooltips:
      'The transaction was formally cancelled but funds have not been credited back.,You did not authorise this charge.,You were charged more than once for the same purchase.',
  },
};

// ── Story: NoTooltips ─────────────────────────────────────────────────────────
/**
 * Clean layout without any hint texts.
 */
export const NoTooltips: Story = {
  name: 'No tooltips',
  render: args => (
    <CitiExtensionsAccordionWidget
      {...args}
      getPConnect={mockGetPConnect}
      children={MOCK_CHILDREN.slice(0, 4)}
    />
  ),
  args: {
    title: 'Dispute Reasons',
    subtitle: '',
    panelLabels:
      'Transaction Cancelled,Unauthorized Charge,Duplicate Charge,Goods not Received',
    panelTooltips: '',
  },
};

// ── Story: NoViewsConfigured ──────────────────────────────────────────────────
/**
 * Panels configured but no view regions assigned yet — shows the
 * graceful "No fields configured" fallback inside each panel.
 */
export const NoViewsConfigured: Story = {
  name: 'Fallback — no views assigned',
  render: args => (
    <CitiExtensionsAccordionWidget
      {...args}
      getPConnect={mockGetPConnect}
      children={[]}
    />
  ),
  args: {
    title: 'New Form',
    subtitle: 'Assign views to each panel via the Fields content picker in App Studio.',
    panelLabels:   'Panel One,Panel Two,Panel Three',
    panelTooltips: '',
  },
};

// ── Story: Empty ──────────────────────────────────────────────────────────────
/**
 * Nothing configured — shows the empty-state placeholder.
 */
export const Empty: Story = {
  name: 'Empty state',
  render: args => (
    <CitiExtensionsAccordionWidget
      {...args}
      getPConnect={mockGetPConnect}
      children={[]}
    />
  ),
  args: {
    title: 'Accordion Widget',
    subtitle: '',
    panelLabels:   '',
    panelTooltips: '',
  },
};
