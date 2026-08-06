import { HttpException, HttpStatus } from '@nestjs/common';

export interface ApiExceptionPayload {
  code: string;
  messageKey: string;
}

export class ApiException extends HttpException {
  constructor(
    status: HttpStatus,
    public readonly code: string,
    public readonly messageKey: string,
  ) {
    super({ code, messageKey }, status);
  }
}
