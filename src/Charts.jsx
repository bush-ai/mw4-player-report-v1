import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { max, scaleLinear } from 'd3';
import { format, selectRecords, summarize } from './model.js';

export function TierBadge({ tier }) {
  return <span className={`tier-badge tier-${tier.toLowerCase()}`}>{tier}</span>;
}

export function Tiers({ ratings, scope }) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState({});
  const visible = ratings.filter(player => player.name.toLowerCase().includes(query.trim().toLowerCase()));
  return <>
    <header className="hero"><p className="eyebrow">PERFORMANCE RATINGS</p><h1>Player <em>Tiers</em></h1>
      <p>See how players compare within the selected events and modes. Ratings are recalculated when the filters change.</p></header>
    <div className="rating-summary"><strong>{ratings.length}</strong><span>eligible players</span></div>
    <details className="rating-method"><summary>How tiers are calculated</summary>
      <p>Within each mode, K/D, kills per map and damage per map are compared with eligible players using percentiles.
        Their weights are 40%, 30% and 30%. A measure needs three recorded maps, and a mode needs at least two qualifying measures.
        Eligible modes have equal weight. Missing measures are omitted and the remaining weights are rescaled.</p>
      <p>The highest score earns MVP. The next 10% earn Elite, the next 20% Platinum, the next 30% Silver, and the rest Bronze.
        Ties stay together. Players without a qualifying score are unranked. Ratings describe this dataset and can change as records are added.</p>
    </details>
    <label className="rating-search">Find a player<input type="search" placeholder="Search players" value={query} onChange={e => setQuery(e.target.value)} /></label>
    <div className="tier-groups">{['MVP', 'Elite', 'Platinum', 'Silver', 'Bronze'].map(tier => {
      const players = visible.filter(player => player.tier === tier);
      if (!players.length) return null;
      const showAll = tier === 'MVP' || expanded[tier];
      const displayed = showAll ? players : players.slice(0, 10);
      const groupId = `tier-group-${tier.toLowerCase()}`;
      return <section className={`tier-group tier-group-${tier.toLowerCase()}`} key={tier} aria-labelledby={groupId}>
        <div className="tier-group-header"><div><h2 id={groupId}>{tier}</h2><span>{players.length} {players.length === 1 ? 'player' : 'players'}</span></div>
          {tier !== 'MVP' && players.length > 10 && <button type="button" aria-expanded={!!expanded[tier]}
            aria-controls={`${groupId}-players`} onClick={() => setExpanded(current => ({ ...current, [tier]: !current[tier] }))}>
            {showAll ? 'Show less' : `Show all ${players.length}`}
          </button>}
        </div>
        <div className="tier-grid" id={`${groupId}-players`}>{displayed.map(player =>
          <Link className="tier-player" key={player.id} to={`/players/${player.id}${scope}`}>
            <span className="tier-player-name">{player.name}</span><strong>{format(player.score, 1)}</strong>
          </Link>)}</div>
      </section>;
    })}</div>
    {!visible.length && <p className="empty">No eligible players match this view.</p>}
  </>;
}

