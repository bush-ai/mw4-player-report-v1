import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, summarize } from './model.js';

const MODE_MINIMUM = 5;

function median(values) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function PlayerLink({ player, scope }) {
  return <Link className="bush-player" to={`/players/${player.id}${scope}`}>{player.name}</Link>;
}

function leaderRows(entries, mode) {
  return entries.map(({ player, records }) => {
    const rows = records.maps.filter(row => row.mode === mode);
    const stats = summarize(rows);
    const damageCount = rows.filter(row => Number.isFinite(row.metrics.DMG)).length;
    return { ...player, stats, damageCount };
  });
}

function leaders(players, key, countKey) {
  return players.filter(player => player[countKey] >= MODE_MINIMUM && Number.isFinite(player.stats[key]))
    .sort((a, b) => b.stats[key] - a.stats[key] || a.name.localeCompare(b.name)).slice(0, 3);
}

function Leaders({ players, metric, suffix, scope, digits }) {
  if (!players.length) return <p className="bush-muted">No players meet the five-map minimum for this measure in this view.</p>;
  return <ol className="bush-leaders">{players.map(player => <li key={player.id}>
    <PlayerLink player={player} scope={scope} />
    <strong>{format(player.stats[metric], digits)}</strong><span>{suffix(player)} maps</span>
  </li>)}</ol>;
}

function ModeSection({ id, name, entries, scope }) {
  const players = leaderRows(entries, id);
  const withMaps = players.filter(player => player.stats.count);
  if (!withMaps.length) return null;
  const kd = leaders(players.map(player => ({ ...player, paired: player.stats.paired })), 'kd', 'paired');
  const damage = leaders(players, 'damage', 'damageCount');
  const mapRecords = withMaps.reduce((total, player) => total + player.stats.count, 0);
  return <section className="bush-section">
    <div className="bush-section-head"><div><p className="eyebrow">MODE REVIEW</p><h2>{name}</h2></div>
      <span>{withMaps.length} players / {mapRecords} player-map records</span></div>
    <p>These lists highlight individual efficiency and damage production within {name}. Each requires at least {MODE_MINIMUM} maps with the relevant statistic.
      Map lengths and opponent strength differ, so the numbers are a starting point for reviewing individual performances.</p>
    <div className="bush-mode-grid">
      <div><h3>K/D leaders</h3><p className="bush-muted">Kills divided by deaths on maps with both values.</p>
        <Leaders players={kd} metric="kd" digits={2} suffix={player => player.stats.paired} scope={scope} /></div>
      <div><h3>Damage per map</h3><p className="bush-muted">Average across maps with damage recorded.</p>
        <Leaders players={damage} metric="damage" digits={0} suffix={player => player.damageCount} scope={scope} /></div>
    </div>
  </section>;
}

