export interface ApiError {
  correlationId: string;
  code: string;
  message: string;
  timestamp: string;
}

export const ErrorCode = {
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
  CURRENCY_MISMATCH: 'CURRENCY_MISMATCH',
  INVALID_CURRENCY: 'INVALID_CURRENCY',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
