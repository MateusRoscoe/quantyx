import { getLogger } from '@quantyx/shared-backend';

import { environment } from './helpers/env.js';
import { backfillPropertyMetadata } from './services/property-metadata.js';

const logger = getLogger('scheduler-analytics');

const shutdownController = new AbortController();

process.once('SIGTERM', () => {
  logger.info('SIGTERM received, finishing current chunk before exiting');
  shutdownController.abort();
});
process.once('SIGINT', () => {
  logger.info('SIGINT received, finishing current chunk before exiting');
  shutdownController.abort();
});

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

async function run(): Promise<void> {
  const { SCHEDULER_MODE, SCHEDULER_INTERVAL_MS } = environment;
  const signal = shutdownController.signal;

  logger.info({ mode: SCHEDULER_MODE }, 'Starting scheduler-analytics');

  while (!signal.aborted) {
    try {
      await backfillPropertyMetadata(signal);
    } catch (error) {
      logger.error({ error }, 'Backfill failed');
    }

    if (SCHEDULER_MODE === 'oneshot') break;

    await sleep(SCHEDULER_INTERVAL_MS, signal);
  }

  logger.info('Shutdown complete');
}

run().catch((error) => {
  logger.fatal({ error }, 'Scheduler failed to start');
  process.exit(1);
});
