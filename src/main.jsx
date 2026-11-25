import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Link, NavLink, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { format, selectRecords, summarize } from './model.js';
import { matchesParticipation, ratePlayers } from './ratings.js';
import { Explore, TierBadge, Tiers } from './Charts.jsx';
import { ProfileReport, ComparisonReport } from './ProfileReport.jsx';
import BushReport from './BushReport.jsx';
import './style.css';

const BASE = import.meta.env.BASE_URL;
const PAGE_SIZE = 20;

function Select({ label, value, onChange, items, empty }) {
  return <label>{label}<select value={value} onChange={event => onChange(event.target.value)}>
    {empty !== undefined && <option value="">{empty}</option>}
    {items.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
  </select></label>;
}

function eventOrder(events) {
  const order = name => /showcase/i.test(name) ? 0 : /cup\s*1\b/i.test(name) ? 1 : /cup\s*2\b/i.test(name) ? 2 : 3;
  return [...events].sort((a, b) => order(a.name) - order(b.name) || a.name.localeCompare(b.name, undefined, { numeric: true }));
}

function Filters({ data, event, mode, change }) {
  const available = new Set(data.players.flatMap(player => selectRecords(player, event, '').maps.map(row => row.mode)));
  return <div className="filters">
    <Select label="Event" value={event} onChange={value => change({ event: value, mode: '' })}
      items={eventOrder(data.events).map(item => [item.id, item.name])} empty="All events" />
    <div className="mode-filter">
      <span>Game mode</span>
      <div className="mode-buttons">
        {[['', 'All modes'], ...Object.entries(data.modes).filter(([id]) => available.has(id))].map(([id, name]) =>
          <button type="button" key={id} aria-pressed={mode === id} onClick={() => change({ mode: id })}>{name}</button>)}
      </div>
    </div>
  </div>;
}

function Table({ headers, children, label }) {
  return <div className="table-scroll" tabIndex={0} role="region" aria-label={label}>
    <table><thead><tr>{headers.map(header => <th key={header} scope="col">{header}</th>)}</tr></thead>
      <tbody>{children}</tbody>
    </table>
  </div>;
}

function Pagination({ page, count, setPage, pageSize = PAGE_SIZE }) {
  if (count <= pageSize) return null;
  return <div className="pagination">
    <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
    <span>{page * pageSize + 1}–{Math.min((page + 1) * pageSize, count)} of {count}</span>
    <button type="button" disabled={(page + 1) * pageSize >= count} onClick={() => setPage(page + 1)}>Next</button>
  </div>;
}

function Directory({ data, event, scope, entries, ratings, criteria }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [order, setOrder] = useState('score');
  const [minimum, setMinimum] = useState('0');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState([]);
  const pageSize = 40;
  const ratingsByPlayer = new Map(ratings.map(item => [item.id, item]));
  const matches = entries.map(entry => ({ ...entry, rating: ratingsByPlayer.get(entry.player.id) }))
    .filter(({ player, stats }) => player.name.toLowerCase().includes(query.trim().toLowerCase()) && stats.count >= Number(minimum))
    .sort((a, b) => {
      const left = order === 'score' ? a.rating?.score : a.stats[order];
      const right = order === 'score' ? b.rating?.score : b.stats[order];
      return (order === 'name' ? 0 : (right ?? -1) - (left ?? -1)) || a.player.name.localeCompare(b.player.name);
    });
  const series = new Set(entries.flatMap(entry => [...entry.records.maps, ...entry.records.series].map(row => row.seriesId)));
  const activeSelected = selected.filter(id => entries.some(entry => entry.player.id === id));
  const togglePlayer = id => setSelected(current => current.includes(id)
    ? current.filter(item => item !== id)
    : current.length < 2 ? [...current, id] : [current[1], id]);
  const compareParams = new URLSearchParams(scope.slice(1));
  if (activeSelected[0]) compareParams.set('a', activeSelected[0]);
  if (activeSelected[1]) compareParams.set('b', activeSelected[1]);
  return <>
    <header className="hero directory-hero">
      <div><p className="eyebrow">PLAYER DATABASE</p><h1>Player <em>board.</em></h1>
        <p>Compare the field, find a player, and get into the details.</p></div>
      <div className="hero-context"><span>MW4</span><small>COMPETITIVE DATA</small></div>
    </header>
    <div className="board-summary">
      <span><strong>{format(entries.length, 0)}</strong> players</span>
      <span><strong>{format(series.size, 0)}</strong> series</span>
      <span><strong>{format(entries.reduce((total, entry) => total + entry.stats.count, 0), 0)}</strong> player maps</span>
      <span><strong>{format(event ? 1 : data.events.length, 0)}</strong> events</span>
    </div>
    <section aria-labelledby="directory">
      <div className="section-title board-heading"><div><p className="eyebrow">THE FIELD</p><h2 id="directory">Player board</h2></div>
        <span>{matches.length} players</span></div>
      <div className="filters directory-filters">
        <label>Search players<input type="search" placeholder="Search gamertag" value={query}
          onChange={event => { setQuery(event.target.value); setPage(0); }} /></label>
        <Select label="Sort by" value={order} onChange={value => { setOrder(value); setPage(0); }}
          items={ [['score', 'Performance score'], ['count', 'Maps recorded'], ['kd', 'K/D'], ['kills', 'Kills per map'], ['damage', 'Damage per map'], ['name', 'Player name']] } />
        <Select label="Minimum maps" value={minimum} onChange={value => { setMinimum(value); setPage(0); }}
          items={ [['0', 'Any sample'], ['3', '3 maps'], ['5', '5 maps'], ['10', '10 maps']] } />
      </div>
      <div className="board-toolbar"><span>Select up to two players to compare their stats</span>
        {activeSelected.length > 0 && <button type="button" className="clear-selection" onClick={() => setSelected([])}>Clear</button>}
        <Link className={`compare-action ${activeSelected.length < 2 ? 'disabled' : ''}`}
          to={`/compare?${compareParams}`} aria-disabled={activeSelected.length < 2}
          onClick={event => { if (activeSelected.length < 2) event.preventDefault(); }}>
          Compare {activeSelected.length}/2
        </Link></div>
      {matches.length ? <Table label="Player comparison board" headers={['Compare', 'Player', 'Tier', 'Score', 'Maps', 'K/D', 'Kills / map', 'Damage / map']}>
        {matches.slice(page * pageSize, (page + 1) * pageSize).map(({ player, stats, rating }) =>
          <tr key={player.id} className={`board-row ${activeSelected.includes(player.id) ? 'board-selected' : ''}`}
            onClick={event => {
              if (event.target.closest('a, input, button, label') || window.getSelection()?.toString()) return;
              navigate(`/players/${player.id}${scope}`);
            }}>
            <td><input className="player-check" type="checkbox" checked={activeSelected.includes(player.id)}
              aria-label={`Select ${player.name} for comparison`} onChange={() => togglePlayer(player.id)} /></td>
            <th scope="row"><Link className="board-player" to={`/players/${player.id}${scope}`}>
              
              <span>{player.name}<small>{rating ? `Rank #${rating.rank}` : !matchesParticipation(player, data.events, criteria) ? 'Does not meet participation filter' : 'Unranked'}</small></span></Link></th>
            <td>{rating ? <TierBadge tier={rating.tier} /> : <span className="unranked">Unranked</span>}</td>
            <td><span className="board-score">{format(rating?.score, 1)}</span></td>
            <td>{stats.count}</td><td className="accent">{format(stats.kd)}</td>
            <td>{format(stats.kills, 1)}</td><td>{format(stats.damage, 0)}</td>
          </tr>)}
      </Table> : <p className="empty" role="status">No players match these filters.</p>}
      <Pagination page={page} count={matches.length} setPage={setPage} pageSize={pageSize} />
      <p className="board-note">Rankings use the selected event, modes and participation filters. Score needs at least three maps per qualifying measure. <Link to={`/tiers${scope}`}>How tiers work</Link></p>
    </section>
  </>;
}

function Records({ records, data }) {
  const [kind, setKind] = useState(records.maps.length ? 'maps' : 'series');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(null);
  const rows = records[kind];
  const mapView = kind === 'maps';
  const eventNames = Object.fromEntries(data.events.map(event => [event.id, event.name]));
  return <section className="records">
    <div className="section-title"><h2>Match log</h2><div className="mode-buttons">
      {['maps', 'series'].filter(option => records[option].length).map(option =>
        <button key={option} type="button" aria-pressed={kind === option}
          onClick={() => { setKind(option); setPage(0); setSelected(null); }}>
          {option === 'maps' ? 'Maps' : 'Series'} ({records[option].length})
        </button>)}
    </div></div>
    {rows.length ? <Table label="Player match log" headers={['Event / Series', mapView ? 'Map / Mode' : 'Series result', 'Team / Opponent', 'Kills', 'Deaths', 'Assists', 'Damage', 'Details']}>
      {rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(row => {
        const rowKey = `${row.event}/${row.sources[0].sheet}/${row.sources[0].row}`;
        const detailsId = `details-${row.event}-${row.sources[0].row}`;
        return <React.Fragment key={rowKey}>
          <tr>
            <th scope="row">{eventNames[row.event]}<small>{row.series}</small></th>
            <td>{mapView ? <>{row.map || 'Map name unavailable'}<small>Map {row.mapNumber} / {data.modes[row.mode]}{row.result && ' / ' + row.result}</small></> : row.result || '-'}</td>
            <td>{row.team}<small>vs {row.opponent}</small></td>
            {['K', 'D', 'A', 'DMG'].map(key => <td key={key}>{format(row.metrics[key], 0)}</td>)}
            <td><button type="button" aria-expanded={selected === row} aria-controls={detailsId}
              onClick={() => setSelected(selected === row ? null : row)}>{selected === row ? 'Hide stats' : 'View stats'}</button></td>
          </tr>
          {selected === row && <tr className="details-row" id={detailsId}><td colSpan={8}>
            <div className="record-details inline-details">
              <div><h3>{eventNames[row.event]} / {row.series}{row.map && ` / ${row.map}`}</h3>
                <p className="muted">Source {row.sources.map(source => `${source.sheet} row ${source.row}`).join(', ')}</p></div>
              <dl>{Object.entries(row.metrics).map(([key, value]) =>
                <div key={key}><dt>{key}</dt><dd>{format(value, Number.isInteger(value) ? 0 : 2)}</dd></div>)}</dl>
            </div>
          </td></tr>}
        </React.Fragment>;
      })}
    </Table> : <p className="empty">No match records in this view.</p>}
    <Pagination page={page} count={rows.length} setPage={next => { setPage(next); setSelected(null); }} />

  </section>;
}

function Profile({ data, event, mode, scope, entries, ratings }) {
  const { id } = useParams();
  const player = data.players.find(item => item.id === id);
  if (!player) return <section className="hero"><h1>Player not found</h1><Link to={`/${scope}`}>Browse players</Link></section>;
  const records = selectRecords(player, event, mode);
  const rating = ratings.find(item => item.id === player.id);
  return <ProfileReport player={player} records={records} data={data} rating={rating} scope={scope}>
    <Records key={`${id}/${event}/${mode}`} records={records} data={data} />
  </ProfileReport>;
}

function Compare({ data, scope, event, mode, entries, ratings, params, change }) {
  const [query, setQuery] = useState('');
  const players = entries.map(entry => [entry.player.id, entry.player.name]);
  const a = data.players.find(player => player.id === params.get('a'));
  const b = data.players.find(player => player.id === params.get('b'));
  const items = players.filter(([, name]) => name.toLowerCase().includes(query.trim().toLowerCase()));
  const options = selected => selected && !items.some(([id]) => id === selected.id)
    ? [[selected.id, selected.name], ...items] : items;
  const sides = [a, b].map(player => player && selectRecords(player, event, mode).maps);
  return <>
    <header className="hero"><p className="eyebrow">PLAYER COMPARISON</p><h1>Head to <em>Head</em></h1>
      <p>Compare recorded map performance under the same event and mode filters.</p></header>
    <div className="filters">
      <label>Filter player options<input type="search" value={query} placeholder="Search players" onChange={e => setQuery(e.target.value)} /></label>
      <Select label="First player" value={a?.id || ''} onChange={id => change({ a: id })} items={options(a)} empty="Choose a player" />
      <Select label="Second player" value={b?.id || ''} onChange={id => change({ b: id })} items={options(b)} empty="Choose a player" />
    </div>
    {a && b ? <ComparisonReport a={a} b={b} sides={sides} data={data} scope={scope} ratings={ratings} event={event} mode={mode} />
      : <p className="empty">Select two players to see their stats side by side.</p>}
  </>;
}

function Report({ data, theme, setTheme }) {
  const [params, setParams] = useSearchParams();
  const [participation, setParticipation] = useState(null);
  const { pathname } = useLocation();
  const event = data.events.find(item => item.id === params.get('event'))?.id || '';
  const mode = Object.hasOwn(data.modes, params.get('mode')) ? params.get('mode') : '';
  const scopeParams = new URLSearchParams();
  if (event) scopeParams.set('event', event);
  if (mode) scopeParams.set('mode', mode);
  const scope = scopeParams.size ? `?${scopeParams}` : '';
  const change = changes => {
    if (Object.hasOwn(changes, 'event')) setParticipation(null);
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next);
  };
  const entries = useMemo(() => data.players.map(player => {
    const records = selectRecords(player, event, mode);
    return { player, records, stats: summarize(records.maps) };
  }).filter(entry => entry.records.maps.length || entry.records.series.length), [data, event, mode]);
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  const criteria = participation ?? Object.fromEntries(data.events.map(item => [item.id, event ? 'any' : 'played']));
  const ratings = useMemo(() => ratePlayers(entries.filter(entry => matchesParticipation(entry.player, data.events, criteria))), [entries, data.events, criteria]);
  const props = { data, scope, event, mode, entries, ratings, criteria };
  return <div className="app-frame">
    <aside className="sidebar">
      <Link className="brand" to={`/${scope}`}><img src={`${BASE}logo.png`} alt="" /><span>PLAYER REPORT<small>MW4 COMPETITIVE</small></span></Link>
      <p className="sidebar-label">EXPLORE</p>
      <nav aria-label="Main navigation">
        <NavLink end to={`/${scope}`} className={pathname.startsWith('/players/') ? 'active' : undefined}><svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5.5a3 3 0 0 1 0 5.5M17 14a5 5 0 0 1 4 5v1" /></svg> Players</NavLink>
        <NavLink to={`/tiers${scope}`}><svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 3 15 9l6.5.9-4.7 4.6 1.1 6.5-5.9-3.1-5.9 3.1 1.1-6.5L2.5 9.9 9 9z" /></svg> Tiers</NavLink>
        <NavLink to={`/explore${scope}`}><svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 20V4M4 20h17M8 16v-4M13 16V7M18 16v-7" /></svg> Charts</NavLink>
        <NavLink to={`/compare${scope}`}><svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 8h17M16 4l4 4-4 4M21 16H4M8 12l-4 4 4 4" /></svg> Compare</NavLink>
        <NavLink to={`/bush-report${scope}`}><svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 3h10l4 4v14H5zM15 3v5h4M8 12h8M8 16h8" /></svg> BushAi Report</NavLink>
      </nav>
      <div className="sidebar-bottom"><span>PLAYER DATA</span><strong>{data.players.length} profiles</strong><small>{data.events.length} events recorded</small></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="top-inner"><div className="top-location">MW4 <span>/</span> <strong>{pathname.startsWith('/players/') ? 'Player profile' : pathname.startsWith('/tiers') ? 'Tiers' : pathname.startsWith('/explore') ? 'Charts' : pathname.startsWith('/compare') ? 'Compare' : pathname.startsWith('/bush-report') ? 'BushAi Report' : 'Players'}</strong></div><button className="theme-toggle" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</button></div></header>
    <main>
      <div className="scope-bar"><span className="scope-label">DATASET</span><Filters data={data} event={event} mode={mode} change={change} /></div>
      <section className="participation-filter" aria-labelledby="participation-label">
        <div><strong id="participation-label">Required events</strong><p>Players must have participated in every selected event. Playing in other events is fine.</p></div>
        <div className="participation-options">{eventOrder(data.events).map(item => <label key={item.id}><input type="checkbox" checked={criteria[item.id] === 'played'}
          onChange={e => setParticipation({ ...criteria, [item.id]: e.target.checked ? 'played' : 'any' })} /> <span>{item.name}</span></label>)}</div>
        <p className="participation-hint">The event selector above controls which stats are scored. Changing it resets these selections.</p>
      </section>
      <Routes>
        <Route path="/" element={<Directory key={scope} {...props} />} />
        <Route path="/players/:id" element={<Profile {...props} />} />
        <Route path="/tiers" element={<Tiers {...props} />} />
        <Route path="/explore" element={<Explore {...props} />} />
        <Route path="/compare" element={<Compare {...props} params={params} change={change} />} />
        <Route path="/bush-report" element={<BushReport {...props} />} />
        <Route path="*" element={<section className="hero"><h1>Page not found</h1><Link to={`/${scope}`}>Browse players</Link></section>} />
      </Routes>
      <footer>
        <details><summary>Data coverage and calculations</summary>
          <p>Profiles require recorded map or series stats. Series coverage uses the workbook’s series code and team pairing within each event. Team and opponent labels are included with the match log.</p>
          <p>Selected participation requirements determine which players are eligible for ratings; playing in additional events is allowed. Percentiles and tiers are calculated within that field. All-events rankings default to players with recorded participation in every event; individual events default to any participation. The player board and profiles remain available for all players.</p>
          <p>Ratings compare eligible players within each mode for the selected event and mode filters. K/D contributes 40%, kills per map 30% and damage per map 30%. A measure needs three recorded maps and a mode needs two measures. Missing measures are omitted and weights rescaled. Qualifying modes count equally even when their sample sizes differ. The score does not adjust for sample size, and players may have different mode coverage.</p>
          <p>Map K/D divides total kills by total deaths across maps with both values. Per-map averages use maps with that metric recorded. All-mode averages combine maps of different lengths and rules. A dash indicates an unavailable value.</p>
          <ul>{data.events.map(item => <li key={item.id}>{item.source} · {item.mapRows} player-map rows · {item.seriesRows} player-series rows</li>)}</ul>
        </details>
        <p className="data-credit">Data by <a href="https://x.com/ChallengerStats" target="_blank" rel="noopener noreferrer">@ChallengerStats</a></p>
      </footer>
    </main>
    </div>
  </div>;
}

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('player-report-theme') === 'light' ? 'light' : 'dark'; }
    catch { return 'dark'; }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('player-report-theme', theme); } catch {}
  }, [theme]);
  useEffect(() => {
    fetch(`${BASE}data/player-report.json`).then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }).then(setData).catch(() => setError(true));
  }, []);
  if (error) return <main className="empty" role="alert">The player dataset could not be loaded. Try reloading the page.</main>;
  return data ? <Report data={data} theme={theme} setTheme={setTheme} /> : <main className="empty" role="status">Loading player report…</main>;
}

createRoot(document.getElementById('root')).render(<HashRouter><App /></HashRouter>);
