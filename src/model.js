import { group, mean, sum } from 'd3';

export function summarize(rows) {
  const paired = rows.filter(({ metrics }) => Number.isFinite(metrics.K) && Number.isFinite(metrics.D));
  const deaths = sum(paired, row => row.metrics.D);
  return {
    count: rows.length,
    series: new Set(rows.map(row => row.seriesId)).size,
    kd: deaths ? sum(paired, row => row.metrics.K) / deaths : null,
    kills: mean(rows, row => row.metrics.K) ?? null,
    damage: mean(rows, row => row.metrics.DMG) ?? null,
    paired: paired.length,
  };
}

export function selectRecords(player, event, mode) {
  const inEvent = row => !event || row.event === event;
  return {
    maps: player.maps.filter(row => inEvent(row) && (!mode || row.mode === mode)),
    series: mode ? [] : player.series.filter(inEvent),
  };
}

export function mapBreakdown(rows) {
  return Array.from(group(rows, row => row.mode, row => row.map || 'Map name unavailable'), ([mode, maps]) =>
    Array.from(maps, ([name, samples]) => ({ mode, name, ...summarize(samples) })))
    .flat().sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export const format = (value, digits = 2) => Number.isFinite(value)
  ? value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  : '—';
