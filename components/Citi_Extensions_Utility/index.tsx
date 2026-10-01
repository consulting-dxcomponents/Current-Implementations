import { useState } from 'react';
import { Button, withConfiguration } from '@pega/cosmos-react-core';

import type { PConnFieldProps } from './PConnProps';
import './create-nonce';

interface CitiExtensionsUtilityProps extends PConnFieldProps {
  buttonLabel?: string;
  dataPageName?: string;
  invocationName?: string;
  invocationNameParameter?: string;
  dataPageParams?: string;
}

function CitiExtensionsUtility(props: CitiExtensionsUtilityProps) {
  const {
    getPConnect,
    buttonLabel = 'Run',
    dataPageName = '',
    invocationName = '',
    invocationNameParameter = 'invocationName',
    dataPageParams = '',
    disabled = false,
  } = props;
  const [isInvoking, setIsInvoking] = useState(false);

  const handleClick = async () => {
    if (!dataPageName || !invocationName || isInvoking) return;

    const pConn = getPConnect();
    const currentPage = (pConn.getValue(pConn.getPageReference()) as Record<string, any>) ?? {};
    const parameterNames = dataPageParams
      .split(',')
      .map((name: string) => name.trim())
      .filter(Boolean);
    const parameters = parameterNames.reduce<Record<string, any>>((result, name) => {
      result[name] = currentPage[name];
      return result;
    }, { [invocationNameParameter]: invocationName });

    setIsInvoking(true);
    try {
      await (window as any).PCore.getDataPageUtils().getPageDataAsync(
        dataPageName,
        pConn.getContextName(),
        parameters,
        { invalidateCache: true }
      );
    } catch (error) {
      console.error(`[Utility] Failed to invoke "${invocationName}" through Data Page "${dataPageName}":`, error);
    } finally {
      setIsInvoking(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={disabled || isInvoking || !dataPageName || !invocationName}
    >
      {buttonLabel}
    </Button>
  );
}

export default withConfiguration(CitiExtensionsUtility);
