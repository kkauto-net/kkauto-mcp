import { ApiError } from './errors.js';
import type { ApiRequestOptions, KkAutoMcpConfig } from './types.js';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export class KkAutoApiClient {
  constructor(private readonly config: KkAutoMcpConfig) {}

  get<T>(path: string, options: ApiRequestOptions = {}): Promise<T | null> {
    return this.request<T>('GET', path, options);
  }

  post<T>(path: string, options: ApiRequestOptions = {}): Promise<T | null> {
    return this.request<T>('POST', path, options);
  }

  put<T>(path: string, options: ApiRequestOptions = {}): Promise<T | null> {
    return this.request<T>('PUT', path, options);
  }

  patch<T>(path: string, options: ApiRequestOptions = {}): Promise<T | null> {
    return this.request<T>('PATCH', path, options);
  }

  delete<T>(path: string, options: ApiRequestOptions = {}): Promise<T | null> {
    return this.request<T>('DELETE', path, options);
  }

  private async request<T>(method: HttpMethod, path: string, options: ApiRequestOptions): Promise<T | null> {
    if (options.body !== undefined && options.formData !== undefined) {
      throw new Error('KkAutoApiClient request cannot send both JSON body and FormData.');
    }

    const url = this.buildUrl(path, options.query);
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${this.config.apiToken}`,
    };

    const init: RequestInit = {
      method,
      headers,
    };

    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(options.body);
    }

    if (options.formData !== undefined) {
      init.body = options.formData;
    }

    const response = await fetch(url, init);
    const parsed = await parseResponseBody(response);

    if (!response.ok) {
      throw new ApiError(response.status, parsed);
    }

    return parsed as T | null;
  }

  private buildUrl(path: string, query?: ApiRequestOptions['query']): URL {
    const normalizedPath = path.replace(/^\/+/, '');
    const url = new URL(normalizedPath, `${this.config.apiBaseUrl}/`);

    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === null || value === '') {
        continue;
      }

      url.searchParams.set(key, String(value));
    }

    return url;
  }
}

async function parseResponseBody(response: Response): Promise<unknown | null> {
  if (response.status === 204) {
    return null;
  }

  const text = await response.text();

  if (text.trim() === '') {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