export default function BushReport({ data, event, mode, entries, ratings, scope }) {
  const report = useMemo(() => {
    const maps = entries.flatMap(entry => entry.records.maps);
    const sample = entries.map(entry => entry.stats.count);
    const average = sample.length ? sample.reduce((sum, value) => sum + value, 0) / sample.length : null;
    const middle = median(sample);
    const eventCoverage = data.events.map(item => {
      const players = entries.filter(entry => [...entry.records.maps, ...entry.records.series].some(row => row.event === item.id));
      return { ...item, players: players.length, maps: maps.filter(row => row.event === item.id).length };
    }).filter(item => item.players);
    const ranked = ratings.map(rating => {
      const entry = entries.find(item => item.player.id === rating.id);
      return { ...rating, count: entry?.stats.count ?? 0, kd: entry?.stats.kd,
        modes: [...new Set(rating.breakdown.map(item => item.mode))] };
    });
    return { maps, average, middle, eventCoverage, ranked, smallSamples: sample.filter(count => count < 10).length };
  }, [data, entries, ratings]);

  const top = report.ranked[0];
  const breadth = report.ranked.filter(player => player.modes.length >= 2 && player.count >= 10).slice(0, 3);
  const smaller = report.ranked.filter(player => player.count < 10).slice(0, 3);
  const volume = [...entries].filter(entry => entry.stats.count)
    .sort((a, b) => b.stats.count - a.stats.count || a.player.name.localeCompare(b.player.name)).slice(0, 3);
  const eventName = data.events.find(item => item.id === event)?.name || 'All events';
  const modeName = data.modes[mode] || 'All recorded modes';

  return <article className="bush-report">
    <header className="bush-header">
      <p className="eyebrow">BUSH AI / PLAYER LANDSCAPE</p>
      <h1>The <em>BushAi Report</em></h1>
      <p>An evidence-led look at the player field, its standout performances, and the sample sizes behind them.</p>
      <div className="bush-context"><span>{eventName}</span><span>{modeName}</span><span>Updates with the filters above</span></div>
    </header>
    <div className="bush-facts">
      <div><strong>{entries.length}</strong><span>players in view</span></div>
      <div><strong>{report.maps.length.toLocaleString()}</strong><span>player-map records</span></div>
      <div><strong>{format(report.average, 1)}</strong><span>average maps / player</span></div>
      <div><strong>{format(report.middle, 1)}</strong><span>median maps / player</span></div>
    </div>
    {!entries.length ? <p className="empty">No player records are available for these filters.</p> : <>
      <section className="bush-section bush-lead">
        <p className="eyebrow">THE OVERVIEW</p><h2>Reading the field</h2>
        <p>The selected dataset contains {entries.length} players and {report.maps.length.toLocaleString()} recorded player-map entries.
          The average player has {format(report.average, 1)} maps and the median is {format(report.middle, 1)}.
          {report.smallSamples > 0 && <> {report.smallSamples} {report.smallSamples === 1 ? 'player has' : 'players have'} fewer than 10 recorded maps, so a single strong series can have a substantial effect on their averages.</>}</p>
        {top ? <p><PlayerLink player={top} scope={scope} /> currently leads the performance score at <strong>{format(top.score, 1)}</strong> across {top.count} recorded maps.
          {top.count < 10 ? ' That is a small overall sample, so the placement is sensitive to a few maps.' : ' The score reflects the recorded sample rather than an assessment of future results.'}
          {' '}The rating uses {top.modes.length} qualifying {top.modes.length === 1 ? 'mode' : 'modes'} for this player.</p>
          : <p>No player qualifies for an overall rating in this view. Browse individual profiles for their recorded stats.</p>}
      </section>
      <section className="bush-section">
        <div className="bush-section-head"><div><p className="eyebrow">THE RATING</p><h2>Who stands out</h2></div><Link to={`/tiers${scope}`}>View all tiers</Link></div>
        <p>The current score compares K/D, kills per map, and damage per map within each mode. It requires at least three recorded maps per measure and two qualifying measures per mode.
          K/D carries 40% weight and the other two measures 30% each. Qualifying modes are weighted equally, regardless of map count.</p>
        {report.ranked.length ? <div className="bush-table-wrap"><table className="bush-table"><thead><tr><th>Player</th><th>Score</th><th>Maps</th><th>Qualifying modes</th></tr></thead>
          <tbody>{report.ranked.slice(0, 8).map(player => <tr key={player.id}><th scope="row"><PlayerLink player={player} scope={scope} /></th>
            <td>{format(player.score, 1)}</td><td>{player.count}</td><td>{player.modes.map(item => data.modes[item]).join(', ')}</td></tr>)}</tbody></table></div>
          : <p className="bush-muted">There are no eligible ratings for the current filters.</p>}
        <p className="bush-muted">A rating is a description of this comparison field. It does not adjust for small samples, schedule strength, roles, or unequal mode coverage.</p>
      </section>
      <section className="bush-section">
        <p className="eyebrow">CONTEXT MATTERS</p><h2>Sample size and coverage</h2>
        {breadth.length > 0 && <p>Among the higher-rated players with at least 10 recorded maps and two qualifying modes, {breadth.map((player, i) =>
          <React.Fragment key={player.id}>{i > 0 ? (i === breadth.length - 1 ? ' and ' : ', ') : ''}<PlayerLink player={player} scope={scope} /> ({player.count} maps, {player.modes.length} modes)</React.Fragment>)} provide broader samples for further review.
          These thresholds are used for this discussion only and do not change the official scores.</p>}
        {smaller.length > 0 && <p>Smaller-sample ratings to watch include {smaller.map((player, i) =>
          <React.Fragment key={player.id}>{i > 0 ? (i === smaller.length - 1 ? ' and ' : ', ') : ''}<PlayerLink player={player} scope={scope} /> ({player.count} maps, {format(player.score, 1)} score)</React.Fragment>)}.
          Their results are part of the ranking, but their placement could move substantially as additional maps are recorded.</p>}
        {volume.length > 0 && <p>The largest recorded samples in this view belong to {volume.map((entry, i) =>
          <React.Fragment key={entry.player.id}>{i > 0 ? (i === volume.length - 1 ? ' and ' : ', ') : ''}<PlayerLink player={entry.player} scope={scope} /> ({entry.stats.count} maps)</React.Fragment>)}.
          A larger sample provides more observations, though opponents and mode mix still affect the comparison.</p>}
      </section>
      {Object.entries(data.modes).map(([id, name]) => <ModeSection key={id} id={id} name={name} entries={entries} scope={scope} />)}
      <section className="bush-section">
        <p className="eyebrow">EVENT COVERAGE</p><h2>Where the data comes from</h2>
        <div className="bush-table-wrap"><table className="bush-table"><thead><tr><th>Event</th><th>Players</th><th>Player-map records</th></tr></thead>
          <tbody>{report.eventCoverage.map(item => <tr key={item.id}><th scope="row">{item.name}</th><td>{item.players}</td><td>{item.maps}</td></tr>)}</tbody></table></div>
        <p>Player-map records count one player's recorded statistics on one map, not unique maps played. Some maps have match context but no individual statistics.
          Event dates are unavailable in the source, so this report does not infer improvement, decline, or event order.</p>
      </section>
      <section className="bush-section">
        <p className="eyebrow">THE FULL FIELD</p><h2>Every player in this view</h2>
        <p>Open the field list to review every player with recorded stats under the selected filters. Unranked players have not met the scoring requirements.</p>
        <details className="bush-field"><summary>Show all {entries.length} players</summary>
          <div className="bush-table-wrap"><table className="bush-table"><thead><tr><th>Player</th><th>Score</th><th>Maps</th><th>K/D</th></tr></thead>
            <tbody>{[...entries].sort((a, b) => {
              const left = report.ranked.find(item => item.id === a.player.id);
              const right = report.ranked.find(item => item.id === b.player.id);
              return (right?.score ?? -1) - (left?.score ?? -1) || a.player.name.localeCompare(b.player.name);
            }).map(entry => {
              const rating = report.ranked.find(item => item.id === entry.player.id);
              return <tr key={entry.player.id}><th scope="row"><PlayerLink player={entry.player} scope={scope} /></th>
                <td>{format(rating?.score, 1)}</td><td>{entry.stats.count}</td><td>{format(entry.stats.kd)}<small>{entry.stats.paired} K/D maps</small></td></tr>;
            })}</tbody>
          </table></div>
        </details>
      </section>
      <section className="bush-section">
        <p className="eyebrow">METHODOLOGY</p><h2>How to use this report</h2>
        <p>All numbers are computed from the selected filters and update as new supported workbooks are added. Mode leaders require five recorded maps for the displayed measure.
          K/D uses total kills divided by total deaths on maps where both are recorded. Damage per map excludes missing damage values.
          Players can qualify for a score from different combinations of modes, so those scores are not based on identical coverage.</p>
        <p>The report is generated from the statistics using fixed rules. It does not evaluate film, positions, opponents, or unrecorded maps.
          Open a player profile to review the event and mode breakdowns before drawing a conclusion.</p>
      </section>
    </>}
  </article>;
}
