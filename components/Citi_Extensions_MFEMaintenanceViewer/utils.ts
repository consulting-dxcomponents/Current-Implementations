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
