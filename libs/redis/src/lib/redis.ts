import Redis from 'ioredis';
import { environment } from './env.js';

export const redis = new Redis(environment.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

type ConnPingResult =
  | { success: true }
  | { success: false; error: Error };

export async function redisHealthCheck(): Promise<ConnPingResult> {
  try {
    const result = await redis.ping();
    if (result === 'PONG') {
      return { success: true };
    }
    return { success: false, error: new Error(`Unexpected ping response: ${result}`) };
  } catch (error) {
    console.error('Redis health check failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

export async function connectRedis(): Promise<void> {
  await redis.connect();
}

export async function disconnectRedis(): Promise<void> {
  await redis.quit();
}
