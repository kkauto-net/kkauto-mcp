export interface KkAutoMcpConfig {
  apiBaseUrl: string;
  apiToken: string;
  enableDelete: boolean;
  defaultStatus: 0 | 1;
  maxListLimit: number;
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface ApiRequestOptions {
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: Record<string, unknown>;
  formData?: FormData;
}

export interface ApiEnvelope<T = unknown> {
  status?: string;
  message?: string;
  data?: T;
  pagination?: unknown;
  [key: string]: unknown;
}
