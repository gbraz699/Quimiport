export class ApplicationError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string = statusCode === 400 ? 'INVALID_INPUT' : statusCode === 404 ? 'NOT_FOUND' : 'BUSINESS_CONFLICT',
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}
