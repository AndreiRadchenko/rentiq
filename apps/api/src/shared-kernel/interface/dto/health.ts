export interface HealthCheckResponse {
  status: 'ok' | 'error';
  db: 'ok' | 'error';
  redis: 'ok' | 'error';
  details?: {
    db?: {
      status: string;
      message: string;
    };
    redis?: {
      status: string;
      message: string;
    };
  };
}