export function Fingerprint({ rating, modes }) {
  const [selectedMode, setSelectedMode] = useState('');
  if (!rating) return <div className="panel traits-panel"><h2>Performance profile</h2><p className="muted">Not enough recorded stats for a rating in this view.</p></div>;
  const labels = { kd: 'K/D', kills: 'Kills / map', damage: 'Damage / map' };
  const modeNames = [...new Set(rating.breakdown.map(item => item.mode))];
  const mode = modeNames.includes(selectedMode) ? selectedMode : modeNames[0];
  const measures = rating.breakdown.filter(item => item.mode === mode);
  const keys = ['kd', 'kills', 'damage'];
  const position = (index, radius) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / 3;
    return [150 + Math.cos(angle) * radius, 115 + Math.sin(angle) * radius];
  };
  const polygon = radius => keys.map((_, index) => position(index, radius).join(',')).join(' ');
  const values = keys.map(key => measures.find(item => item.metric === key));
  const complete = values.every(Boolean);
  const shape = values.map((item, index) => position(index, (item?.percentile ?? 0) * .72).join(',')).join(' ');
  return <div className="panel traits-panel">
    <div className="section-title"><div><p className="eyebrow">PLAYER TRAITS</p><h2>Performance profile</h2></div><TierBadge tier={rating.tier} /></div>
    <p className="muted">Percentile within each mode / three map minimum</p>
    {modeNames.length > 1 && <label className="traits-select">Mode<select value={mode} onChange={event => setSelectedMode(event.target.value)}>
      {modeNames.map(item => <option key={item} value={item}>{modes[item]}</option>)}</select></label>}
    {complete ? <svg className="radar" viewBox="0 0 300 225" role="img" aria-label={`Performance percentiles for ${modes[mode]}`}>
      {[24, 48, 72].map(radius => <polygon key={radius} points={polygon(radius)} className="radar-grid" />)}
      {keys.map((key, index) => { const [x, y] = position(index, 72); return <line key={key} x1="150" y1="115" x2={x} y2={y} className="radar-axis" />; })}
      <polygon points={shape} className="radar-shape" />
      {values.map((item, index) => { const [x, y] = position(index, item.percentile * .72); return <circle key={item.metric} cx={x} cy={y} r="3" className="radar-dot" />; })}
      {keys.map((key, index) => { const [x, y] = position(index, 102); return <text key={key} x={x} y={y} textAnchor="middle"><tspan x={x} dy="0" className="radar-value">{format(values[index].percentile, 0)}th</tspan><tspan x={x} dy="15">{labels[key]}</tspan></text>; })}
    </svg> : <p className="muted">A chart needs all three measures. Recorded percentiles are listed below.</p>}
    <ul className="traits-metrics">{measures.map(item => <li key={item.metric}><span>{labels[item.metric]}<small>{item.count} maps</small></span>
      <strong>{format(item.value, item.metric === 'damage' ? 0 : 2)}<small>{format(item.percentile, 0)}th percentile</small></strong></li>)}</ul>
    <div className="rating-foot">Overall score <strong>{format(rating.score, 1)}</strong> / 100 <span>Rank #{rating.rank}</span></div>
  </div>;
}

