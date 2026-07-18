import { useEffect, useMemo, useState } from 'react'
import type { Challenge } from './domain'
import { chainScenarioById, chainScenarios, legsForDecision, lineTone, type ChainLeg, type ChainRunSummary, type ChainScenario } from './chain-engine'
import type { Profile } from './storage'
import { transitGraph } from './transit-graph'

type Phase = 'start' | 'choice' | 'growing' | 'hub' | 'soft' | 'hard' | 'timeout' | 'result' | 'mentor'

const toneIcon = (serviceId: string) => {
  const tone = lineTone(serviceId)
  return tone === 'mrt' ? '▰' : tone === 'lrt' ? '▤' : tone === 'tj' ? '▣' : tone === 'airport' ? '✈' : '▰'
}

const sound = (cue: 'move' | 'combo' | 'soft' | 'break' | 'hub' | 'complete', enabled: boolean) => {
  if (!enabled) return
  const Audio = window.AudioContext || (window as Window & { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext
  if (!Audio) return
  const values = { move: [480, .07], combo: [760, .1], soft: [270, .11], break: [145, .15], hub: [900, .16], complete: [680, .18] } as const
  const [frequency, duration] = values[cue]
  const context = new Audio(); const oscillator = context.createOscillator(); const gain = context.createGain()
  oscillator.frequency.value = frequency; oscillator.type = cue === 'break' ? 'sawtooth' : 'sine'; gain.gain.value = .04
  oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + duration)
}

function Commu({ compact = false }: { compact?: boolean }) {
  return <div className={`cr-commu ${compact ? 'compact' : ''}`} aria-label="Commu, mentor transit" role="img"><i>C</i><b>◉⌣</b></div>
}

function ChainHeader({ profile, step, total, seconds, relaxed, score, combo, onBack }: { profile: Profile; step?: number; total?: number; seconds?: number; relaxed?: boolean; score?: number; combo?: number; onBack: () => void }) {
  return <header className="cr-header">
    <button className="cr-round-button" onClick={onBack} aria-label="Kembali ke Belajar">←</button>
    {step && total ? <b>LANGKAH {step} DARI {total}</b> : <b>CHAIN REACTION</b>}
    <span className="cr-xp">✦ {profile.xp} XP</span>
    {seconds !== undefined && <span className={`cr-timer ${seconds <= 2 ? 'urgent' : ''}`}>{relaxed ? '∞ SANTAI' : `◷ 0:${String(seconds).padStart(2, '0')}`}</span>}
    {score !== undefined && <small>Combo ×{Math.max(1, combo ?? 0)} · {score} skor</small>}
  </header>
}

const pointFor = (index: number) => {
  const perRow = 5; const row = Math.floor(index / perRow); const col = index % perRow
  return { x: row % 2 === 0 ? 32 + col * 71 : 316 - col * 71, y: 43 + row * 58 }
}

function ChainPipeMap({ scenario, path, currentStationId, movingLeg, failedLeg, interactiveLegs = [] }: { scenario: ChainScenario; path: string[]; currentStationId: string; movingLeg?: ChainLeg; failedLeg?: ChainLeg; interactiveLegs?: ChainLeg[] }) {
  const nodes = useMemo(() => {
    const ids = [...scenario.stationIds]
    scenario.decisions.flatMap((decision) => decision.options).forEach((leg) => leg.stationIds.forEach((id) => { if (!ids.includes(id)) ids.push(id) }))
    return ids
  }, [scenario])
  const position = (id: string) => pointFor(Math.max(0, nodes.indexOf(id)))
  const station = (id: string) => transitGraph.stationById.get(id)
  const pathSegments = (ids: string[]) => ids.slice(1).map((to, index) => ({ from: ids[index], to, edge: (transitGraph.neighbors.get(ids[index]) ?? []).find((edge) => edge.to === to) }))
  const allLegs = scenario.decisions.flatMap((decision) => decision.options)
  const taken = pathSegments(path)
  const future = movingLeg ? pathSegments(movingLeg.stationIds) : []
  const failed = failedLeg ? pathSegments(failedLeg.stationIds) : []
  const labelVisible = (id: string) => id === scenario.startStationId || id === scenario.endStationId || id === currentStationId || interactiveLegs.some((leg) => leg.toStationId === id) || Boolean(station(id)?.hubId)
  return <div className="cr-map-wrap">
    <svg className="cr-map" viewBox="0 0 350 286" role="img" aria-label="Peta skematik rute Chain Reaction">
      <defs><filter id="cr-glow"><feGaussianBlur stdDeviation="2.4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      {allLegs.flatMap((leg) => pathSegments(leg.stationIds).map(({ from, to, edge }) => {
        const a = position(from); const b = position(to); const color = edge?.serviceId ? transitGraph.lineById.get(edge.serviceId)?.color : '#7658de'
        return <path key={`base-${leg.id}-${from}-${to}`} d={`M ${a.x} ${a.y} L ${b.x} ${b.y}`} className="cr-map-base" stroke={color}/>
      }))}
      {taken.map(({ from, to, edge }) => { const a = position(from); const b = position(to); return <path key={`taken-${from}-${to}`} d={`M ${a.x} ${a.y} L ${b.x} ${b.y}`} className="cr-map-taken" stroke={edge?.serviceId ? transitGraph.lineById.get(edge.serviceId)?.color : '#7a45e7'}/> })}
      {future.map(({ from, to, edge }) => { const a = position(from); const b = position(to); return <path key={`moving-${from}-${to}`} d={`M ${a.x} ${a.y} L ${b.x} ${b.y}`} className="cr-map-moving" stroke={edge?.serviceId ? transitGraph.lineById.get(edge.serviceId)?.color : '#7a45e7'}/> })}
      {failed.map(({ from, to }) => { const a = position(from); const b = position(to); return <path key={`failed-${from}-${to}`} d={`M ${a.x} ${a.y} L ${b.x} ${b.y}`} className="cr-map-failed"/> })}
      {nodes.map((id) => { const p = position(id); const item = station(id); const isCurrent = id === currentStationId; const isTarget = id === scenario.endStationId; const isCandidate = interactiveLegs.some((leg) => leg.toStationId === id); const label = item?.name ?? id
        return <g key={id} className={isCurrent ? 'current' : isTarget ? 'target' : isCandidate ? 'candidate' : ''}><circle cx={p.x} cy={p.y} r={isCurrent || isTarget ? 9 : 5.5}/>{(labelVisible(id)) && <text x={p.x} y={p.y - 13}>{label.replace(' Bank Jakarta', '').replace(' Terminal 2/3', '')}</text>}</g>
      })}
      {movingLeg && <g className="cr-train" filter="url(#cr-glow)"><rect x={position(movingLeg.fromStationId).x - 10} y={position(movingLeg.fromStationId).y - 8} width="20" height="16" rx="4"/><circle cx={position(movingLeg.fromStationId).x - 5} cy={position(movingLeg.fromStationId).y + 9} r="2.5"/><circle cx={position(movingLeg.fromStationId).x + 5} cy={position(movingLeg.fromStationId).y + 9} r="2.5"/></g>}
    </svg>
    <span className="cr-map-caption">Peta skematik · urutan layanan, bukan peta jalan</span>
  </div>
}

