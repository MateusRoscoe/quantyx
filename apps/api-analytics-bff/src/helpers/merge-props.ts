/** Merge typed property maps (str/num/bool) into a single flat record.
 *  Boolean values are stored as UInt8 in ClickHouse and converted back here. */
export function mergeProps(row: {
  props_str?: Record<string, string>;
  props_num?: Record<string, number>;
  props_bool?: Record<string, number>;
}): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(row.props_str ?? {})) result[k] = v;
  for (const [k, v] of Object.entries(row.props_num ?? {})) result[k] = v;
  for (const [k, v] of Object.entries(row.props_bool ?? {})) {
    result[k] = v === 1;
  }
  return result;
}