export function Explore({ data, entries, event, mode, scope }) {
  const [minimum, setMinimum] = useState(3);
  const [hover, setHover] = useState(null);
  const points = useMemo(() => entries.map(({ player, records }) => {
    const stats = summarize(records.maps);
    const damageCount = records.maps.filter(row => Number.isFinite(row.metrics.DMG)).length;
    return { player, stats, damageCount };
  }).filter(point => point.stats.paired >= minimum && point.damageCount >= minimum &&
    Number.isFinite(point.stats.kd) && Number.isFinite(point.stats.damage)), [entries, minimum]);
  const x = scaleLinear().domain([0, Math.max(1, max(points, point => point.stats.kd) || 0)]).nice().range([65, 690]);
  const y = scaleLinear().domain([0, Math.max(1, max(points, point => point.stats.damage) || 0)]).nice().range([330, 30]);
  return <>
    <header className="hero"><p className="eyebrow">EXPLORE THE FIELD</p><h1>Player <em>Charts</em></h1>
      <p>Explore combat output across the selected player field. Choose a mode to compare players in the same game type.</p></header>
    <div className="filters"><label>Minimum contributing maps<select value={minimum} onChange={e => setMinimum(Number(e.target.value))}>
      {[1, 3, 5, 10].map(value => <option key={value} value={value}>{value} maps</option>)}</select></label></div>
    <section className="panel chart-panel"><h2>K/D and damage</h2>
      <p className="muted">{points.length} players have at least {minimum} maps with each metric. Select a point to open a profile.</p>
      {points.length ? <svg viewBox="0 0 730 390" role="img" aria-label="Player K/D compared with damage per map">
        {x.ticks(5).map(tick => <g key={tick}><line x1={x(tick)} x2={x(tick)} y1="30" y2="330" /><text x={x(tick)} y="350" textAnchor="middle">{format(tick, 1)}</text></g>)}
        {y.ticks(5).map(tick => <g key={tick}><line x1="65" x2="690" y1={y(tick)} y2={y(tick)} /><text x="56" y={y(tick) + 4} textAnchor="end">{format(tick, 0)}</text></g>)}
        {points.map(point => <Link key={point.player.id} to={`/players/${point.player.id}${scope}`}
          aria-label={`${point.player.name}, K/D ${format(point.stats.kd)}, damage per map ${format(point.stats.damage, 0)}, ${point.stats.paired} K/D maps and ${point.damageCount} damage maps`}
          onMouseEnter={() => setHover(point)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(point)} onBlur={() => setHover(null)}>
          <circle cx={x(point.stats.kd)} cy={y(point.stats.damage)} r="6"><title>{point.player.name}</title></circle>
        </Link>)}
        <text x="380" y="380" textAnchor="middle">K/D</text><text x="65" y="17">Damage / map</text>
      </svg> : <p className="empty">No players meet this sample requirement.</p>}
      <p className="chart-selection" aria-live="polite">{hover ? `${hover.player.name} · ${format(hover.stats.kd)} K/D · ${format(hover.stats.damage, 0)} damage / map · ${hover.stats.paired} K/D maps · ${hover.damageCount} damage maps` : 'Hover or focus on a point to see its player.'}</p>
      {!mode && <p className="muted">All modes combine maps with different lengths and rules.</p>}
    </section>
    <ModeChart entries={entries} scope={scope} />
  </>;
}
export function ModeChart({ entries, scope }) {
  const points = entries.map(({ player, records }) => {
    const hp = summarize(records.maps.filter(row => row.mode === 'hardpoint'));
    const snd = summarize(records.maps.filter(row => row.mode === 'search-and-destroy'));
    return { player, hp, snd };
  }).filter(item => item.hp.paired >= 3 && item.snd.paired >= 3 && Number.isFinite(item.hp.kd) && Number.isFinite(item.snd.kd));
  const ceiling = Math.max(1, max(points, item => Math.max(item.hp.kd, item.snd.kd)) || 0);
  const x = scaleLinear().domain([0, ceiling]).nice().range([65, 690]);
  const y = scaleLinear().domain(x.domain()).range([330, 30]);
  return <section className="panel chart-panel"><h2>Hardpoint vs Search and Destroy</h2>
    <p className="muted">{points.length} players with at least three K/D maps in each mode. Select a point to open a profile.</p>
    {points.length ? <svg viewBox="0 0 730 390" role="img" aria-label="Hardpoint K/D compared with Search and Destroy K/D">
      {x.ticks(5).map(tick => <g key={tick}><line x1={x(tick)} x2={x(tick)} y1="30" y2="330" /><text x={x(tick)} y="350" textAnchor="middle">{format(tick, 1)}</text><text x="56" y={y(tick) + 4} textAnchor="end">{format(tick, 1)}</text></g>)}
      <line x1={x(0)} y1={y(0)} x2={x(x.domain()[1])} y2={y(y.domain()[1])} strokeDasharray="5 5" />
      {points.map(item => <Link key={item.player.id} to={`/players/${item.player.id}${scope}`} aria-label={`${item.player.name}, Hardpoint ${format(item.hp.kd)} K/D from ${item.hp.paired} maps, Search and Destroy ${format(item.snd.kd)} K/D from ${item.snd.paired} maps`}>
        <circle cx={x(item.hp.kd)} cy={y(item.snd.kd)} r="6"><title>{item.player.name} · HP {format(item.hp.kd)} · S&amp;D {format(item.snd.kd)}</title></circle>
      </Link>)}
      <text x="380" y="380" textAnchor="middle">Hardpoint K/D</text><text x="65" y="17">Search and Destroy K/D</text>
    </svg> : <p className="empty">Select all modes and an event with enough recorded stats in both modes.</p>}
  </section>;
}