function MissionSelector({ profile, scenario, setScenario, relaxed, setRelaxed, onStart, onBack }: { profile: Profile; scenario: ChainScenario; setScenario: (scenario: ChainScenario) => void; relaxed: boolean; setRelaxed: (value: boolean) => void; onStart: () => void; onBack: () => void }) {
  const scenarioIndex = Math.max(0, chainScenarios.findIndex((item) => item.id === scenario.id))
  const chooseOffset = (offset: number) => setScenario(chainScenarios[(scenarioIndex + offset + chainScenarios.length) % chainScenarios.length])
  return <section className="cr-shell cr-start cr-start-compact">
    <ChainHeader profile={profile} onBack={onBack}/>
    <div className="cr-start-hero compact"><Commu compact/><div><span>Bangun rute</span><b>terbaikmu.</b></div></div>
    <div className="cr-selector-title"><span>MISI {scenarioIndex + 1} / {chainScenarios.length}</span><small>Geser pilihan</small></div>
    <div className="cr-mission-switcher"><button onClick={() => chooseOffset(-1)} aria-label="Misi sebelumnya">←</button><article><span>{scenario.difficulty.toUpperCase()} · {scenario.transferCount} TRANSFER</span><strong>{scenario.title}</strong><small>{scenario.legs.length} keputusan · {scenario.reward} XP {profile.completedChainScenarioIds.includes(scenario.id) ? '· ✓ selesai' : ''}</small></article><button onClick={() => chooseOffset(1)} aria-label="Misi berikutnya">→</button></div>
    <article className="cr-mission-card cr-mission-card-compact"><span>MISIMU</span><h1>{scenario.startName} <em>→</em> {scenario.endName}</h1><div><b>◷ {scenario.secondsPerStep} dtk</b><b>⌘ {scenario.expectedHops} stop</b><b>▥ {scenario.difficulty}</b></div></article>
    <label className="cr-relaxed"><input type="checkbox" checked={relaxed} onChange={(event) => setRelaxed(event.target.checked)}/> Mode santai <small>tanpa timer</small></label>
    <button className="primary cta" onClick={onStart}>Mulai Challenge <b>→</b></button>
  </section>
}

