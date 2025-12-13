import { clickhouse } from './clickhouse';

describe('clickhouse', () => {
  it('should work', () => {
    expect(clickhouse()).toEqual('clickhouse');
  });
});
