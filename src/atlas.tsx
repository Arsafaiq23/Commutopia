import { useMemo, useRef, useState, type CSSProperties, type PointerEvent, type WheelEvent } from 'react'
import { atlasLayout } from './atlas-layout'
import { createRoutePractice, filterMatchesLine, hubFor, linesForStation, practiceDestinations, transitGraph, transfersForStation, type AtlasFilter, type AtlasLine, type AtlasStation, type RoutePracticeScenario } from './transit-graph'
import { TransitMentorCard } from './mentor'

type Selection = { type: 'station'; id: string } | { type: 'line'; id: string } | { type: 'hub'; id: string } | null
type LineSort = 'default' | 'name' | 'stops'
const filters: Array<{ id: AtlasFilter; label: string }> = [
  { id: 'ALL', label: 'All' }, { id: 'KRL', label: 'KRL' }, { id: 'MRT', label: 'MRT Jakarta' }, { id: 'LRT_JABODEBEK', label: 'LRT Jabodebek' }, { id: 'LRT_JAKARTA', label: 'LRT Jakarta' }, { id: 'TRANSJAKARTA', label: 'TransJakarta' }, { id: 'AIRPORT_RAIL', label: 'Airport Rail' }, { id: 'HUBS', label: 'Transfer Hubs' },
]
const lineLabel = (line: AtlasLine) => line.name.replace('North-South', 'North–South').replace('TransJakarta Koridor ', 'TJ ')
const stationLabel = (station: AtlasStation) => station.name
const isRail = (line: AtlasLine) => line.mode !== 'TRANSJAKARTA'
const pointDistance = (a: PointLike, b: PointLike) => Math.hypot(a.x - b.x, a.y - b.y)
const lineGroups = [
  { id: 'KRL', label: 'KRL', matches: (line: AtlasLine) => line.mode === 'KRL' && line.id !== 'KRL_AIRPORT' },
  { id: 'MRT', label: 'MRT Jakarta', matches: (line: AtlasLine) => line.mode === 'MRT' },
  { id: 'LRT', label: 'LRT', matches: (line: AtlasLine) => line.mode === 'LRT_JABODEBEK' || line.mode === 'LRT_JAKARTA' },
  { id: 'TRANSJAKARTA', label: 'TransJakarta', matches: (line: AtlasLine) => line.mode === 'TRANSJAKARTA' },
  { id: 'AIRPORT_RAIL', label: 'Airport Rail', matches: (line: AtlasLine) => line.id === 'KRL_AIRPORT' },
] as const

