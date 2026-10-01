/* eslint-disable react/jsx-no-useless-fragment */
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { stateProps, configProps } from './mock';

import CitiExtensionsMaskedInputReadOnly from './index';

const meta: Meta<typeof CitiExtensionsMaskedInputReadOnly> = {
  title: 'Citi/Extensions/Masked Input (Read-only)',
  component: CitiExtensionsMaskedInputReadOnly,
  excludeStories: /.*Data$/,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
**Masked Input (Read-only)** is a read-only display field with a toggleable eye icon that lets the user reveal or hide the underlying value. By default the value is partially obscured (the last few characters remain visible) and clicking the eye icon reveals or re-masks the full value on demand. The component never mutates the Pega property — it is for display only.

### Business use case
This component is used to render sensitive values (e.g. card numbers, account numbers, SSN, secret keys) on review and summary screens where the user may need to verify the value but should not be able to edit it. The masked-by-default behaviour protects against casual observation while still giving the user a one-click way to confirm what is stored.

### Why a custom component?
The requirement called for a read-only field that:

- Hides sensitive values by default while leaving a configurable number of trailing characters visible (so the user can still identify which value they're looking at — e.g. "**** **** **** 1234").
- Allows the user to fully reveal / re-mask the value with a single click.
- Never modifies the underlying Pega property — the toggle is purely a local display affordance.
- Inherits the platform theme so it looks identical to other read-only fields on the page.

### Behaviour
- The field starts masked (\`defaultMasked={true}\`) or fully revealed (\`defaultMasked={false}\`) depending on configuration.
- \`visibleChars\` controls how many trailing characters stay visible in the masked view (default: \`4\`).
- The eye icon toggles between an open eye (value visible) and a crossed-out eye (value hidden) to reflect the current state.
- The \`disabled\` prop disables only the eye toggle — the value itself is always shown (masked or unmasked).

---

### Maintainers

In case of any feedback or questions regarding implementation, please reach out to **[Sravan.Mamidi@pega.com](mailto:Sravan.Mamidi@pega.com)** / **[PCI-FrontEndTeam@pega.com](mailto:PCI-FrontEndTeam@pega.com)**.
        `.trim(),
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    label: {
      control: 'text',
      description: 'Label displayed beside the value.',
      table: {
        type: { summary: 'string' },
      },
    },
    hideLabel: {
      control: 'boolean',
      description: 'When `true`, the label is not rendered and only the value + eye-toggle pair is shown.',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },
    defaultMasked: {
      control: 'boolean',
      description: 'When `true` (default), the field value is hidden on initial render. The user can reveal it by clicking the eye icon.',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },
    visibleChars: {
      control: { type: 'number', min: 0, max: 16 },
      description: 'Number of trailing characters that remain visible while the value is masked.',
      table: {
        type: { summary: 'number' },
        defaultValue: { summary: '4' },
      },
    },
    disabled: {
      control: 'boolean',
      description: 'When `true`, the eye toggle button is disabled — the value is shown in whatever state it was last left in.',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    testId: {
      control: 'text',
      description: 'Value applied to the `data-testid` attribute on the value span for automated testing.',
      table: {
        type: { summary: 'string' },
        category: 'Testing',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof CitiExtensionsMaskedInputReadOnly>;

// Shared mock getPConnect — the component is read-only so none of the actions
// are actually invoked, but the shape must match what `withConfiguration` expects.
const buildMockPConnect = (setValue: (v: any) => void) => () => ({
  getStateProps: () => stateProps,
  getActionsApi: () => ({
    updateFieldValue: (_propName: string, theValue: any) => setValue(theValue),
    triggerFieldChange: () => {
      /* nothing */
    }
  }),
  ignoreSuggestion: () => {
    /* nothing */
  },
  acceptSuggestion: () => {
    /* nothing */
  },
  setInheritedProps: () => {
    /* nothing */
  },
  resolveConfigProps: () => {
    /* nothing */
  }
});

export const Default: Story = {
  name: 'Default (Masked)',
  parameters: {
    docs: {
      description: {
        story:
          'The field in its default state — value is pre-filled and masked, with the last 4 characters visible. Click the eye icon to reveal the full value, then click again to re-mask it.',
      },
      source: {
        code: `<CitiExtensionsMaskedInputReadOnly
  getPConnect={getPConnect}
  label="Card Number"
  defaultMasked={true}
  visibleChars={4}
/>`,
      },
    },
  },
  args: {
    label: configProps.label,
    testId: configProps.testId,
    disabled: configProps.disabled,
    hideLabel: configProps.hideLabel,
    defaultMasked: true,
    visibleChars: 4,
  },
  render: (args: any) => {
    const [value, setValue] = useState(configProps.value);
    const props = { value, getPConnect: buildMockPConnect(setValue) };
    return <CitiExtensionsMaskedInputReadOnly {...props} {...args} />;
  }
};

export const Unmasked: Story = {
  name: 'Unmasked by default',
  parameters: {
    docs: {
      description: {
        story:
          'When `defaultMasked={false}`, the full value is visible on load. The eye icon is still present so the user can mask it if needed.',
      },
      source: {
        code: `<CitiExtensionsMaskedInputReadOnly
  getPConnect={getPConnect}
  label="Card Number"
  defaultMasked={false}
/>`,
      },
    },
  },
  args: {
    label: 'Card Number',
    testId: 'masked-unmasked',
    disabled: false,
    hideLabel: false,
    defaultMasked: false,
    visibleChars: 4,
  },
  render: (args: any) => {
    const [value, setValue] = useState(configProps.value);
    const props = { value, getPConnect: buildMockPConnect(setValue) };
    return <CitiExtensionsMaskedInputReadOnly {...props} {...args} />;
  }
};

export const Disabled: Story = {
  name: 'Disabled toggle',
  parameters: {
    docs: {
      description: {
        story:
          'When `disabled={true}`, the eye toggle is non-interactive. The value remains in whatever state was set by `defaultMasked`.',
      },
      source: {
        code: `<CitiExtensionsMaskedInputReadOnly
  getPConnect={getPConnect}
  label="Account Number"
  defaultMasked={true}
  disabled={true}
/>`,
      },
    },
  },
  args: {
    label: 'Account Number',
    testId: 'masked-disabled',
    disabled: true,
    hideLabel: false,
    defaultMasked: true,
    visibleChars: 4,
  },
  render: (args: any) => {
    const [value, setValue] = useState('GB29NWBK60161331926819');
    const props = { value, getPConnect: buildMockPConnect(setValue) };
    return <CitiExtensionsMaskedInputReadOnly {...props} {...args} />;
  }
};

export const HiddenLabel: Story = {
  name: 'Hidden label',
  parameters: {
    docs: {
      description: {
        story:
          'When `hideLabel={true}`, the label is omitted and only the value + eye toggle is rendered. Useful inside table cells or summary widgets.',
      },
      source: {
        code: `<CitiExtensionsMaskedInputReadOnly
  getPConnect={getPConnect}
  hideLabel={true}
  defaultMasked={true}
/>`,
      },
    },
  },
  args: {
    label: 'SSN',
    testId: 'masked-hidden-label',
    disabled: false,
    hideLabel: true,
    defaultMasked: true,
    visibleChars: 4,
  },
  render: (args: any) => {
    const [value, setValue] = useState('123-45-6789');
    const props = { value, getPConnect: buildMockPConnect(setValue) };
    return <CitiExtensionsMaskedInputReadOnly {...props} {...args} />;
  }
};
