const BASE_URL =
  process.env['NEXT_PUBLIC_ANALYTICS_API_URL'] ?? 'http://localhost:3003';

class AnalyticsApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AnalyticsApiError';
  }
}

async function request<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url.toString(), {
    credentials: 'include',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new AnalyticsApiError(res.status, body.message ?? res.statusText);
  }

  return res.json();
}

export const analyticsApi = {
  get<T>(path: string, params?: Record<string, string>) {
    return request<T>(path, params);
  },
};

export { AnalyticsApiError };
