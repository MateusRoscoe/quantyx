const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

import { generateUUIDv7, generateUUIDv4 } from './uuid.js';

describe('generateUUIDv7', () => {
  it('produces a valid UUIDv7 format', () => {
    const id = generateUUIDv7();
    expect(id).toMatch(UUID_V7_REGEX);
  });

  it('sequential values are monotonically increasing', () => {
    const ids: string[] = [];
    for (let i = 0; i < 100; i++) {
      ids.push(generateUUIDv7());
    }
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i]! >= ids[i - 1]!).toBe(true);
    }
  });
});

describe('generateUUIDv4', () => {
  it('produces a valid UUIDv4 format', () => {
    const id = generateUUIDv4();
    expect(id).toMatch(UUID_V4_REGEX);
  });
});
