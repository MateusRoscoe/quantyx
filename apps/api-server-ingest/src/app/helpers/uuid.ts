import { randomBytes } from 'node:crypto';

let lastTimestamp = 0;
let sequence = 0;

export function generateUUIDv7(): string {
  let now = Date.now();

  if (now === lastTimestamp) {
    sequence++;
    if (sequence > 0xfff) {
      while (Date.now() === lastTimestamp) {
        // spin
      }
      now = Date.now();
      sequence = 0;
    }
  } else {
    sequence = 0;
  }
  lastTimestamp = now;

  const bytes = randomBytes(16);

  // 48-bit timestamp (big-endian) in bytes 0-5
  bytes[0] = (now / 2 ** 40) & 0xff;
  bytes[1] = (now / 2 ** 32) & 0xff;
  bytes[2] = (now / 2 ** 24) & 0xff;
  bytes[3] = (now / 2 ** 16) & 0xff;
  bytes[4] = (now / 2 ** 8) & 0xff;
  bytes[5] = now & 0xff;

  // Version 7 + 12-bit sequence: bytes 6-7
  bytes[6] = 0x70 | ((sequence >> 8) & 0x0f);
  bytes[7] = sequence & 0xff;

  // Variant 10xx
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
