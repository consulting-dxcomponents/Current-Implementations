import {
  Link,
  withConfiguration
} from '@pega/cosmos-react-core';

import type { PConnFieldProps } from './PConnProps';
import StyledDiv from './styles';
import './create-nonce';

// interface for props
interface CitiExtensionsCppdProps extends PConnFieldProps {
  linkLabel?: string;
  dataSourcePage?: {source: string, parameters?: Record<string, any>, fields: {urlProperty?: string}};
  linkType?: 'primary' | 'secondary';
  urlProperty?: string;
  windowWidth?: string;
  windowHeight?: string;
}

// props passed in combination of props from property panel (config.json) and run time props from Constellation
function CitiExtensionsCppd(props: CitiExtensionsCppdProps) {
  const {
    getPConnect,
    disabled = false,
    linkLabel,
    dataSourcePage,
    linkType = 'primary',
    windowWidth = '800',
    windowHeight = '600'
  } = props;

  const pConn = getPConnect();

  /**
   * Handle link click - invoke data page and launch URL in new window
   * Process:
   * 1. Call data page with parameters
   * 2. From the results, extract the URL property
   * 3. Launch the URL in a new window with specified width and height
   */
  const handleLinkClick = async () => {
    // Resolve data page parameters from config props
    const latestResolvedParameters = pConn.resolveConfigProps(
      pConn.getRawConfigProps()?.dataSourcePage?.parameters
    );

    // Get context name from pConnect
    const contextName = pConn.getContextName();
    try {
      if (!dataSourcePage) {
        console.warn('[CPPD] Data page name is not configured');
        return;
      }

      console.log(`[CPPD] Invoking data page: ${dataSourcePage}`);

      // Use resolved parameters from config
      // const params = latestResolvedParameters || {};
      console.log('[CPPD] Parameters:', latestResolvedParameters);

      // Call the data page using PCore API
      const dataPageResult = await (window as any).PCore.getDataPageUtils().getPageData(
        dataSourcePage.source,
        latestResolvedParameters,
        contextName
      );

      console.log('[CPPD] Data page results:', dataPageResult);

      // getData returns data.data which is an array, get the first result
      // const resultsArray = dataPageResult?.data?.data || [];
      // const dataPageResult:any = Array.isArray(resultsArray) && resultsArray.length > 0
      //  ? resultsArray[0]
      //  : null;

      console.log('[CPPD] First result:', dataPageResult);

      // Extract URL from the result based on urlProperty
      let urlToLaunch = '';
      const rawUrlProperty = dataSourcePage.fields.urlProperty;
      const urlPropertyKey = rawUrlProperty?.startsWith('.') ? rawUrlProperty.slice(1) : rawUrlProperty;
      if (urlPropertyKey && dataPageResult) {
        // urlProperty is the key, get its value directly from the result
        urlToLaunch = dataPageResult[urlPropertyKey] || '';
      } else if (!urlPropertyKey && dataPageResult?.url) {
        // Default to 'url' property if no specific property is configured
        urlToLaunch = dataPageResult.url;
      }

      if (urlToLaunch) {
        console.log('[CPPD] Opening URL:', urlToLaunch);
        // Open URL in new window with specified dimensions
        const width = parseInt(windowWidth, 10) || 800;
        const height = parseInt(windowHeight, 10) || 600;
        const windowFeatures = `width=${width},height=${height},resizable=yes,scrollbars=yes`;
        window.open(urlToLaunch, '_blank', windowFeatures);
      } else {
        console.warn('[CPPD] No URL found in data page result');
      }
    } catch (error) {
      console.error('[CPPD] Error invoking data page or launching URL:', error);
    }
  };

  // Always render as a clickable link
  return (
    <StyledDiv className={`cppd-link cppd-link-${linkType}`}>
      <Link
        onClick={handleLinkClick}
        disabled={disabled}
        aria-label={linkLabel}
        href="#"
        target="_self"
      >
        {linkLabel}
      </Link>
    </StyledDiv>
  );
}

export default withConfiguration(CitiExtensionsCppd);
