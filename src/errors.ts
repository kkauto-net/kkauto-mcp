export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly responseBody: unknown;

  constructor(statusCode: number, responseBody: unknown) {
    super(formatApiErrorMessage(statusCode, responseBody));
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

export function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Flatten `{field: msg | msg[] | {nested: msg}}` into `field.nested: msg` lines. */
function flattenFields(value: unknown, path = '', out: string[] = []): string[] {
  if (value === null || value === undefined) {
    return out;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => flattenFields(item, path === '' ? String(index) : `${path}.${index}`, out));

    return out;
  }

  const record = asRecord(value);

  if (record === undefined) {
    const message = String(value);

    if (message.trim() !== '') {
      out.push(path === '' ? message : `${path}: ${message}`);
    }

    return out;
  }

  for (const [key, nested] of Object.entries(record)) {
    flattenFields(nested, path === '' ? key : `${path}.${key}`, out);
  }

  return out;
}

/**
 * `kkAuto API request failed with HTTP <n>: <message>` plus, when the API sends
 * them, the per-field errors, the 409 IN_USE payload and the request id.
 */
export function formatApiErrorMessage(statusCode: number, responseBody: unknown): string {
  const prefix = `kkAuto API request failed with HTTP ${statusCode}`;

  if (typeof responseBody === 'string') {
    return responseBody.trim() === '' ? prefix : `${prefix}: ${responseBody}`;
  }

  const body = asRecord(responseBody);

  if (body === undefined) {
    return prefix;
  }

  const error = asRecord(body.error);
  const candidates = [body.message, typeof body.error === 'string' ? body.error : undefined, error?.message];
  const message = candidates.find((value): value is string => typeof value === 'string' && value.trim() !== '');

  let text = message === undefined ? prefix : `${prefix}: ${message}`;

  const fields = flattenFields(body.errors ?? error?.fields);
  if (fields.length > 0) {
    text += ` | fields: ${fields.join('; ')}`;
  }

  if (body.data !== undefined && body.data !== null) {
    text += ` | details: ${JSON.stringify(body.data)}`;
  }

  const code = [body.code, error?.code].find((value): value is string => typeof value === 'string' && value !== '');
  const requestId = [body.request_id, error?.request_id].find(
    (value): value is string => typeof value === 'string' && value !== '',
  );

  if (code !== undefined || requestId !== undefined) {
    text += ` [code=${code ?? '-'} request_id=${requestId ?? '-'}]`;
  }

  return text;
}
