import { PConnect } from '@pega/pcore-pconnect-typedefs';

// PConnProps.d.ts
// This gives us a place to have each component (which is most DX Components) that is
//  expected to have a getPConnect extend its props (from BaseProps)
//  such that every component will be expected to have a getPConnect() function
//  that returns a PConnect object. (new/better way of doing .propTypes).
//  This PConnProps can be extended to include other props that we know are in every component
export interface PConnProps {
  // getPConnect should exist for every C11n component. (add @ts-ignore in special cases where it isn't)
  getPConnect: () => typeof PConnect;
}

// PConnFieldProps extends PConnProps to bring in the common properties that are
// associated with most field components (ex: Dropdown, TextInput, etc.) in the
//  components/field directory
export interface PConnFieldProps extends PConnProps {
  label: string;
  required: boolean;
  disabled: boolean;
  value: any;
  validatemessage: string;
  status?: string;
  onChange?: any;
  onBlur?: any;
  readOnly: boolean;
  testId: string;
  helperText: string;
  displayMode?: string;
  hideLabel: boolean;
  placeholder?: string;
  fieldMetadata?: any;
  additionalProps?: any;
}
