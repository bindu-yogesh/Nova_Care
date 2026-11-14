import { pending, remove, update } from './offline';

export const API_URL = (import.meta as any).env.VITE_API || 'http://localhost:4000';

export async function request<T = any>(endpoint: string, options: {
  method?: string;
  body?: any;
  params?: Record<string, string | number | undefined>;
  cache?: boolean;
} = {}): Promise<T> {
  const { method = 'GET', body, params, cache = true } = options;

  let url = API_URL + endpoint;
  if (params) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) q.append(k, String(v));
    }
    const qs = q.toString();
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  }

  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const isGet = method.toUpperCase() === 'GET';

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const err = new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
      (err as any).status = res.status;
      (err as any).data = data;
      throw err;
    }

    if (isGet && cache) {
      try {
        localStorage.setItem('cache_' + endpoint, JSON.stringify({ t: Date.now(), d: data }));
      } catch (e) {
        // storage quota exceeded or disabled
      }
    }

    return data;
  } catch (err: any) {
    // If offline or network failed on GET, try reading cache
    if (isGet && cache && !err.status) {
      const cached = localStorage.getItem('cache_' + endpoint);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const data = parsed.d;
          if (typeof data === 'object' && data !== null) {
            (data as any)._cachedAt = parsed.t;
          }
          return data;
        } catch {}
      }
    }
    throw err;
  }
}

let flushPromise: Promise<any> | null = null;

export function flushOfflineQueue() {
  if (flushPromise) return flushPromise;

  flushPromise = (async () => {
    const queue = await pending();
    const now = Date.now();

    const dueRecords = queue
      .filter(record =>
        record.status !== 'rejected' &&
        (!record.nextRetryAt || record.nextRetryAt <= now)
      )
      .slice(0, 200);

    if (!dueRecords.length) {
      return { syncedCount: 0, results: [] };
    }

    const attemptsByKey = new Map<string, number>();

    for (const record of dueRecords) {
      const attempts = (record.attempts || 0) + 1;
      attemptsByKey.set(record.key, attempts);

      await update({
        ...record,
        status: 'syncing',
        attempts,
        lastError: null
      });
    }

    const retryRecord = async (record: any, error: string) => {
      const attempts = attemptsByKey.get(record.key) || 1;
      const delay = Math.min(30000 * (2 ** (attempts - 1)), 1800000);

      await update({
        ...record,
        status: 'failed',
        attempts,
        lastError: error,
        nextRetryAt: Date.now() + delay
      });
    };

    try {
      const response = await request('/api/sync/upload', {
        method: 'POST',
        body: {
          records: dueRecords.map(record => ({
            key: record.key,
            payload: record.payload
          }))
        }
      });

      const results = Array.isArray(response.results)
        ? response.results
        : [];

      const resultByKey = new Map(
        results
          .filter((item: any) => item && typeof item.key === 'string')
          .map((item: any) => [item.key, item])
      );

      let syncedCount = 0;
      const processedResults: any[] = [];

      for (const record of dueRecords) {
        const item: any = resultByKey.get(record.key);

        if (item?.status === 'synced' || item?.status === 'duplicate') {
          await remove(record.key);
          syncedCount++;
          processedResults.push(item);
        } else if (item?.status === 'rejected') {
          await update({
            ...record,
            status: 'rejected',
            lastError: item.error || 'Record rejected by server',
            nextRetryAt: 0
          });
          processedResults.push(item);
        } else {
          const error = item?.error ||
            'No valid synchronization result received for this record';

          await retryRecord(record, error);
          processedResults.push({
            key: record.key,
            status: 'failed',
            error
          });
        }
      }

      return {
        syncedCount,
        results: processedResults,
        remainingCount: queue.length - syncedCount
      };
    } catch (error: any) {
      console.warn('[Sync] Offline queue flush failed:', error);

      for (const record of dueRecords) {
        await retryRecord(
          record,
          error?.message || 'Network synchronization failed'
        );
      }

      return {
        syncedCount: 0,
        results: dueRecords.map(record => ({
          key: record.key,
          status: 'failed',
          error: error?.message || 'Network synchronization failed'
        }))
      };
    }
  })().finally(() => {
    flushPromise = null;
  });

  return flushPromise;
}
