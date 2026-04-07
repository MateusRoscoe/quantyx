import { NodeSDK } from '@opentelemetry/sdk-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { FastifyOtelInstrumentation } from '@fastify/otel';
import { environment } from './env.js';

let sdk: NodeSDK | undefined;

const fastifyOtelInstrumentation = new FastifyOtelInstrumentation();

export function initOtel(): void {
  const endpoint = environment.OTEL_EXPORTER_OTLP_ENDPOINT;
  const serviceName = environment.OTEL_SERVICE_NAME ?? 'unknown-service';

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: '0.0.1',
    'deployment.environment': process.env.NODE_ENV ?? 'development',
  });

  const traceExporter = environment.OTEL_TRACES_ENABLED
    ? new OTLPTraceExporter({ url: `${endpoint}/v1/traces` })
    : undefined;

  const metricReader = environment.OTEL_METRICS_ENABLED
    ? new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
        exportIntervalMillis: 30_000,
      })
    : undefined;

  const logRecordProcessor = environment.OTEL_LOGS_ENABLED
    ? new BatchLogRecordProcessor(
        new OTLPLogExporter({ url: `${endpoint}/v1/logs` }),
      )
    : undefined;

  sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader,
    logRecordProcessor,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Only enable instrumentations we actually use
        '@opentelemetry/instrumentation-http': {},
        '@opentelemetry/instrumentation-ioredis': {},
        '@opentelemetry/instrumentation-pg': {},
        '@opentelemetry/instrumentation-dns': {},
        // Disable everything else
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
        '@opentelemetry/instrumentation-express': { enabled: false },
        '@opentelemetry/instrumentation-koa': { enabled: false },
        '@opentelemetry/instrumentation-hapi': { enabled: false },
        '@opentelemetry/instrumentation-connect': { enabled: false },
        '@opentelemetry/instrumentation-restify': { enabled: false },
        '@opentelemetry/instrumentation-graphql': { enabled: false },
        '@opentelemetry/instrumentation-grpc': { enabled: false },
        '@opentelemetry/instrumentation-mysql': { enabled: false },
        '@opentelemetry/instrumentation-mysql2': { enabled: false },
        '@opentelemetry/instrumentation-mongodb': { enabled: false },
        '@opentelemetry/instrumentation-mongoose': { enabled: false },
        '@opentelemetry/instrumentation-redis': { enabled: false },
        '@opentelemetry/instrumentation-memcached': { enabled: false },
        '@opentelemetry/instrumentation-aws-sdk': { enabled: false },
        '@opentelemetry/instrumentation-aws-lambda': { enabled: false },
        '@opentelemetry/instrumentation-bunyan': { enabled: false },
        '@opentelemetry/instrumentation-winston': { enabled: false },
        '@opentelemetry/instrumentation-pino': { enabled: false },
        '@opentelemetry/instrumentation-generic-pool': { enabled: false },
        '@opentelemetry/instrumentation-dataloader': { enabled: false },
        '@opentelemetry/instrumentation-lru-memoizer': { enabled: false },
        '@opentelemetry/instrumentation-undici': { enabled: false },
        '@opentelemetry/instrumentation-kafkajs': { enabled: false },
        '@opentelemetry/instrumentation-knex': { enabled: false },
        '@opentelemetry/instrumentation-tedious': { enabled: false },
        '@opentelemetry/instrumentation-amqplib': { enabled: false },
        '@opentelemetry/instrumentation-cassandra-driver': { enabled: false },
        '@opentelemetry/instrumentation-cucumber': { enabled: false },
        '@opentelemetry/instrumentation-runtime-node': { enabled: false },
        '@opentelemetry/instrumentation-socket.io': { enabled: false },
        '@opentelemetry/instrumentation-nestjs-core': { enabled: false },
        '@opentelemetry/instrumentation-openai': { enabled: false },
        '@opentelemetry/instrumentation-oracledb': { enabled: false },
        '@opentelemetry/instrumentation-router': { enabled: false },
      }),
      fastifyOtelInstrumentation,
    ],
  });

  sdk.start();

  process.stderr.write(
    `[otel] initialized for service: ${serviceName} (traces=${environment.OTEL_TRACES_ENABLED}, metrics=${environment.OTEL_METRICS_ENABLED}, logs=${environment.OTEL_LOGS_ENABLED})\n`,
  );
}

export function fastifyOtelPlugin() {
  return fastifyOtelInstrumentation.plugin();
}

export async function shutdownOtel(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = undefined;
  }
}
