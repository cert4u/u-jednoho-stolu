function optionalLimit(value) {
  const count = Number(value);
  return Number.isSafeInteger(count) && count > 0 ? count : null;
}

export function defaultPjLimits(values) {
  return {
    tables: optionalLimit(values.STUL_PJ_ROOM_LIMIT),
    bytes: optionalLimit(values.STUL_PJ_ROOM_BYTES_LIMIT),
  };
}

export const pjUsageSql = `
  SELECT coalesce(a.table_limit, ?) AS tableLimit, coalesce(a.bytes_limit, ?) AS byteLimit,
    count(r.id) AS tables, coalesce(sum(length(CAST(r.data AS BLOB))), 0) AS bytes
  FROM pj_accounts a LEFT JOIN rooms r ON r.owner_id = a.id
  WHERE a.id = ? GROUP BY a.id
`;

export const pjAdmissionSql = `
  EXISTS (
    SELECT 1 FROM (
      SELECT id, coalesce(table_limit, ?) AS table_limit, coalesce(bytes_limit, ?) AS bytes_limit
      FROM pj_accounts WHERE id = ? AND status = 'approved' AND verified_at IS NOT NULL
    ) a
    WHERE (a.table_limit IS NULL OR (SELECT count(*) FROM rooms r WHERE r.owner_id = a.id) < a.table_limit)
      AND (a.bytes_limit IS NULL OR
        (SELECT coalesce(sum(length(CAST(r.data AS BLOB))), 0) FROM rooms r WHERE r.owner_id = a.id) + ? <= a.bytes_limit)
  )
`;

export function pjAdmissionValues(accountId, defaults, addedBytes) {
  return [defaults.tables, defaults.bytes, accountId, addedBytes];
}

export function pjAdmissionError(usage, addedBytes) {
  if (usage?.tableLimit != null && usage.tables >= usage.tableLimit)
    return 'Dosáhl jsi limitu počtu stolů pro svůj účet PJ.';
  if (usage?.byteLimit != null && usage.bytes + addedBytes > usage.byteLimit)
    return 'Kampaně dosáhly limitu dat pro účet PJ.';
  return null;
}