export function Atlas({ onOpenPractice, onLearnStation }: { onOpenPractice: (scenario: RoutePracticeScenario) => void; onLearnStation: (stationId: string) => void }) {
  const [filter, setFilter] = useState<AtlasFilter>('ALL')
  const [selection, setSelection] = useState<Selection>(null)
  const [query, setQuery] = useState('')
  const [zoom, setZoom] = useState(.86)
  const [pan, setPan] = useState({ x: 105, y: 65 })
  const [hoveredLineId, setHoveredLineId] = useState<string | null>(null)
  const [hiddenLineIds, setHiddenLineIds] = useState<Set<string>>(() => new Set())
  const [lineMenuOpen, setLineMenuOpen] = useState(false)
  const [lineSort, setLineSort] = useState<LineSort>('default')
  const [practiceStart, setPracticeStart] = useState<{ stationId: string; lineId?: string } | null>(null)
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const selectedStation = selection?.type === 'station' ? transitGraph.stationById.get(selection.id) : undefined
  const selectedLine = selection?.type === 'line' ? transitGraph.lineById.get(selection.id) : undefined
  const selectedHub = selection?.type === 'hub' ? hubFor(selection.id) : undefined
  const isLineHidden = (lineId: string) => hiddenLineIds.has(lineId)
  const visibleLineCount = transitGraph.lines.length - hiddenLineIds.size
  const sortedLines = (lines: AtlasLine[]) => [...lines].sort((a, b) => lineSort === 'name' ? lineLabel(a).localeCompare(lineLabel(b)) : lineSort === 'stops' ? b.stationIds.length - a.stationIds.length || lineLabel(a).localeCompare(lineLabel(b)) : transitGraph.lines.indexOf(a) - transitGraph.lines.indexOf(b))
  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('id'); if (!needle) return []
    return [
      ...transitGraph.stations.map((station) => ({ type: 'station' as const, id: station.id, title: station.name, subtitle: transitGraph.lineById.get(station.serviceId)?.name ?? station.serviceId })),
      ...transitGraph.lines.map((line) => ({ type: 'line' as const, id: line.id, title: line.name, subtitle: `${line.stationIds.length} stations` })),
      ...transitGraph.hubs.map((hub) => ({ type: 'hub' as const, id: hub.id, title: hub.name, subtitle: 'Transfer hub' })),
    ].filter((item) => `${item.title} ${item.subtitle}`.toLocaleLowerCase('id').includes(needle)).sort((a, b) => {
      const priority = (item: { type: 'station' | 'line' | 'hub'; title: string }) => {
        const title = item.title.toLocaleLowerCase('id')
        if (title.startsWith(needle)) return item.type === 'line' ? 0 : 1
        return item.type === 'line' ? 2 : item.type === 'hub' ? 3 : 4
      }
      return priority(a) - priority(b) || a.title.localeCompare(b.title)
    }).slice(0, 8)
  }, [query])
  const center = (target: PointLike) => setPan({ x: atlasLayout.width / 2 - target.x * zoom, y: atlasLayout.height / 2 - target.y * zoom })
  const select = (next: NonNullable<Selection>) => {
    setSelection(next); setQuery('')
    if (next.type === 'station') center(atlasLayout.stationPoints[next.id])
    if (next.type === 'line') { const points = atlasLayout.linePoints[next.id]; if (points?.length) center(points[Math.floor(points.length / 2)]) }
    if (next.type === 'hub') center(atlasLayout.hubPoints[next.id])
  }
  const selectLine = (lineId: string) => { setHiddenLineIds((current) => { const next = new Set(current); next.delete(lineId); return next }); select({ type: 'line', id: lineId }) }
  const toggleLine = (lineId: string) => setHiddenLineIds((current) => { const next = new Set(current); if (next.has(lineId)) next.delete(lineId); else next.add(lineId); return next })
  const setGroupVisibility = (groupId: string, visible: boolean) => setHiddenLineIds((current) => {
    const group = lineGroups.find((item) => item.id === groupId); if (!group) return current
    const next = new Set(current); transitGraph.lines.filter(group.matches).forEach((line) => visible ? next.delete(line.id) : next.add(line.id)); return next
  })
  const reset = () => { setZoom(.86); setPan({ x: 105, y: 65 }); setSelection(null); setHoveredLineId(null); setHiddenLineIds(new Set()) }
  const pointerDown = (event: PointerEvent<SVGSVGElement>) => { if ((event.target as Element).closest('[data-atlas-control]')) return; drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y }; event.currentTarget.setPointerCapture(event.pointerId) }
  const pointerMove = (event: PointerEvent<SVGSVGElement>) => { if (!drag.current) return; setPan({ x: drag.current.panX + (event.clientX - drag.current.x), y: drag.current.panY + (event.clientY - drag.current.y) }) }
  const pointerUp = () => { drag.current = null }
  const wheel = (event: WheelEvent<SVGSVGElement>) => { event.preventDefault(); setZoom((value) => Math.max(.45, Math.min(2.25, value - event.deltaY * .001))) }
  const visibleLine = (line: AtlasLine) => filterMatchesLine(filter, line)
  const lineOpacity = (line: AtlasLine) => {
    if (isLineHidden(line.id)) return 0
    if (selection?.type === 'line') return line.id === selection.id ? 1 : .18
    if (selection?.type === 'station') return line.stationIds.includes(selection.id) ? 1 : .18
    if (hoveredLineId) return line.id === hoveredLineId ? 1 : visibleLine(line) ? .36 : .15
    if (filter === 'HUBS') return .14
    if (filter === 'ALL') return isRail(line) ? .92 : .42
    return visibleLine(line) ? 1 : .18
  }
  const visibleLabelIds = useMemo(() => {
    const selectedLineId = selection?.type === 'line' ? selection.id : null
    const candidates = transitGraph.stations.filter((station) => {
      const line = transitGraph.lineById.get(station.serviceId)!; const inFocusedLine = line.id === selectedLineId || line.id === hoveredLineId
      if (isLineHidden(line.id)) return false
      if (selection?.type === 'station' && station.id === selection.id) return true
      if (station.hubId) return false
      if (inFocusedLine) return true
      if (isRail(line) && station.isTerminus && filter === 'ALL') return true
      return zoom >= 1.58
    }).sort((a, b) => {
      const priority = (station: AtlasStation) => station.id === selectedStation?.id ? 4 : station.serviceId === selectedLineId || station.serviceId === hoveredLineId ? 3 : isRail(transitGraph.lineById.get(station.serviceId)!) && station.isTerminus ? 2 : 1
      return priority(b) - priority(a)
    })
    const accepted: AtlasStation[] = []
    for (const station of candidates) {
      const point = atlasLayout.stationPoints[station.id]
      if (station.id === selectedStation?.id || accepted.every((other) => pointDistance(point, atlasLayout.stationPoints[other.id]) > 34)) accepted.push(station)
    }
    return new Set(accepted.map((station) => station.id))
  }, [filter, hiddenLineIds, hoveredLineId, selection, selectedStation?.id, zoom])
  const openPractice = (stationId: string, lineId?: string) => setPracticeStart({ stationId, lineId })
  const launchPractice = (endStationId: string) => { if (!practiceStart) return; const scenario = createRoutePractice(practiceStart.stationId, endStationId, practiceStart.lineId); if (scenario) onOpenPractice(scenario); setPracticeStart(null) }
  return <section className="atlas-page">
    <header className="atlas-header">
      <div><span className="eyebrow">INTERACTIVE TRANSIT ATLAS</span><h1>Jabodetabek, <em>connected.</em></h1><p>Explore the network as a living schematic—not a static map.</p></div>
      <div className="atlas-stats"><b>{transitGraph.lines.length}<small>lines</small></b><b>{transitGraph.stations.length}<small>nodes</small></b><b>{transitGraph.hubs.length}<small>hubs</small></b></div>
    </header>
    <div className="atlas-toolbar" data-atlas-control>
      <label className="atlas-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search station or route" aria-label="Search Atlas" />{query && <button onClick={() => setQuery('')} aria-label="Clear search">×</button>}</label>
      {results.length > 0 && <div className="atlas-results">{results.map((result) => <button key={`${result.type}-${result.id}`} onClick={() => select(result)}><b>{result.title}</b><small>{result.subtitle}</small></button>)}</div>}
      <div className="atlas-controls"><button onClick={() => setZoom((value) => Math.min(2.25, value + .18))} aria-label="Zoom in">＋</button><button onClick={() => setZoom((value) => Math.max(.45, value - .18))} aria-label="Zoom out">−</button><button onClick={reset} aria-label="Reset atlas">↺</button></div>
    </div>
    <div className="atlas-filter-row" role="tablist">{filters.map((item) => <button key={item.id} role="tab" aria-selected={filter === item.id} className={filter === item.id ? 'active' : ''} onClick={() => { setFilter(item.id); if (item.id === 'HUBS') setSelection(null) }}>{item.label}</button>)}</div>
    <section className="atlas-line-manager" data-atlas-control>
      <button className="atlas-line-manager-trigger" aria-expanded={lineMenuOpen} aria-controls="atlas-line-manager-panel" onClick={() => setLineMenuOpen((value) => !value)}><span>☷ Line visibility</span><small>{visibleLineCount}/{transitGraph.lines.length} visible</small><b>{lineMenuOpen ? '−' : '+'}</b></button>
      {lineMenuOpen && <div className="atlas-line-manager-panel" id="atlas-line-manager-panel" role="dialog" aria-label="Manage transit lines">
        <header><div><span className="eyebrow">LINE MANAGER</span><b>Show, hide, or open a route</b></div><label>Sort<select value={lineSort} onChange={(event) => setLineSort(event.target.value as LineSort)} aria-label="Sort transit lines"><option value="default">Map order</option><option value="name">A–Z</option><option value="stops">Most stops</option></select></label></header>
        <div className="atlas-line-groups">{lineGroups.map((group) => { const lines = sortedLines(transitGraph.lines.filter(group.matches)); const allVisible = lines.every((line) => !isLineHidden(line.id)); return <section key={group.id} className="atlas-line-group"><header><b>{group.label}</b><button onClick={() => setGroupVisibility(group.id, !allVisible)}>{allVisible ? 'Hide all' : 'Show all'}</button></header>{lines.map((line) => <div key={line.id} className={`atlas-line-row ${selectedLine?.id === line.id ? 'selected' : ''} ${isLineHidden(line.id) ? 'hidden' : ''}`}><button className="atlas-line-row-main" onClick={() => { selectLine(line.id); setLineMenuOpen(false) }}><i style={{ background: line.color }}/><span><b>{lineLabel(line)}</b><small>{line.stationIds.length} stops</small></span></button><button className="atlas-line-visibility" aria-label={`${isLineHidden(line.id) ? 'Show' : 'Hide'} ${lineLabel(line)}`} aria-pressed={!isLineHidden(line.id)} onClick={() => { if (selectedLine?.id === line.id && !isLineHidden(line.id)) setSelection(null); toggleLine(line.id) }}>{isLineHidden(line.id) ? '◌' : '◉'}</button></div>)}</section> })}</div>
      </div>}
    </section>
    <div className="atlas-workspace">
      <div className="atlas-canvas-wrap"><svg className="atlas-canvas" viewBox={`0 0 ${atlasLayout.width} ${atlasLayout.height}`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onWheel={wheel} role="img" aria-label="Interactive schematic map of Jabodetabek public transit">
        <defs><filter id="atlasGlow"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          <rect x="-800" y="-800" width="3100" height="2700" className="atlas-backdrop" />
          {transitGraph.lines.map((line) => { const path = atlasLayout.linePaths[line.id]; const selected = selection?.type === 'line' && selection.id === line.id; const hovered = hoveredLineId === line.id; const labelPoint = atlasLayout.linePoints[line.id][Math.floor(atlasLayout.linePoints[line.id].length / 2)]; const hidden = isLineHidden(line.id); return <g key={line.id} className={`atlas-route ${line.mode === 'TRANSJAKARTA' ? 'brt' : 'rail'} ${selected ? 'selected' : ''} ${hovered ? 'hovered' : ''}`} style={{ opacity: lineOpacity(line), pointerEvents: hidden ? 'none' : undefined }}><path d={path} className="atlas-line-hit" onPointerEnter={() => setHoveredLineId(line.id)} onPointerLeave={() => setHoveredLineId((value) => value === line.id ? null : value)} onClick={(event) => { event.stopPropagation(); selectLine(line.id) }} /><path d={path} className="atlas-line-glow" style={{ stroke: line.color }} /><path d={path} className="atlas-line" style={{ stroke: line.color }} />{(selected || hovered) && <text className="atlas-route-label" x={labelPoint.x + 12} y={labelPoint.y - 14}>{lineLabel(line)}</text>}</g> })}
          {transitGraph.hubs.map((hub) => { const point = atlasLayout.hubPoints[hub.id]; const active = filter === 'HUBS' || selection?.type === 'hub' && selection.id === hub.id || selection?.type === 'station' && transitGraph.stationById.get(selection.id)?.hubId === hub.id; return <g className={`atlas-hub visible ${active ? 'active' : ''}`} key={hub.id} onClick={(event) => { event.stopPropagation(); select({ type: 'hub', id: hub.id }) }} tabIndex={0} role="button" aria-label={`${hub.name} transfer hub`} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') select({ type: 'hub', id: hub.id }) }}><circle cx={point.x} cy={point.y} r="16"/><circle cx={point.x} cy={point.y} r="9" filter={active ? 'url(#atlasGlow)' : undefined}/><text x={point.x} y={point.y - 22}>{hub.name.replace('Kota (Jakarta Kota)', 'Jakarta Kota')}</text></g> })}
          {transitGraph.stations.map((station) => { const point = atlasLayout.stationPoints[station.id]; const line = transitGraph.lineById.get(station.serviceId)!; const active = selection?.type === 'station' && selection.id === station.id; const showLabel = visibleLabelIds.has(station.id); const labelShift = station.sequence % 2 ? 10 : -10; const hidden = isLineHidden(line.id); return <g key={station.id} className={`atlas-station ${active ? 'selected' : ''} ${station.hubId ? 'at-hub' : ''}`} style={{ opacity: hidden ? 0 : filter === 'HUBS' && station.hubId ? .96 : lineOpacity(line), pointerEvents: hidden ? 'none' : undefined }} onClick={(event) => { event.stopPropagation(); select({ type: 'station', id: station.id }) }} tabIndex={hidden ? -1 : 0} role="button" aria-label={`${station.name}, ${line.name}`} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') select({ type: 'station', id: station.id }) }}><circle cx={point.x} cy={point.y} r={station.hubId ? 4.8 : 3.25} style={{ stroke: line.color }} />{showLabel && <text x={point.x + labelShift} y={point.y - 8} textAnchor={labelShift > 0 ? 'start' : 'end'}>{station.name}</text>}</g> })}
        </g>
      </svg><p className="atlas-gesture-hint">Scroll/pinch to zoom · drag to pan · tap a station or route</p></div>
      <aside className={`atlas-inspector ${selection ? 'has-selection' : 'is-empty'}`}>{selectedStation && <StationPanel station={selectedStation} onPractice={() => openPractice(selectedStation.id)} onLearn={() => onLearnStation(selectedStation.id)} />}{selectedLine && <LinePanel line={selectedLine} onPractice={() => openPractice(selectedLine.stationIds[0], selectedLine.id)} />}{selectedHub && <HubPanel hubId={selectedHub.id} />}{!selection && <AtlasWelcome />}</aside>
    </div>
    {selectedLine && <LineStopDirectory line={selectedLine} onOpenStop={onLearnStation}/>} 
    {practiceStart && <PracticePicker start={transitGraph.stationById.get(practiceStart.stationId)!} lineId={practiceStart.lineId} onChoose={launchPractice} onClose={() => setPracticeStart(null)} />}
  </section>
}

type PointLike = { x: number; y: number }
function AtlasWelcome() { return <div className="atlas-empty"><span>✦</span><h2>Pick a connection.</h2><p>Click any line, station, or glowing transfer hub to inspect the network.</p><small>All transit facts are sourced from the supplied dataset.</small></div> }
function LineStopDirectory({ line, onOpenStop }: { line: AtlasLine; onOpenStop: (stationId: string) => void }) { return <section className="atlas-stop-directory" aria-label={`${lineLabel(line)} stop directory`}><header><div><span className="eyebrow">STOP DIRECTORY</span><h2>{lineLabel(line)}</h2><p>Tap a stop to open its verified entry in Explore.</p></div><span className="atlas-directory-count" style={{ '--route': line.color } as CSSProperties}>{line.stationIds.length} stops</span></header><div className="atlas-stop-directory-list">{line.stationIds.map((id, index) => { const station = transitGraph.stationById.get(id)!; return <button key={id} onClick={() => onOpenStop(id)}><i style={{ background: line.color }}/><span><small>STOP {String(index + 1).padStart(2, '0')} · {station.code}</small><b>{station.name}</b></span>{station.hubId && <em>Transfer</em>}<strong>›</strong></button> })}</div></section> }
function StationPanel({ station, onPractice, onLearn }: { station: AtlasStation; onPractice: () => void; onLearn: () => void }) { const line = transitGraph.lineById.get(station.serviceId)!; const hub = station.hubId ? hubFor(station.hubId) : undefined; const connected = hub ? hub.stationIds.map((id) => transitGraph.stationById.get(id)!).map((item) => transitGraph.lineById.get(item.serviceId)!).filter((item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index) : linesForStation(station.id); const insight = hub ? hub.note : `${station.name} is stop ${station.sequence + 1} of ${line.stationIds.length} on ${line.name}. Reading the line order here builds direction intuition.`; return <div className="atlas-panel"><span className="panel-kicker" style={{ color: line.color }}>STATION · {station.code}</span><h2>{stationLabel(station)}</h2><p className="atlas-panel-route">{lineLabel(line)}</p><section><b>Connected lines</b><div className="atlas-chip-list">{connected.map((item) => <span key={item.id} style={{ '--chip': item.color } as CSSProperties}><i />{lineLabel(item)}</span>)}</div></section><section><b>Transfer availability</b><p>{hub ? `${hub.name} is a designated transfer hub. ${transfersForStation(station.id).length ? 'Direct graph links are available here.' : 'The source identifies the hub; no exact stop-to-stop transfer edge is inferred.'}` : 'No major transfer membership is supplied for this station.'}</p></section><section className="commu-insight"><span>✦ COMMU INSIGHT</span><p>{insight}</p></section><TransitMentorCard compact request={{ purpose: 'station', title: station.name, facts: [insight, `${station.name} adalah stop ${station.sequence + 1} dari ${line.stationIds.length} di ${line.name}.`, ...connected.map((item) => `Layanan terkait: ${item.name}.`)], allowedPractice: ['Buka PipeMap layanan ini dan ikuti satu arah sampai terminus.'] }}/><button className="primary" onClick={onPractice}>Practice From Here <b>→</b></button><button className="secondary" onClick={onLearn}>Learn This Station →</button></div> }
function LinePanel({ line, onPractice }: { line: AtlasLine; onPractice: () => void }) { const transfers = line.stationIds.map((id) => transitGraph.stationById.get(id)!).filter((station) => station.hubId); return <div className="atlas-panel"><span className="panel-kicker" style={{ color: line.color }}>ROUTE</span><h2>{lineLabel(line)}</h2><div className="line-color"><i style={{ background: line.color }} />{line.color}</div><section className="atlas-metrics"><span><b>{line.stationIds.length}</b>stations</span><span><b>{transfers.length}</b>hub stops</span></section><section><b>Transfer stations</b><p>{transfers.length ? [...new Set(transfers.map((station) => station.name))].join(' · ') : 'No major hub membership supplied on this route.'}</p></section>{line.variants.length > 0 && <section><b>Route variants</b><div className="variant-badges">{line.variants.map((variant) => <button key={variant.id} title="Exact variant stop sequence is not in the source dataset"><strong>{variant.id}</strong>{variant.route}</button>)}</div><small>Variant routes are shown without inferred stops or geometry.</small></section>}<button className="primary" onClick={onPractice}>Practice this route <b>→</b></button></div> }
function HubPanel({ hubId }: { hubId: string }) { const hub = hubFor(hubId)!; const lines = hub.stationIds.map((id) => transitGraph.stationById.get(id)!).map((station) => transitGraph.lineById.get(station.serviceId)!).filter((line, index, list) => list.findIndex((item) => item.id === line.id) === index); return <div className="atlas-panel"><span className="panel-kicker">MAJOR TRANSFER HUB</span><h2>{hub.name}</h2><section className="hub-note"><span>✦ WHY IT MATTERS</span><p>{hub.note}</p></section><section><b>Services at this hub</b><div className="atlas-chip-list">{lines.map((line) => <span key={line.id} style={{ '--chip': line.color } as CSSProperties}><i />{lineLabel(line)}</span>)}</div></section><p className="source-note">Source-listed modes: {hub.modes.join(' · ')}</p></div> }
function PracticePicker({ start, lineId, onChoose, onClose }: { start: AtlasStation; lineId?: string; onChoose: (id: string) => void; onClose: () => void }) { const options = practiceDestinations(start.id, lineId); return <div className="practice-overlay" role="dialog" aria-modal="true" aria-label="Choose a practice destination"><section><button className="practice-close" onClick={onClose} aria-label="Close">×</button><span className="eyebrow">CHAIN REACTION · ATLAS PRACTICE</span><h2>Where from {start.name}?</h2><p>Choose a reachable hub or terminus. The shared transit graph will build your challenge.</p><div className="practice-options">{options.map(({ station, path }) => <button key={station.id} onClick={() => onChoose(station.id)}><span>{station.name}</span><small>{path.length - 1} hops · {transitGraph.lineById.get(station.serviceId)?.name}</small><b>→</b></button>)}</div></section></div> }

export function AtlasRoutePractice({ scenario, onBack }: { scenario: RoutePracticeScenario; onBack: () => void }) { const [step, setStep] = useState(0); const [feedback, setFeedback] = useState(''); const current = transitGraph.stationById.get(scenario.stationIds[step])!; const expected = transitGraph.stationById.get(scenario.stationIds[step + 1]); const finished = step === scenario.stationIds.length - 1; const options = useMemo(() => {
  if (!expected) return []; const nearby = (transitGraph.neighbors.get(current.id) ?? []).map((edge) => transitGraph.stationById.get(edge.to)!).filter(Boolean); return [...new Map([...nearby, expected].map((station) => [station.id, station])).values()].slice(0, 5)
}, [current.id, expected])
  const choose = (stationId: string) => { if (stationId === expected?.id) { setStep((value) => value + 1); setFeedback('Connected! Follow the line one stop at a time.') } else setFeedback('That connection does not follow this planned route. Try the highlighted graph path.') }
  const start = transitGraph.stationById.get(scenario.startStationId)!; const end = transitGraph.stationById.get(scenario.endStationId)!
  return <section className="atlas-practice"><button className="back-detail" onClick={onBack}>← Back to Atlas</button><span className="eyebrow">CHAIN REACTION · GENERATED ROUTE</span><h1>{start.name} <em>→</em> {end.name}</h1><p>{scenario.lineIds.length} line{scenario.lineIds.length === 1 ? '' : 's'} · {scenario.transfers} transfer{scenario.transfers === 1 ? '' : 's'} · {scenario.stationIds.length - 1} hops</p><div className="practice-route">{scenario.stationIds.map((id, index) => <span className={index <= step ? 'done' : ''} key={id}>{transitGraph.stationById.get(id)?.name}</span>)}</div>{finished ? <article className="practice-complete"><span>✦</span><h2>Route connected!</h2><p>You reached {end.name} by reading the shared transit graph.</p><button className="primary" onClick={onBack}>Return to Atlas →</button></article> : <article className="practice-next"><span className="eyebrow">CURRENT STATION</span><h2>{current.name}</h2><p>Choose the next stop toward {end.name}.</p><div>{options.map((station) => <button key={station.id} onClick={() => choose(station.id)}><i />{station.name}<b>→</b></button>)}</div>{feedback && <small role="status">{feedback}</small>}</article>}</section> }
