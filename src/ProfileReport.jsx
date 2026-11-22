import React from 'react';
import { Link } from 'react-router-dom';
import { format, mapBreakdown, summarize } from './model.js';
import { Fingerprint, TierBadge } from './Charts.jsx';

function total(rows, key) {
  const values = rows.map(row => row.metrics[key]).filter(Number.isFinite);
  return { value: values.length ? values.reduce((a, b) => a + b, 0) : null, count: values.length };
}

function stats(rows) {
  return { ...summarize(rows), killsTotal: total(rows, 'K'), deathsTotal: total(rows, 'D'),
    assistsTotal: total(rows, 'A'), damageCount: total(rows, 'DMG').count };
}

function sample(value, count, digits = 0) {
  return <>{format(value, digits)}<small>{count} maps</small></>;
}

function Section({ title, note, children, action }) {
  return <section className="report-section">
    <div className="report-section-heading"><div><h2>{title}</h2>{note && <p>{note}</p>}</div>{action}</div>
    {children}
  </section>;
}

export function PerformanceTable({ rows, mode = false }) {
  return <div className="table-scroll" role="region" aria-label={mode ? 'Game mode performance' : 'Tournament performance'} tabIndex={0}>
    <table className="performance-table"><thead><tr><th scope="col">{mode ? 'Mode' : 'Tournament'}</th>
      <th scope="col">Maps</th><th scope="col">K/D</th><th scope="col">Kills</th><th scope="col">Deaths</th>
      <th scope="col">Assists</th><th scope="col">Damage / map</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.id}><th scope="row">{row.name}</th><td>{row.stats.count}</td>
        <td className="accent">{sample(row.stats.kd, row.stats.paired, 2)}</td>
        <td>{sample(row.stats.killsTotal.value, row.stats.killsTotal.count)}</td>
        <td>{sample(row.stats.deathsTotal.value, row.stats.deathsTotal.count)}</td>
        <td>{sample(row.stats.assistsTotal.value, row.stats.assistsTotal.count)}</td>
        <td>{sample(row.stats.damage, row.stats.damageCount, 0)}</td></tr>)}</tbody>
    </table>
  </div>;
}

