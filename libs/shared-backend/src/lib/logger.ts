import pino from 'pino';
import { trace, context as otelContext } from '@opentelemetry/api';
import { environment } from './env';

const isOtelLogsEnabled =
  process.env.OTEL_ENABLED !== 'false' &&
  process.env.OTEL_LOGS_ENABLED !== 'false';

function otelMixin(): Record<string, string> {
  const span = trace.getSpan(otelContext.active());
  if (!span) return {};
  const { traceId, spanId } = span.spanContext();
  return { trace_id: traceId, span_id: spanId };
}

const transport = isOtelLogsEnabled
  ? pino.transport({
      targets: [
        { target: 'pino/file', options: { destination: 1 }, level: 'trace' },
        {
          target: 'pino-opentelemetry-transport',
          options: {},
          level: 'trace',
        },
      ],
    })
  : undefined;

export const logger = pino(
  {
    level: environment.LOG_LEVEL,
    mixin: otelMixin,
  },
  transport,
);

export const getLogger = (context: string) => {
  return context ? logger.child({ context }) : logger;
};
