export type Parameters = Record<string, unknown>;
type DataAsyncResponse = any;

export type DataPageType = 'list' | 'page';

export type DataPagePayload = Record<string, unknown> | Array<Record<string, unknown>>;

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
  query: Record<string, unknown> = {}
): Promise<DataPagePayload> {
  const context = pConn.getContextName?.() ?? 'root';

  // Only forward the query when it actually carries filter conditions; passing an
  // empty object still serializes a `query: {}` into the request, which some
  // queryable data views reject. Omitting it matches the OOTB request shape.
  const hasQuery = query && Object.keys(query).length > 0;

  let response: DataAsyncResponse;
  if (type === 'list') {
    response = hasQuery
      ? await PCore.getDataPageUtils().getDataAsync(dataPage, context, parameters, {}, query)
      : await PCore.getDataPageUtils().getDataAsync(
          dataPage,
          context,
          parameters,
          undefined,
          undefined
        );
  } else {
    response = await PCore.getDataPageUtils().getPageDataAsync(dataPage, context, parameters, {
      // Force a network request every time so that navigating between cases
      // always fetches fresh data rather than serving a cached response from
      // a previous case.
      invalidateCache: true
    });
  }

  if (!response || ('status' in response && response.status !== 200)) {
    const detail =
      response && typeof response === 'object'
        ? JSON.stringify(
            {
              status: (response as any).status,
              message: (response as any).message,
              errors: (response as any).errors,
              errorDetails: (response as any).errorDetails
            },
            null,
            2
          )
        : String(response);
    throw new Error(`Datapage "${dataPage}" failed: ${detail}`);
  }

  return type === 'list'
    ? ((response.data ?? []) as Array<Record<string, unknown>>)
    : (response as Record<string, unknown>);
}

export async function fetchWithBackoff(
  pConn: PConnLike,
  dataPage: string,
  parameters: Parameters,
  type: DataPageType = 'list',
  retryOptions?: RetryOptions,
  query: Record<string, unknown> = {}
): Promise<DataPagePayload> {
  const options = { ...DEFAULT_RETRY_OPTIONS, ...retryOptions };

  for (let attempt = 0; attempt <= options.maxRetries; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await callDataPage(pConn, dataPage, parameters, type, query);
    } catch (error) {
      if (attempt === options.maxRetries) {
        const e = error as any;
        console.error(
          `All attempts failed for ${dataPage}:`,
          e?.response?.status ?? e?.status,
          JSON.stringify(e?.response?.data ?? e?.data ?? e?.message ?? String(error), null, 2)
        );
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