function eventRows(player, records, data) {
  return data.events.filter(event => [...records.maps, ...records.series].some(row => row.event === event.id))
    .map(event => ({ id: event.id, name: event.name, stats: stats(records.maps.filter(row => row.event === event.id)) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function modeRows(records, data) {
  return Object.entries(data.modes).map(([id, name]) => ({
    id, name, stats: stats(records.maps.filter(row => row.mode === id)),
  })).filter(row => row.stats.count);
}

export function ProfileReport({ player, records, data, rating, scope, children }) {
  const overview = stats(records.maps);
  const events = eventRows(player, records, data);
  const modes = modeRows(records, data);
  const maps = mapBreakdown(records.maps);
  const specialMetrics = {
    hardpoint: [['OBJ K', 'Objective kills'], ['HT', 'HT'], ['Contest', 'Contest']],
    'search-and-destroy': [['FB', 'First bloods'], ['FD', 'First deaths'], ['P', 'P']],
    hijack: [['DUP', 'DUP'], ['DNK', 'DNK'], ['THR', 'THR'], ['PAS', 'PAS'], ['INT', 'INT']],
    overload: [['DUP', 'DUP'], ['DNK', 'DNK'], ['THR', 'THR'], ['PAS', 'PAS'], ['INT', 'INT']],
  };
  const metrics = [
    ['K/D', format(overview.kd), `${overview.paired} complete maps`],
    ['Kills', format(overview.killsTotal.value, 0), `${overview.killsTotal.count} maps`],
    ['Deaths', format(overview.deathsTotal.value, 0), `${overview.deathsTotal.count} maps`],
    ['Assists', format(overview.assistsTotal.value, 0), `${overview.assistsTotal.count} maps`],
    ['Damage / map', format(overview.damage, 0), `${overview.damageCount} maps`],
    ['Maps', format(overview.count, 0), 'recorded player stats'],
    ['Events', format(events.length, 0), 'in selected view'],
  ];
  return <>
    <div className="profile-header">
      <div><Link className="back" to={`/${scope}`}>Players</Link>
        <p className="eyebrow">PLAYER REPORT</p><h1>{player.name}</h1>
        <div className="profile-meta">{rating ? <><TierBadge tier={rating.tier} /><span>Rank #{rating.rank} / {format(rating.score, 1)} score</span></> : <span>Unranked in this view</span>}
          <span>{events.length} {events.length === 1 ? 'event' : 'events'}</span><span>{overview.count} maps</span></div>
      </div>
      <Link className="button compare-action" to={`/compare${scope ? scope + '&' : '?'}a=${player.id}`}>Compare player</Link>
    </div>
    <Section title="Performance overview" note="Map-level totals and averages for the selected filters.">
      <dl className="overview-strip">{metrics.map(([label, value, detail]) => <div key={label}><dt>{label}</dt><dd>{value}</dd><small>{detail}</small></div>)}</dl>
      <p className="data-note">Totals include recorded values only. K/D uses maps with both kills and deaths; sample counts appear beneath each value.</p>
    </Section>
    <Section title="Tournament performance" note="Events are listed alphabetically. Dates are not available in the source.">
      {events.length ? <PerformanceTable rows={events} /> : <p className="empty">No events in this view.</p>}
    </Section>
    <Section title="Game mode breakdown" note="Combat statistics are calculated from recorded player-map values in each mode.">
      {modes.length ? <><PerformanceTable rows={modes} mode />
        <div className="mode-details">{modes.map(item => {
          const selectedRows = records.maps.filter(row => row.mode === item.id);
          const measures = (specialMetrics[item.id] || []).map(([key, label]) => ({ key, label, ...total(selectedRows, key) }))
            .filter(measure => measure.count > 0);
          return measures.length ? <div key={item.id}><h3>{item.name} / additional recorded totals</h3>
            <dl>{measures.map(measure => <div key={measure.key}><dt>{measure.label}</dt>
              <dd>{format(measure.value, 0)}</dd><small>{measure.count} maps</small></div>)}</dl></div> : null;
        })}</div>
        <p className="data-note">Source abbreviations are retained where the workbook does not define them.</p></>
        : <p className="empty">No player-map stats in this view.</p>}
    </Section>
    <div className="profile-analysis">
      <Section title="Map performance" note="K/D from recorded maps with kills and deaths.">
        {maps.length ? <div className="map-list">{maps.map(item => <div className="map-line" key={`${item.mode}/${item.name}`}>
          <div><strong>{item.name}</strong><small>{data.modes[item.mode]} / {item.count} maps</small></div>
          <span className="map-value">{format(item.kd)}</span><small>K/D</small></div>)}</div> : <p className="empty">No recorded maps in this view.</p>}
      </Section>
      <Section title="Against the field" note="Percentile measures by mode. At least three recorded maps are required per measure.">
        <Fingerprint rating={rating} modes={data.modes} />
      </Section>
    </div>
    <details className="match-disclosure"><summary>Detailed match log <span>{records.maps.length} maps / {records.series.length} series</span></summary>{children}</details>
  </>;
}

export function ComparisonReport({ a, b, sides, data, scope, ratings, event, mode }) {
  const players = [a, b];
  const summaries = sides.map(stats);
  const ratingFor = player => ratings.find(item => item.id === player.id);
  const allEvents = data.events.filter(item => players.some(player => player.maps.some(row =>
    row.event === item.id && (!event || row.event === event) && (!mode || row.mode === mode))));
  const allModes = Object.entries(data.modes).filter(([id]) => sides.some(rows => rows.some(row => row.mode === id)));
  const statRows = [
    ['K/D', s => format(s.kd), s => `${s.paired} complete maps`],
    ['Kills', s => format(s.killsTotal.value, 0), s => `${s.killsTotal.count} maps`],
    ['Deaths', s => format(s.deathsTotal.value, 0), s => `${s.deathsTotal.count} maps`],
    ['Assists', s => format(s.assistsTotal.value, 0), s => `${s.assistsTotal.count} maps`],
    ['Damage / map', s => format(s.damage, 0), s => `${s.damageCount} maps`],
    ['Maps recorded', s => format(s.count, 0), () => 'player-map records'],
  ];
  const comparison = (title, rows) => <Section title={title} note="K/D uses maps with both kills and deaths.">
    <div className="table-scroll" tabIndex={0} role="region" aria-label={title}><table className="performance-table"><thead><tr>
      <th scope="col">{title}</th>{players.map((player, i) => <th scope="col" key={i}>{player.name}</th>)}</tr></thead><tbody>
      {rows.map(row => <tr key={row.id}><th scope="row">{row.name}</th>{sides.map((side, i) => {
        const values = stats(side.filter(row.test));
        return <td key={i}>{format(values.kd)}<small>{values.paired} K/D maps / {values.count} recorded</small></td>;
      })}</tr>)}</tbody></table></div></Section>;
  return <>
    <div className="comparison-identities">{players.map((player, i) => {
      const rating = ratingFor(player);
      const eventCount = new Set([...player.maps, ...(mode ? [] : player.series)].filter(row => !event || row.event === event).filter(row => !mode || row.mode === mode).map(row => row.event)).size;
      return <div key={i}><p className="eyebrow">{i === 0 ? 'PLAYER ONE' : 'PLAYER TWO'}</p>
        <Link to={`/players/${player.id}${scope}`}><h2>{player.name}</h2></Link>
        <p>{summaries[i].count} maps / {eventCount} events</p>
        <p>{rating ? <><TierBadge tier={rating.tier} /> <span>#{rating.rank} / {format(rating.score, 1)}</span></> : 'Unranked'}</p>
      </div>;
    })}</div>
    <Section title="Performance overview" note="Totals and per-map averages in the selected view.">
      <div className="comparison-stats">{statRows.map(([label, value, detail]) => <div className="comparison-stat" key={label}>
        <div><strong>{value(summaries[0])}</strong><small>{detail(summaries[0])}</small></div><span>{label}</span>
        <div><strong>{value(summaries[1])}</strong><small>{detail(summaries[1])}</small></div></div>)}</div>
    </Section>
    {comparison('By game mode', allModes.map(([id, name]) => ({ id, name, test: row => row.mode === id })))}
    {comparison('By tournament', allEvents.map(item => ({ id: item.id, name: item.name, test: row => row.event === item.id })))}
    {(() => {
      const lists = sides.map(mapBreakdown);
      const key = item => JSON.stringify([item.mode, item.name]);
      const maps = [...new Map(lists.flat().map(item => [key(item), item])).values()];
      return maps.length ? <Section title="By map" note="K/D and recorded map count for each player.">
        <div className="table-scroll" role="region" aria-label="Map comparison" tabIndex={0}><table className="performance-table">
          <thead><tr><th scope="col">Map / mode</th>{players.map((player, i) => <th key={i} scope="col">{player.name}</th>)}</tr></thead>
          <tbody>{maps.map(item => <tr key={key(item)}><th scope="row">{item.name}<small>{data.modes[item.mode]}</small></th>
            {lists.map((list, i) => { const match = list.find(candidate => key(candidate) === key(item));
              return <td key={i}>{format(match?.kd)}<small>{match?.count ?? 0} recorded maps</small></td>; })}</tr>)}</tbody>
        </table></div>
      </Section> : null;
    })()}
    <Section title="Percentiles against the field" note="The same selected field and three-map minimum apply to both players.">
      <div className="comparison-fingerprints">{players.map((player, i) => <div key={i}><h3>{player.name}</h3><Fingerprint rating={ratingFor(player)} modes={data.modes} /></div>)}</div>
    </Section>
  </>;
}
