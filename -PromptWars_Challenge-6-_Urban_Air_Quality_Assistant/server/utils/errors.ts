/**
 * Base typed application error with HTTP status code and machine-readable code.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * Raised when a cross-origin request arrives from an origin not on the CORS allowlist.
 */
export class CorsOriginError extends AppError {
  constructor(message = 'Origin is not permitted to access this API.') {
    super(403, 'cors_forbidden', message);
  }
}
