import pino from 'pino';
import { environment } from './env';

const logger = pino({
  level: environment.LOG_LEVEL,
});

export const getLogger = (context: string) => {
  return context ? logger.child({ context }) : logger;
};
