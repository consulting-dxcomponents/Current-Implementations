// import { expect, test } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { composeStories } from '@storybook/react';
import '@testing-library/jest-dom';

import * as DemoStories from './demo.stories';

const { Default } = composeStories(DemoStories);

test('renders CitiExtensionsMaskedInputReadOnly with masked value', async () => {
  render(<Default />);

  // Label is rendered alongside the value (default story has hideLabel=false)
  expect(await screen.findByText('Card Number')).toBeVisible();

  // The value span has the testId from the story args and renders the masked value
  // (default visibleChars = 4, value = '4111111111111234' → '************1234')
  const valueElement = screen.getByTestId('masked-readonly-default');
  expect(valueElement).toBeVisible();
  expect(valueElement.textContent).toBe('************1234');
});
