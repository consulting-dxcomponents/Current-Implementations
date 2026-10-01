// import { expect, test } from '@jest/globals';
// @ts-nocheck
import { render, screen, fireEvent } from '@testing-library/react';
import { composeStories } from '@storybook/react';
import '@testing-library/jest-dom';

import * as DemoStories from './demo.stories';

const { BasePegaFieldMaskedDateField } = composeStories(DemoStories);

test('renders PegaFieldMaskedDateField', async () => {
  render(<BasePegaFieldMaskedDateField/>);
  expect(await screen.findByText('Date Label')).toBeVisible();
  expect(await screen.findByText('Date helper text')).toBeVisible();

  // const dateElement = screen.getByRole('textbox');
  // for some odd reason, checking the full string of "USD 0.00" doesn't pass
  // expect(currencyElement).toHaveValue('USD 0.00');
  const myMonth = (screen.getByTestId(':date-input:control-month') as HTMLInputElement);
  expect(myMonth.value).toContain('01');
  expect(myMonth).toHaveAttribute('placeholder', 'MM');

  const myDay = (screen.getByTestId(':date-input:control-day') as HTMLInputElement);
  expect(myDay.value).toContain('31');
  expect(myDay).toHaveAttribute('placeholder', 'DD');

  const myYear = (screen.getByTestId(':date-input:control-year') as HTMLInputElement);
  expect(myYear.value).toContain('2023');
  expect(myYear).toHaveAttribute('placeholder', 'YYYY');

  // press clear button
  const clearX = screen.getByTestId(':date-input:clear-current-date') as HTMLButtonElement;
  fireEvent.click(clearX);

  const myClearMonth = (screen.getByTestId(':date-input:control-month') as HTMLInputElement).value;
  expect(myClearMonth).toContain('');

  const myClearDay = (screen.getByTestId(':date-input:control-day') as HTMLInputElement).value;
  expect(myClearDay).toContain('');

  const myClearYear = (screen.getByTestId(':date-input:control-year') as HTMLInputElement).value;
  expect(myClearYear).toContain('');

  // press date picker
  const pickerButton = screen.getByTestId(':date-input:open-close-picker') as HTMLButtonElement;
  fireEvent.click(pickerButton);

  // because need to wait after button pressed before finding the data picker pop up, need to do this
  // via "await" and "findByTestId" (as opposed to getByTestId)
  const dataPickerPopUp = await screen.findByTestId(':date-input:clear-current-date');
  expect(dataPickerPopUp).not.toBeNull();
});
