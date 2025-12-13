import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

export const getLogger = (context: string) => {
  return context ? logger.child({ context }) : logger;
};
