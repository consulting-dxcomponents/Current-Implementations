import { FieldValueList } from '@pega/cosmos-react-core';

import { format } from './date';

export default function FormattedText(props: any) {
  const { formatType = 'none', label, value, testId, hideLabel, variant = 'stacked', additionalProps = {} } = props;

  let text = value;

  text = format(text, formatType, additionalProps);

  const fields = [
    {
      id: label.toLowerCase(),
      name: hideLabel ? '' : label,
      value: text
    }
  ];
  return <FieldValueList variant={variant} fields={fields} data-testid={testId} />;
}
