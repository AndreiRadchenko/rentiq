import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { I18nContext } from 'nestjs-i18n';
import { ApiError, ErrorCode } from '../dto/api-error';

interface HttpExceptionResponse {
  message?: string;
  error?: string;
  messageKey?: string;
  code?: string;
}

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const correlationId = uuidv4();
    const timestamp = new Date().toISOString();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ErrorCode.INTERNAL_ERROR;
    let message = 'An unexpected error occurred';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exResponse = exception.getResponse();
      if (typeof exResponse === 'string') {
        message = exResponse;
      } else if (typeof exResponse === 'object' && exResponse !== null) {
        const responseObj = exResponse as HttpExceptionResponse;
        if (responseObj.code && responseObj.messageKey) {
          code = responseObj.code;
          const i18n = I18nContext.current();
          message = i18n ? i18n.t(responseObj.messageKey) : responseObj.messageKey;
        } else {
          message = responseObj.message || message;
          code = responseObj.error || code;
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const errorResponse: ApiError = {
      correlationId,
      code,
      message,
      timestamp,
    };

    response.status(statusCode).json(errorResponse);
  }
}
