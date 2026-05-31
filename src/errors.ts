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

function formatApiErrorMessage(statusCode: number, responseBody: unknown): string {
  if (responseBody && typeof responseBody === 'object') {
    const body = responseBody as { message?: unknown; error?: unknown };
    const message = typeof body.message === 'string' ? body.message : body.error;

    if (typeof message === 'string' && message.trim() !== '') {
      return `kkAuto API request failed with HTTP ${statusCode}: ${message}`;
    }
  }

  if (typeof responseBody === 'string' && responseBody.trim() !== '') {
    return `kkAuto API request failed with HTTP ${statusCode}: ${responseBody}`;
  }

  return `kkAuto API request failed with HTTP ${statusCode}`;
}