export function ChainReactionGame({ challenge, profile, initialScenarioId, onBack, onFinish }: { challenge: Challenge; profile: Profile; initialScenarioId?: string; onBack: () => void; onFinish: (challenge: Challenge, ok: boolean, expired?: boolean, summary?: ChainRunSummary) => void }) {
  const initialScenario = chainScenarioById(initialScenarioId ?? '') ?? chainScenarios[0]
  const [scenario, setScenario] = useState(initialScenario)
  const [phase, setPhase] = useState<Phase>('start')
  const [current, setCurrent] = useState(initialScenario.startStationId)
  const [path, setPath] = useState<string[]>([initialScenario.startStationId])
  const [movesTaken, setMovesTaken] = useState(0)
  const [pendingLeg, setPendingLeg] = useState<ChainLeg>()
  const [failedLeg, setFailedLeg] = useState<ChainLeg>()
  const [relaxed, setRelaxed] = useState(false)
  const [seconds, setSeconds] = useState(initialScenario.secondsPerStep)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  const [softMistakes, setSoftMistakes] = useState(0)
  const [hardBreaks, setHardBreaks] = useState(0)
  const [timeouts, setTimeouts] = useState(0)
  const [checkpoint, setCheckpoint] = useState(initialScenario.startStationId)
  const [startedAt, setStartedAt] = useState(0)
  const [turnStartedAt, setTurnStartedAt] = useState(0)
  const [notice, setNotice] = useState('')
  const [rewardedHubs, setRewardedHubs] = useState<string[]>([])

  const options = legsForDecision(scenario, current)
  const total = scenario.legs.length
  const step = Math.min(total, movesTaken + 1)
  const currentStation = transitGraph.stationById.get(current)

  const reset = (next = scenario) => {
    setCurrent(next.startStationId); setPath([next.startStationId]); setMovesTaken(0); setPendingLeg(undefined); setFailedLeg(undefined)
    setSeconds(next.secondsPerStep); setScore(0); setCombo(0); setMaxCombo(0); setSoftMistakes(0); setHardBreaks(0); setTimeouts(0); setCheckpoint(next.startStationId); setNotice('')
    setRewardedHubs([]); const now = Date.now(); setStartedAt(now); setTurnStartedAt(now); setPhase('choice')
  }

  useEffect(() => {
    if (!startedAt || relaxed || phase !== 'choice') return
    if (seconds <= 0) {
      setCombo(0); setTimeouts((value) => value + 1); setNotice('Waktu habis. Kombomu direset, tetapi kamu bisa mencoba keputusan ini lagi.'); setPhase('timeout'); return
    }
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [phase, relaxed, seconds, startedAt])

  useEffect(() => {
    if (phase !== 'growing' || !pendingLeg) return
    const timer = window.setTimeout(() => {
      const target = pendingLeg.toStationId
      const targetStation = transitGraph.stationById.get(target)
      setPath((value) => [...value, ...pendingLeg.stationIds.slice(1)]); setCurrent(target); setPendingLeg(undefined); setMovesTaken((value) => value + 1)
      if (pendingLeg.outcome === 'optimal') { const next = combo + 1; setCombo(next); setMaxCombo((value) => Math.max(value, next)); setScore((value) => value + 100 * next); sound(next > 1 ? 'combo' : 'move', profile.sound) }
      else { setCombo(0); setSoftMistakes((value) => value + 1); setScore((value) => value + 35); setNotice(pendingLeg.message ?? 'Masih bisa sampai, tetapi ada jalur yang lebih efisien.'); sound('soft', profile.sound) }
      const isHub = targetStation?.hubId
      if (isHub) setCheckpoint(target)
      if (target === scenario.endStationId) { sound('complete', profile.sound); setPhase('result'); return }
      if (isHub && !rewardedHubs.includes(isHub)) { setRewardedHubs((value) => [...value, isHub]); setScore((value) => value + 150); setNotice(scenario.hubFacts[isHub] ?? `${targetStation?.name} adalah titik keputusan penting dalam jaringan ini.`); sound('hub', profile.sound); setPhase('hub'); return }
      setSeconds(Math.max(3, scenario.secondsPerStep - (pendingLeg.outcome === 'viable' ? 1 : 0))); setTurnStartedAt(Date.now()); setPhase(pendingLeg.outcome === 'viable' ? 'soft' : 'choice')
    }, 520)
    return () => window.clearTimeout(timer)
  }, [combo, pendingLeg, phase, profile.sound, rewardedHubs, scenario])

  useEffect(() => {
    if (phase !== 'hub' && phase !== 'soft') return
    const timer = window.setTimeout(() => { setSeconds(Math.max(3, scenario.secondsPerStep - (phase === 'soft' ? 1 : 0))); setTurnStartedAt(Date.now()); setPhase('choice') }, phase === 'hub' ? 1500 : 1150)
    return () => window.clearTimeout(timer)
  }, [phase, scenario.secondsPerStep])

  const selectLeg = (leg: ChainLeg) => {
    if (leg.outcome === 'dead_end') { setCombo(0); setHardBreaks((value) => value + 1); setFailedLeg(leg); setNotice(leg.message ?? 'Jalur ini tidak membawa kamu ke tujuan misi.'); sound('break', profile.sound); setPhase('hard'); return }
    setPendingLeg(leg); setNotice(leg.outcome === 'viable' ? leg.message ?? 'Rute ini valid, tetapi tidak paling efisien.' : `Naik ${leg.label}…`); setPhase('growing')
  }

  const retryCheckpoint = () => { setCurrent(checkpoint); setPath((value) => value.slice(0, value.lastIndexOf(checkpoint) + 1)); setFailedLeg(undefined); setSeconds(scenario.secondsPerStep); setTurnStartedAt(Date.now()); setPhase('choice') }
  const retryTimeout = () => { setSeconds(scenario.secondsPerStep); setTurnStartedAt(Date.now()); setPhase('choice') }
  const summary = (): ChainRunSummary => {
    const efficiency = Math.max(0, Math.round((scenario.legs.length / Math.max(scenario.legs.length, movesTaken + hardBreaks)) * 100))
    return { scenarioId: scenario.id, title: scenario.title, difficulty: scenario.difficulty, length: scenario.length, reward: scenario.reward, startName: scenario.startName, endName: scenario.endName, serviceNames: scenario.serviceNames, insight: scenario.insight, totalSteps: scenario.legs.length, score, maxCombo, hops: path.length - 1, softMistakes, hardBreaks, timeouts, efficiency, durationMs: Date.now() - startedAt, efficient: efficiency === 100 }
  }

  if (phase === 'start') return <MissionSelector profile={profile} scenario={scenario} setScenario={(next) => { setScenario(next); setCurrent(next.startStationId); setPath([next.startStationId]); setSeconds(next.secondsPerStep) }} relaxed={relaxed} setRelaxed={setRelaxed} onStart={() => reset()} onBack={onBack}/>
  if (phase === 'hub' && currentStation?.hubId === 'manggarai') return <section className="cr-hub-full"><button className="cr-hub-back" onClick={onBack} aria-label="Kembali">←</button><span>HUB DICAPAI!</span><h1>Manggarai</h1><div className="cr-particles">✦ ✧ ✦ ✧ ✦</div><div className="cr-station-token">⌂</div><b>✦ +150 XP</b><article><strong>Tahukah kamu?</strong><p>{notice}</p><Commu compact/></article><small>Combo ×{Math.max(1, combo)} · lanjut otomatis</small></section>
  if (phase === 'result') { const completed = summary(); return <section className="cr-shell cr-result"><ChainHeader profile={profile} onBack={onBack}/><span className="cr-result-kicker">✦ RUTE TERSAMBUNG</span><h1>Rute hebat!</h1><p>Kamu sampai di tujuan lewat jaringan yang tervalidasi.</p><div className="cr-result-route"><b>{scenario.startName}</b><i>→</i><strong>{scenario.endName}</strong></div><div className="cr-result-time"><b>{Math.max(1, Math.round((Date.now() - startedAt) / 1000))} dtk</b><span>Total waktu</span></div><div className="cr-stat-grid"><span><b>{completed.hops}</b> stop</span><span><b>{scenario.transferCount}</b> transfer</span><span><b>×{maxCombo || 1}</b> combo</span><span><b>{completed.efficiency}%</b> efisien</span></div><ChainPipeMap scenario={scenario} path={path} currentStationId={current}/><div className="cr-actions"><button className="secondary" onClick={() => reset()}>↻ Replay</button><button className="primary" onClick={() => setPhase('mentor')}>Insight mentor →</button></div></section> }
  if (phase === 'mentor') { const completed = summary(); return <section className="cr-shell cr-mentor"><ChainHeader profile={profile} onBack={onBack}/><div className="cr-mentor-hero"><Commu/><span>Kerja bagus! Ini pola yang baru kamu kuasai.</span></div><article><span>INSIGHT COMMU</span><h1>{scenario.id === 'jatinegara-kota' ? 'Manggarai mengubah arah perjalananmu.' : scenario.id === 'dukuh-kota' ? 'Satu hub membuka banyak arah.' : 'Hub dan arah membuka pilihan baru.'}</h1><p>{scenario.insight}</p></article><div className="cr-improved"><span>⌘<b>Rute</b><small>Terbaca</small></span><span>⌂<b>Hub</b><small>{scenario.insightHubId ? 'Naik level' : 'Dipahami'}</small></span><span>◷<b>Efisiensi</b><small>{completed.efficiency}%</small></span></div><button className="primary cta" onClick={() => onFinish(challenge, true, false, completed)}>Kembali ke peta <b>⌂</b></button></section> }

  const instruction = phase === 'growing' ? notice : phase === 'soft' ? 'Masih bisa sampai, tetapi combo direset.' : phase === 'hard' ? 'Jalur ini buntu untuk tujuan misi.' : phase === 'timeout' ? notice : 'Pilih rute berikutnya'
  return <section className={`cr-shell cr-play phase-${phase}`}>
    <ChainHeader profile={profile} step={step} total={total} seconds={seconds} relaxed={relaxed} score={score} combo={combo} onBack={onBack}/>
    <div className="cr-route-pills"><b>{currentStation?.name ?? scenario.startName}<i/></b><span>›››</span><strong>⌖ {scenario.endName}</strong></div>
    <p className={`cr-instruction ${phase === 'soft' ? 'soft' : phase === 'hard' ? 'danger' : ''}`}>{instruction}</p>
    <ChainPipeMap scenario={scenario} path={path} currentStationId={current} movingLeg={pendingLeg} failedLeg={failedLeg} interactiveLegs={options}/>
    {phase === 'hard' ? <article className="cr-feedback hard"><b>↻ Coba jalur lain</b><span>Kembali ke checkpoint terakhir: {transitGraph.stationById.get(checkpoint)?.name}</span><button className="primary" onClick={retryCheckpoint}>Kembali ke checkpoint →</button></article> : phase === 'timeout' ? <article className="cr-feedback"><b>Waktu habis</b><span>Urutan rute tidak berubah. Coba keputusan ini lagi.</span><button className="primary" onClick={retryTimeout}>Coba lagi →</button></article> : phase === 'growing' || phase === 'soft' || phase === 'hub' ? <article className="cr-feedback" role="status"><b>{phase === 'growing' ? 'Kereta sedang bergerak' : phase === 'hub' ? 'Hub ditemukan' : 'Detour tercatat'}</b><span>{notice}</span></article> : <article className="cr-sheet"><span>3–4 RUTE NYATA DARI {currentStation?.name.toUpperCase()}</span><div className="cr-options">{options.map((leg) => <button key={leg.id} className={`cr-option destination ${leg.outcome} ${lineTone(leg.serviceId)}`} onClick={() => selectLeg(leg)}><i>{leg.kind === 'transfer' ? '↺' : toneIcon(leg.serviceId)}</i><span><b>{leg.kind === 'transfer' ? `Transfer ke ${transitGraph.stationById.get(leg.toStationId)?.name}` : `Naik ke ${transitGraph.stationById.get(leg.toStationId)?.name}`}</b><small>{leg.label} · {leg.direction}</small></span><em>→</em></button>)}</div></article>}
  </section>
}
