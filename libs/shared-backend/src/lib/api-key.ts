import { createHash, randomBytes } from 'node:crypto';

const API_KEY_PREFIX = 'qx_';
const RANDOM_BYTES = 24;

export function generateApiKey(): {
  key: string;
  prefix: string;
  keyHash: string;
} {
  const randomPart = randomBytes(RANDOM_BYTES).toString('base64url');
  const key = `${API_KEY_PREFIX}${randomPart}`;
  const prefix = key.slice(0, 12);
  const keyHash = hashApiKey(key);
  return { key, prefix, keyHash };
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}
