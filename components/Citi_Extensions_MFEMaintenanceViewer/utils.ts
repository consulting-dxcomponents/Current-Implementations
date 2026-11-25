interface Parameters {
  [key: string]: string | number | null;
}

interface DataAsyncResponse {
  status?: number;
  data?: {
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
  const response = (
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
        )) as DataAsyncResponse;

  if (!response || ('status' in response && response.status !== 200)) {
    throw new Error(`Datapage "${dataPage}" failed`);
  }

  return type === 'list'
    ? ((response.data?.data ?? []) as Array<Record<string, unknown>>)
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
      return await callDataPage(pConn, dataPage, parameters, type, invalidateCache);
    } catch (error) {
      if (attempt === options.maxRetries) {
        console.error(`All attempts failed for ${dataPage}: ${String(error)}`);
        return type === 'list' ? [] : {};
      }

      const delay = backoffDelay(attempt, options);
      console.warn(`Attempt ${attempt + 1} failed for ${dataPage}. Retrying in ${delay}ms...`);

      await new Promise(resolve => {
        setTimeout(resolve, delay);
      });
    }
  }

  return type === 'list' ? [] : {};
}

type InheritedPropEntry = { prop: string; value: unknown };

/**
 * Resolves the view label/showLabel across Constellation versions: 24.1 passed an
 * `inheritedProps` array prop, while 26 exposes them via getPConnect().getInheritedProps().
 */
export function resolveViewLabel(
  pConn: unknown,
  inheritedProps: InheritedPropEntry[] | undefined,
  label: unknown,
  showLabel: unknown,
  defaultLabel: string
): [string, boolean] {
  const runtimeInherited =
    (pConn as { getInheritedProps?: () => Record<string, unknown> } | undefined)
      ?.getInheritedProps?.() ?? {};
  const merged: Record<string, unknown> = { label, showLabel, ...runtimeInherited };
  if (Array.isArray(inheritedProps)) {
    inheritedProps.forEach(({ prop, value }) => {
      if (value !== undefined) merged[prop] = value;
    });
  }
  const resolvedLabel = (merged.label as string | undefined) ?? defaultLabel;
  const resolvedShowLabel =
    merged.showLabel === undefined || (merged.showLabel !== false && merged.showLabel !== 'false');
  return [resolvedLabel, resolvedShowLabel];
}
