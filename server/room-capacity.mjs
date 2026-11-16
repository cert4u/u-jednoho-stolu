export function roomCapacity(values) {
  const limit = (name, fallback) => {
    const value = Number(values[name]);
    return Number.isSafeInteger(value) && value > 0 ? value : fallback;
  };
  return {
    rate: limit('STUL_ROOM_CREATE_RATE', 100),
    tables: limit('STUL_ROOM_LIMIT', 1000),
    bytes: limit('STUL_ROOM_BYTES_LIMIT', 256_000_000),
  };
}
