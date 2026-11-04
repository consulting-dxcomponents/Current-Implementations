interface Parameters {
  [key: string]: string | number | null;
}

interface DataAsyncResponse {
  status?: number;
  data: {
    [key: string]: any;
  };
  fetchDateTime?: string;
  pageNumber?: number;
  pageSize?: number;
  queryStats?: any;
  [key: string]: unknown;
}

export const LATEST_ASSIGNMENT_ETAG_KEY = 'latestAssignmentETag';
let isAssignmentEtagInterceptorRegistered = false;

type RestResponse = {
  config?: { url?: string };
  headers?: Record<string, string | undefined>;
};

/* (Fix Given By Pega Product Team for handling assignment ETag in REST client)
 * Registers an interceptor for assignment ETag handling in the REST client.
 * Ensures that the latest assignment ETag is stored in sessionStorage after save requests.
 */
export const registerAssignmentEtagInterceptor = () => {
  if (isAssignmentEtagInterceptorRegistered) return;

  const restClient = PCore.getRestClient() as unknown as {
    registerInterceptor?: (interceptor: {
      request: (config: unknown) => unknown;
      response: (response: RestResponse) => RestResponse;
    }) => void;
  };

  if (typeof restClient?.registerInterceptor !== 'function') {
    console.warn('[MFEViewer] REST client does not support interceptor registration.');
    return;
  }

  restClient.registerInterceptor({
    request: config => config,
    response: response => {
      const url = response.config?.url ?? '';
      const isSaveRequest = /\/save\/?(?:[?#]|$)/.test(url);
      const etag = response.headers?.etag;

      if (isSaveRequest && etag) {
        sessionStorage.setItem(LATEST_ASSIGNMENT_ETAG_KEY, etag);
      }

      return response;
    }
  });
  isAssignmentEtagInterceptorRegistered = true;
};

export async function getFileArrayBuffer(fileURL: URL): Promise<ArrayBuffer> {
  const response = await fetch(fileURL);
  const buffer = await response.arrayBuffer();
  return buffer;
}

export async function arrayBufferToBase64(arrayBuffer: ArrayBuffer): Promise<string> {
  const blob = new Blob([arrayBuffer]);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Failed to convert ArrayBuffer to Base64 string.'));
        return;
      }

      const base64 = reader.result.split(',')[1];
      if (!base64) {
        reject(new Error('Invalid Data URL generated for ArrayBuffer.'));
        return;
      }

      resolve(base64);
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error('Failed to read Blob while converting to Base64.'));
    };

    reader.onabort = () => {
      reject(new Error('Blob read aborted while converting to Base64.'));
    };

    reader.readAsDataURL(blob);
  });
}

export function splitStringToIntArray(bboxStr: string): Array<number> {
  try {
    if (!bboxStr) return [];
    return bboxStr.split(',').map(num => parseInt(num, 10));
  } catch (err) {
    console.error(`Failed to parse bbox string: "${bboxStr}". Error:`, err);
    return [];
  }
}

export type DataPageType = 'list' | 'page';

export type DataPageResponse = Record<string, unknown> | Array<Record<string, unknown>>;

interface PConnLike {
  getContextName?: () => string;
}

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  delayMultiplier?: number;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 800,
  delayMultiplier: 2
};

function backoffDelay(attempt: number, options: Required<RetryOptions>): number {
  return options.baseDelayMs * options.delayMultiplier ** attempt;
}

export async function callDataPage(
  pConn: PConnLike,
  dataPage: string,
  parameters: Parameters,
  type: DataPageType = 'list',
  invalidateCache = false
): Promise<DataPageResponse> {
  const response: DataAsyncResponse =
    type === 'list'
      ? await PCore.getDataApiUtils().getData(
          dataPage,
          { dataViewParameters: parameters },
          pConn.getContextName?.() ?? 'root',
          {
            invalidateCache
          }
        )
      : await PCore.getDataPageUtils().getPageDataAsync(
          dataPage,
          pConn.getContextName?.() ?? 'root',
          parameters,
          {
            invalidateCache
          }
        );

  if (!response || ('status' in response && response.status !== 200)) {
    throw new Error(`Datapage "${dataPage}" failed`);
  }

  return type === 'list'
    ? ((response.data.data ?? []) as Array<Record<string, unknown>>)
    : (response as Record<string, unknown>);
}

export async function fetchWithBackoff(
  pConn: PConnLike,
  dataPage: string,
  parameters: Parameters,
  type: DataPageType = 'list',
  retryOptions?: RetryOptions,
  invalidateCache: boolean = false
): Promise<DataPageResponse> {
  const options = { ...DEFAULT_RETRY_OPTIONS, ...retryOptions };

  for (let attempt = 0; attempt <= options.maxRetries; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await callDataPage(pConn, dataPage, parameters, type, invalidateCache);
    } catch (error) {
      if (attempt === options.maxRetries) {
        console.error(`All attempts failed for ${dataPage}: ${String(error)}`);
        return type === 'list' ? [] : {};
      }

      const delay = backoffDelay(attempt, options);
      console.warn(`Attempt ${attempt + 1} failed for ${dataPage}. Retrying in ${delay}ms...`);
      // eslint-disable-next-line no-await-in-loop
      await new Promise(resolve => {
        setTimeout(resolve, delay);
      });
    }
  }

  return type === 'list' ? [] : {};
}

export function getPropertyParameterArray(rawConfigProps: Record<string, unknown>): string[] {
  if (!rawConfigProps) return [];

  try {
    return Object.keys(rawConfigProps)
      .map(p => {
        const currentParamConfig = rawConfigProps[p];
        if (typeof currentParamConfig === 'string' && currentParamConfig.startsWith('@P')) {
          return currentParamConfig.split(' ')[1];
        }
        return undefined;
      })
      .filter(p => p !== undefined) as string[];
  } catch (err) {
    console.warn('Error parsing property parameters from config: ', err);
    return [];
  }
}
