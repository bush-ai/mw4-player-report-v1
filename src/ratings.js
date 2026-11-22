import { mean } from 'd3';
import { summarize } from './model.js';

const weights = { kd: 0.4, kills: 0.3, damage: 0.3 };
const metricCount = (rows, metric) => metric === 'kd'
  ? rows.filter(row => Number.isFinite(row.metrics.K) && Number.isFinite(row.metrics.D)).length
  : rows.filter(row => Number.isFinite(row.metrics[metric === 'kills' ? 'K' : 'DMG'])).length;

export function ratePlayers(entries) {
  const modes = [...new Set(entries.flatMap(entry => entry.records.maps.map(row => row.mode)))];
  const fields = new Map();
  const grouped = entries.map(entry => ({
    ...entry,
    modes: new Map(modes.map(mode => {
      const rows = entry.records.maps.filter(row => row.mode === mode);
      return [mode, { stats: summarize(rows), counts: Object.fromEntries(Object.keys(weights).map(key => [key, metricCount(rows, key)])) }];
    })),
  }));
  for (const mode of modes) for (const metric of Object.keys(weights)) {
    fields.set(`${mode}:${metric}`, grouped.map(entry => entry.modes.get(mode))
      .filter(item => item.counts[metric] >= 3 && Number.isFinite(item.stats[metric]))
      .map(item => item.stats[metric]));
  }
  const ranked = [];
  for (const entry of grouped) {
    const breakdown = [];
    const scores = [];
    for (const mode of modes) {
      const { stats, counts } = entry.modes.get(mode);
      const measures = Object.keys(weights).filter(metric => counts[metric] >= 3 && Number.isFinite(stats[metric]));
      if (measures.length < 2) continue;
      const components = measures.map(metric => {
        const values = fields.get(`${mode}:${metric}`);
        const below = values.filter(value => value < stats[metric]).length;
        const ties = values.filter(value => value === stats[metric]).length;
        const percentile = values.length < 2 ? 50 : 100 * (below + (ties - 1) / 2) / (values.length - 1);
        return { mode, metric, percentile, count: counts[metric], value: stats[metric] };
      });
      breakdown.push(...components);
      scores.push(components.reduce((total, item) => total + item.percentile * weights[item.metric], 0) /
        components.reduce((total, item) => total + weights[item.metric], 0));
    }
    if (scores.length) ranked.push({ id: entry.player.id, name: entry.player.name, score: mean(scores), breakdown });
  }
  ranked.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const mvp = ranked.filter(item => item.score === ranked[0].score).length;
  const elite = mvp + Math.ceil(ranked.length * .10);
  const platinum = elite + Math.ceil(ranked.length * .20);
  const silver = platinum + Math.ceil(ranked.length * .30);
  ranked.forEach((item, index) => {
    const first = ranked.findIndex(other => other.score === item.score);
    item.rank = first + 1;
    item.tier = first < mvp ? 'MVP' : first < elite ? 'Elite' : first < platinum ? 'Platinum' : first < silver ? 'Silver' : 'Bronze';
  });
  return ranked;
}
