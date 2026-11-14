/** Select a complete finite SPL series without shifting frequency alignment. */
export function selectSplSeries(series: Record<string, unknown>, frequencyCount: number): number[] {
  for (const key of ['spl_sum', 'spl_front', 'spl']) {
    const values = series[key];
    if (Array.isArray(values) && values.length > 0 && values.length === frequencyCount &&
        values.every((value) => typeof value === 'number' && Number.isFinite(value))) {
      return values;
    }
  }
  return [];
}
