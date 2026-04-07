import { trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('@quantyx/otel');

export async function traceClickHouse<T>(
  operation: string,
  query: string,
  fn: () => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(
    `clickhouse.${operation}`,
    {
      kind: SpanKind.CLIENT,
      attributes: {
        'db.system': 'clickhouse',
        'db.operation.name': operation,
        'db.statement': query.slice(0, 1024),
      },
    },
    async (span) => {
      try {
        const result = await fn();
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: String(error),
        });
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    },
  );
}
