export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type ApiErrorBody = {
  message?: string | string[];
};

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);

  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
    cache: 'no-store',
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = (await response.json().catch(() => null)) as ApiErrorBody | T | null;

  if (!response.ok) {
    const body = data as ApiErrorBody | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : body?.message || 'Something went wrong. Please try again.';

    throw new ApiError(message, response.status);
  }

  return data as T;
}
