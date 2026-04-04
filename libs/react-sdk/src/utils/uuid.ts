/**
 * Generate a UUIDv7 (time-ordered) using crypto.getRandomValues().
 * Layout: 48-bit unix_ts_ms | 4-bit ver(7) | 12-bit seq | 2-bit var(10) | 62-bit rand_b
 *
 * Uses a monotonic counter (seq) within the same millisecond to guarantee
 * lexicographic ordering even when multiple UUIDs are generated in the same ms.
 */
let lastTimestamp = 0;
let sequence = 0;

export function generateUUIDv7(): string {
  let now = Date.now();

  if (now === lastTimestamp) {
    sequence++;
    if (sequence > 0xfff) {
      // Sequence overflow — advance to next millisecond
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

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

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

  // Variant 10xx: set bits 8[7:6] = 10
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(
    '',
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Generate a UUIDv4 using crypto.getRandomValues() (works in all browser contexts). */
export function generateUUIDv4(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // Version 4: set bits 6[7:4] = 0100
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  // Variant 10xx: set bits 8[7:6] = 10
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(
    '',
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
