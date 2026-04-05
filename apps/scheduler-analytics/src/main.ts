import { getLogger } from '@quantyx/shared-backend';

import { environment } from './helpers/env.js';
import { backfillPropertyMetadata } from './services/property-metadata.js';

const logger = getLogger('scheduler-analytics');

async function run(): Promise<void> {
  logger.info(
    { mode: environment.SCHEDULER_MODE },
    'Starting scheduler-analytics',
  );

  if (environment.SCHEDULER_MODE === 'oneshot') {
    await backfillPropertyMetadata();
    logger.info('Oneshot run complete, exiting');
    process.exit(0);
  }

  // Daemon mode: run immediately, then on interval
  await backfillPropertyMetadata();

  setInterval(async () => {
    try {
      await backfillPropertyMetadata();
    } catch (error) {
      logger.error({ error }, 'Scheduled backfill failed');
    }
  }, environment.SCHEDULER_INTERVAL_MS);

  logger.info(
    { intervalMs: environment.SCHEDULER_INTERVAL_MS },
    'Daemon mode active, scheduling recurring backfill',
  );
}

run().catch((error) => {
  logger.fatal({ error }, 'Scheduler failed to start');
  process.exit(1);
});
