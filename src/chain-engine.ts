import { hubFor, transitGraph, type AtlasEdge } from './transit-graph'

export type ChainDifficulty = 'Easy' | 'Medium' | 'High'
export type ChainLength = 'standard' | 'long' | 'marathon'
export type ChainOutcome = 'optimal' | 'viable' | 'dead_end'

export interface ChainScenarioDefinition {
  id: string
  title: string
  difficulty: ChainDifficulty
  length: ChainLength
  startStationId: string
  endStationId: string
  secondsPerStep: number
  reward: number
  insightHubId?: string
  insight: string
}

/** One complete, graph-backed movement the player can choose. */
export interface ChainLeg {
  id: string
  kind: 'ride' | 'transfer'
  serviceId: string
  fromStationId: string
  toStationId: string
  stationIds: string[]
  label: string
  direction: string
  outcome: ChainOutcome
  message?: string
}

/** A playable decision point. Every decision deliberately has three or four routes. */
export interface ChainDecision {
  stationId: string
  options: ChainLeg[]
}

export interface ChainScenario extends ChainScenarioDefinition {
  expectedHops: number
  stationIds: string[]
  edges: AtlasEdge[]
  lineIds: string[]
  transferCount: number
  checkpointStationIds: string[]
  startName: string
  endName: string
  serviceNames: string[]
  startNodeId: string
  endNodeId: string
  optimalNodeIds: string[]
  optimalServiceIds: string[]
  checkpointNodeIds: string[]
  hubFacts: Record<string, string>
  mapScope: ChainLength
  /** Optimal route, retained for progress and compatibility surfaces. */
  legs: ChainLeg[]
  /** Non-optimal graph-backed routes, retained for the route map. */
  alternativeLegs: ChainLeg[]
  decisions: ChainDecision[]
}

export interface ChainAction {
  id: string
  kind: 'ride' | 'transfer'
  label: string
  detail: string
  serviceId?: string
  hubId?: string
  edges: AtlasEdge[]
}

export interface ChainRunSummary {
  scenarioId: string
  title: string
  difficulty: ChainDifficulty
  length: ChainLength
  reward: number
  startName: string
  endName: string
  serviceNames: string[]
  insight: string
  totalSteps: number
  score: number
  maxCombo: number
  hops: number
  softMistakes: number
  durationMs: number
  efficient: boolean
  hardBreaks?: number
  timeouts?: number
  efficiency?: number
}

export interface ChainMove {
  legId: string
  outcome: ChainOutcome | 'timeout'
  elapsedMs: number
  combo: number
  checkpointStationId: string
}

export interface ChainRunState {
  currentStationId: string
  checkpointStationId: string
  path: string[]
  moves: ChainMove[]
  score: number
  combo: number
  maxCombo: number
  softMistakes: number
  hardBreaks: number
  timeouts: number
}

type ChainDisplayNode = { id: string; placeId: string; serviceId: string; label: string }
type ChainDisplayEdge = { from: string; to: string; type: 'ride' | 'transfer'; serviceId?: string; cost: number }

const station = (serviceId: string, code: string) => `${serviceId}:${code}`
const stationLabel = (id: string) => transitGraph.stationById.get(id)?.name ?? id
const serviceLabel = (id: string) => transitGraph.lineById.get(id)?.name ?? id
const edgeBetween = (from: string, to: string) => (transitGraph.neighbors.get(from) ?? []).find((edge) => edge.to === to)

const placeIdFor = (name: string, hubId?: string) => {
  if (hubId) return hubId
  const normalized = name.toLowerCase()
  if (normalized.includes('dukuh atas')) return 'dukuh-atas'
  if (normalized.includes('blok m')) return 'blok-m'
  if (normalized.includes('cawang')) return 'cawang'
  if (normalized.includes('jatinegara')) return 'jatinegara'
  if (normalized.includes('manggarai')) return 'manggarai'
  if (normalized.includes('jakarta kota') || normalized === 'kota') return 'kota'
  if (normalized.includes('bandara') || normalized.includes('soekarno')) return 'bandara'
  if (normalized.includes('bekasi')) return 'bekasi'
  return 'transit-stop'
}

export const nodeById = (id: string): ChainDisplayNode | undefined => {
  const item = transitGraph.stationById.get(id)
  return item ? { id: item.id, placeId: placeIdFor(item.name, item.hubId), serviceId: item.serviceId, label: item.name } : undefined
}

export const chainEdgesFor = (stationId: string): ChainDisplayEdge[] =>
  (transitGraph.neighbors.get(stationId) ?? []).map((edge) => ({
    from: edge.from, to: edge.to, type: edge.kind === 'ride' ? 'ride' : 'transfer', serviceId: edge.serviceId, cost: edge.kind === 'ride' ? 1 : 0,
  }))

const rideLeg = (serviceId: string, fromStationId: string, toStationId: string, outcome: ChainOutcome, message?: string): ChainLeg => {
  const line = transitGraph.lineById.get(serviceId)
  if (!line) throw new Error(`Unknown Chain service ${serviceId}`)
  const fromIndex = line.stationIds.indexOf(fromStationId)
  const toIndex = line.stationIds.indexOf(toStationId)
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) throw new Error(`Invalid Chain ride leg ${fromStationId} → ${toStationId}`)
  const sliced = line.stationIds.slice(Math.min(fromIndex, toIndex), Math.max(fromIndex, toIndex) + 1)
  const stationIds = fromIndex <= toIndex ? sliced : sliced.reverse()
  return { id: `${serviceId}:${fromStationId}:${toStationId}`, kind: 'ride', serviceId, fromStationId, toStationId, stationIds, label: serviceLabel(serviceId), direction: `Arah ${stationLabel(toStationId)}`, outcome, message }
}

const transferLeg = (fromStationId: string, toStationId: string, outcome: ChainOutcome, message?: string): ChainLeg => {
  const edge = edgeBetween(fromStationId, toStationId)
  const target = transitGraph.stationById.get(toStationId)
  if (!edge || edge.kind !== 'transfer' || !target) throw new Error(`Invalid Chain transfer ${fromStationId} → ${toStationId}`)
  return { id: `transfer:${fromStationId}:${toStationId}`, kind: 'transfer', serviceId: target.serviceId, fromStationId, toStationId, stationIds: [fromStationId, toStationId], label: `Transfer ke ${serviceLabel(target.serviceId)}`, direction: edge.hubId ? `Di ${hubFor(edge.hubId)?.name ?? stationLabel(fromStationId)}` : `Ke ${stationLabel(toStationId)}`, outcome, message }
}

const definitions: ChainScenarioDefinition[] = [
  { id: 'dukuh-blokm', title: 'Dukuh Atas BNI → Blok M', difficulty: 'Easy', length: 'standard', startStationId: station('MRT_NS', 'M12'), endStationId: station('MRT_NS', 'M06'), secondsPerStep: 6, reward: 100, insightHubId: 'dukuh-atas', insight: 'Dukuh Atas adalah mega-hub yang menyambungkan LRT Jabodebek, MRT, dan TransJakarta.' },
  { id: 'kota-priok', title: 'Jakarta Kota → Tanjung Priok', difficulty: 'Easy', length: 'standard', startStationId: station('KRL_TANJUNG_PRIOK', 'TP01'), endStationId: station('KRL_TANJUNG_PRIOK', 'TP05'), secondsPerStep: 6, reward: 100, insightHubId: 'kota-jakarta-kota', insight: 'Kota menghubungkan KRL Tanjung Priok dengan beberapa koridor lain; pilih layanan yang benar sebelum meninggalkan hub.' },
  { id: 'dukuh-kota', title: 'Dukuh Atas → Kota', difficulty: 'Easy', length: 'standard', startStationId: station('TJ_1', '1-9'), endStationId: station('TJ_1', '1-20'), secondsPerStep: 6, reward: 120, insightHubId: 'dukuh-atas', insight: 'Di Dukuh Atas, satu titik fisik membuka banyak layanan. Terminus Kota adalah arah yang tepat untuk Koridor 1.' },
  { id: 'jatinegara-kota', title: 'Jatinegara → Jakarta Kota', difficulty: 'Medium', length: 'long', startStationId: station('KRL_CIKARANG_LOOP', 'C03'), endStationId: station('KRL_BOGOR', 'B01'), secondsPerStep: 5, reward: 180, insightHubId: 'manggarai', insight: 'Manggarai adalah hub KRL utama: di sini kamu berpindah dari Cikarang Loop ke Bogor Line menuju Kota.' },
  { id: 'manggarai-bandara', title: 'Manggarai → Bandara', difficulty: 'Medium', length: 'standard', startStationId: station('KRL_AIRPORT', 'A01'), endStationId: station('KRL_AIRPORT', 'A05'), secondsPerStep: 5, reward: 180, insightHubId: 'manggarai', insight: 'Manggarai memberi pilihan antarlayanan, tetapi Airport Rail Link adalah jalur langsung untuk terminal bandara.' },
  { id: 'cawang-bandara', title: 'Cawang → Bandara', difficulty: 'High', length: 'long', startStationId: station('KRL_BOGOR', 'B09'), endStationId: station('KRL_AIRPORT', 'A05'), secondsPerStep: 4, reward: 240, insightHubId: 'cawang', insight: 'Dari Cawang, arahkan chain ke Manggarai sebelum mengambil Airport Rail Link.' },
  { id: 'dukuh-priok', title: 'Dukuh Atas → Tanjung Priok', difficulty: 'High', length: 'marathon', startStationId: station('TJ_1', '1-9'), endStationId: station('KRL_TANJUNG_PRIOK', 'TP05'), secondsPerStep: 4, reward: 320, insightHubId: 'kota-jakarta-kota', insight: 'Kota mengubah perjalanan TransJakarta menjadi sambungan KRL menuju Tanjung Priok.' },
]

const deadEnd = 'Cabang ini benar-benar terhubung di hub, tetapi tidak membawa chain ini ke tujuan.'
const detour = 'Rute ini nyata dan masih bisa selesai, tetapi kamu perlu kembali ke hub untuk memilih jalur yang lebih efisien.'

const decisionsFor = (id: string): ChainDecision[] => {
  const MRT_DUKUH = station('MRT_NS', 'M12'), TJ_DUKUH = station('TJ_1', '1-9'), TJ_KOTA = station('TJ_1', '1-20')
  const LRT_BEKASI_DUKUH = station('LRT_JBDBK_BEKASI', 'BK01'), LRT_CIBUBUR_DUKUH = station('LRT_JBDBK_CIBUBUR', 'CB01')
  const PRI0K_KOTA = station('KRL_TANJUNG_PRIOK', 'TP01'), PRI0K_END = station('KRL_TANJUNG_PRIOK', 'TP05'), BOGOR_KOTA = station('KRL_BOGOR', 'B01'), TJ12_KOTA = station('TJ_12', '12-6')
  const JATINEGARA = station('KRL_CIKARANG_LOOP', 'C03'), MANGGARAI_LOOP = station('KRL_CIKARANG_LOOP', 'C01'), MANGGARAI_BOGOR = station('KRL_BOGOR', 'B07'), MANGGARAI_AIRPORT = station('KRL_AIRPORT', 'A01'), MANGGARAI_TJ = station('TJ_4', '4-14'), JATINEGARA_TJ5 = station('TJ_5', '5-17'), JATINEGARA_TJ11 = station('TJ_11', '11-15')
  const CAWANG_BOGOR = station('KRL_BOGOR', 'B09'), CAWANG_CIBUBUR = station('LRT_JBDBK_CIBUBUR', 'CB08'), CAWANG_BEKASI = station('LRT_JBDBK_BEKASI', 'BK08'), CAWANG_TJ7 = station('TJ_7', '7-10')
  const AIRPORT_END = station('KRL_AIRPORT', 'A05')
  if (id === 'dukuh-blokm') return [{ stationId: MRT_DUKUH, options: [rideLeg('MRT_NS', MRT_DUKUH, station('MRT_NS', 'M06'), 'optimal'), transferLeg(MRT_DUKUH, LRT_BEKASI_DUKUH, 'dead_end', deadEnd), transferLeg(MRT_DUKUH, LRT_CIBUBUR_DUKUH, 'dead_end', deadEnd), transferLeg(MRT_DUKUH, TJ_DUKUH, 'dead_end', deadEnd)] }]
  if (id === 'kota-priok') return [{ stationId: PRI0K_KOTA, options: [rideLeg('KRL_TANJUNG_PRIOK', PRI0K_KOTA, PRI0K_END, 'optimal'), transferLeg(PRI0K_KOTA, BOGOR_KOTA, 'dead_end', deadEnd), transferLeg(PRI0K_KOTA, TJ_KOTA, 'dead_end', deadEnd), transferLeg(PRI0K_KOTA, TJ12_KOTA, 'dead_end', deadEnd)] }]
  if (id === 'dukuh-kota') return [{ stationId: TJ_DUKUH, options: [rideLeg('TJ_1', TJ_DUKUH, TJ_KOTA, 'optimal'), transferLeg(TJ_DUKUH, MRT_DUKUH, 'dead_end', deadEnd), transferLeg(TJ_DUKUH, LRT_BEKASI_DUKUH, 'dead_end', deadEnd), transferLeg(TJ_DUKUH, LRT_CIBUBUR_DUKUH, 'dead_end', deadEnd)] }]
  if (id === 'jatinegara-kota') return [
    { stationId: JATINEGARA, options: [rideLeg('KRL_CIKARANG_LOOP', JATINEGARA, MANGGARAI_LOOP, 'optimal'), transferLeg(JATINEGARA, JATINEGARA_TJ5, 'dead_end', deadEnd), transferLeg(JATINEGARA, JATINEGARA_TJ11, 'dead_end', deadEnd)] },
    { stationId: MANGGARAI_LOOP, options: [transferLeg(MANGGARAI_LOOP, MANGGARAI_BOGOR, 'optimal'), rideLeg('KRL_CIKARANG_LOOP', MANGGARAI_LOOP, JATINEGARA, 'viable', detour), transferLeg(MANGGARAI_LOOP, MANGGARAI_AIRPORT, 'dead_end', deadEnd), transferLeg(MANGGARAI_LOOP, MANGGARAI_TJ, 'dead_end', deadEnd)] },
    { stationId: MANGGARAI_BOGOR, options: [rideLeg('KRL_BOGOR', MANGGARAI_BOGOR, BOGOR_KOTA, 'optimal'), transferLeg(MANGGARAI_BOGOR, MANGGARAI_LOOP, 'viable', detour), transferLeg(MANGGARAI_BOGOR, MANGGARAI_AIRPORT, 'dead_end', deadEnd), transferLeg(MANGGARAI_BOGOR, MANGGARAI_TJ, 'dead_end', deadEnd)] },
  ]
  if (id === 'manggarai-bandara') return [{ stationId: MANGGARAI_AIRPORT, options: [rideLeg('KRL_AIRPORT', MANGGARAI_AIRPORT, AIRPORT_END, 'optimal'), transferLeg(MANGGARAI_AIRPORT, MANGGARAI_BOGOR, 'dead_end', deadEnd), transferLeg(MANGGARAI_AIRPORT, MANGGARAI_LOOP, 'dead_end', deadEnd), transferLeg(MANGGARAI_AIRPORT, MANGGARAI_TJ, 'dead_end', deadEnd)] }]
  if (id === 'cawang-bandara') return [
    { stationId: CAWANG_BOGOR, options: [rideLeg('KRL_BOGOR', CAWANG_BOGOR, MANGGARAI_BOGOR, 'optimal'), transferLeg(CAWANG_BOGOR, CAWANG_CIBUBUR, 'dead_end', deadEnd), transferLeg(CAWANG_BOGOR, CAWANG_BEKASI, 'dead_end', deadEnd), transferLeg(CAWANG_BOGOR, CAWANG_TJ7, 'dead_end', deadEnd)] },
    { stationId: MANGGARAI_BOGOR, options: [transferLeg(MANGGARAI_BOGOR, MANGGARAI_AIRPORT, 'optimal'), rideLeg('KRL_BOGOR', MANGGARAI_BOGOR, CAWANG_BOGOR, 'viable', detour), transferLeg(MANGGARAI_BOGOR, MANGGARAI_LOOP, 'dead_end', deadEnd), transferLeg(MANGGARAI_BOGOR, MANGGARAI_TJ, 'dead_end', deadEnd)] },
    { stationId: MANGGARAI_AIRPORT, options: [rideLeg('KRL_AIRPORT', MANGGARAI_AIRPORT, AIRPORT_END, 'optimal'), transferLeg(MANGGARAI_AIRPORT, MANGGARAI_BOGOR, 'dead_end', deadEnd), transferLeg(MANGGARAI_AIRPORT, MANGGARAI_LOOP, 'dead_end', deadEnd), transferLeg(MANGGARAI_AIRPORT, MANGGARAI_TJ, 'dead_end', deadEnd)] },
  ]
  if (id === 'dukuh-priok') return [
    { stationId: TJ_DUKUH, options: [rideLeg('TJ_1', TJ_DUKUH, TJ_KOTA, 'optimal'), transferLeg(TJ_DUKUH, MRT_DUKUH, 'dead_end', deadEnd), transferLeg(TJ_DUKUH, LRT_BEKASI_DUKUH, 'dead_end', deadEnd), transferLeg(TJ_DUKUH, LRT_CIBUBUR_DUKUH, 'dead_end', deadEnd)] },
    { stationId: TJ_KOTA, options: [transferLeg(TJ_KOTA, PRI0K_KOTA, 'optimal'), rideLeg('TJ_1', TJ_KOTA, TJ_DUKUH, 'viable', detour), transferLeg(TJ_KOTA, BOGOR_KOTA, 'dead_end', deadEnd), transferLeg(TJ_KOTA, TJ12_KOTA, 'dead_end', deadEnd)] },
    { stationId: PRI0K_KOTA, options: [rideLeg('KRL_TANJUNG_PRIOK', PRI0K_KOTA, PRI0K_END, 'optimal'), transferLeg(PRI0K_KOTA, TJ_KOTA, 'viable', detour), transferLeg(PRI0K_KOTA, BOGOR_KOTA, 'dead_end', deadEnd), transferLeg(PRI0K_KOTA, TJ12_KOTA, 'dead_end', deadEnd)] },
  ]
  throw new Error(`Missing Chain decisions for ${id}`)
}

const legEdges = (leg: ChainLeg) => leg.stationIds.slice(1).map((to, index) => edgeBetween(leg.stationIds[index], to)).filter((edge): edge is AtlasEdge => Boolean(edge))

const optimalRoute = (definition: ChainScenarioDefinition, decisions: ChainDecision[]) => {
  const byStation = new Map(decisions.map((decision) => [decision.stationId, decision]))
  const legs: ChainLeg[] = []
  const stationIds = [definition.startStationId]
  let current = definition.startStationId
  while (current !== definition.endStationId) {
    const decision = byStation.get(current)
    const optimal = decision?.options.find((option) => option.outcome === 'optimal')
    if (!optimal) throw new Error(`Chain scenario ${definition.id} has no optimal choice from ${stationLabel(current)}.`)
    legs.push(optimal); stationIds.push(...optimal.stationIds.slice(1)); current = optimal.toStationId
    if (legs.length > decisions.length + 1) throw new Error(`Chain scenario ${definition.id} optimal choices loop.`)
  }
  return { legs, stationIds }
}

const validateDecision = (scenarioId: string, decision: ChainDecision) => {
  if (decision.options.length < 3 || decision.options.length > 4) throw new Error(`Chain scenario ${scenarioId} decision ${decision.stationId} must have 3–4 choices.`)
  if (decision.options.filter((option) => option.outcome === 'optimal').length !== 1) throw new Error(`Chain scenario ${scenarioId} decision ${decision.stationId} must have exactly one optimal choice.`)
  if (new Set(decision.options.map((option) => option.id)).size !== decision.options.length) throw new Error(`Chain scenario ${scenarioId} decision ${decision.stationId} has duplicate choices.`)
  decision.options.forEach((option) => {
    if (option.fromStationId !== decision.stationId) throw new Error(`Chain scenario ${scenarioId} choice ${option.id} starts from the wrong node.`)
    if (legEdges(option).length !== option.stationIds.length - 1) throw new Error(`Chain scenario ${scenarioId} choice ${option.id} is not graph-backed.`)
  })
}

const makeScenario = (definition: ChainScenarioDefinition): ChainScenario => {
  const decisions = decisionsFor(definition.id)
  decisions.forEach((decision) => validateDecision(definition.id, decision))
  const { legs, stationIds } = optimalRoute(definition, decisions)
  const edges = legs.flatMap(legEdges)
  const lineIds = [...new Set(stationIds.map((id) => transitGraph.stationById.get(id)?.serviceId).filter((value): value is string => Boolean(value)))]
  const start = transitGraph.stationById.get(definition.startStationId)
  const end = transitGraph.stationById.get(definition.endStationId)
  if (!start || !end) throw new Error(`Chain scenario ${definition.id} references a missing station.`)
  const checkpointStationIds = [...new Set([definition.startStationId, ...decisions.map((decision) => decision.stationId).filter((id) => Boolean(transitGraph.stationById.get(id)?.hubId))])]
  return {
    ...definition, expectedHops: edges.length, stationIds, edges, lineIds, transferCount: edges.filter((edge) => edge.kind === 'transfer').length,
    checkpointStationIds, startName: start.name, endName: end.name, serviceNames: lineIds.map(serviceLabel), startNodeId: definition.startStationId, endNodeId: definition.endStationId,
    optimalNodeIds: stationIds, optimalServiceIds: lineIds, checkpointNodeIds: checkpointStationIds, hubFacts: definition.insightHubId ? { [definition.insightHubId]: definition.insight } : {}, mapScope: definition.length,
    legs, alternativeLegs: decisions.flatMap((decision) => decision.options.filter((option) => option.outcome !== 'optimal')), decisions,
  }
}

export const chainScenarios = definitions.map(makeScenario)
export const chainScenarioById = (id: string) => chainScenarios.find((scenario) => scenario.id === id)

/** Returns the only choices that may be shown at the current game decision. */
export function legsForDecision(scenario: ChainScenario, currentStationId: string): ChainLeg[] {
  return scenario.decisions.find((decision) => decision.stationId === currentStationId)?.options ?? []
}

export function actionsForStation(stationId: string): ChainAction[] {
  const actions = new Map<string, ChainAction>()
  for (const edge of transitGraph.neighbors.get(stationId) ?? []) {
    const target = transitGraph.stationById.get(edge.to)
    if (!target) continue
    if (edge.kind === 'ride' && edge.serviceId) {
      const line = transitGraph.lineById.get(edge.serviceId); const id = `ride:${edge.serviceId}`
      const action = actions.get(id) ?? { id, kind: 'ride' as const, label: line?.name ?? edge.serviceId, detail: line?.route ?? 'Pilih arah berikutnya', serviceId: edge.serviceId, edges: [] }
      action.edges.push(edge); actions.set(id, action)
    } else {
      const line = transitGraph.lineById.get(target.serviceId); const hub = edge.hubId ? hubFor(edge.hubId) : undefined; const id = `transfer:${edge.to}`
      actions.set(id, { id, kind: 'transfer', label: `Transfer ke ${line?.name ?? target.serviceId}`, detail: hub ? hub.name : target.name, serviceId: target.serviceId, hubId: edge.hubId, edges: [edge] })
    }
  }
  return [...actions.values()]
}

export function canReachScenarioGoal(from: string, scenario: ChainScenario, blockedStationIds: string[]) {
  const blocked = new Set(blockedStationIds.filter((id) => id !== from && id !== scenario.endStationId)); const seen = new Set([from]); const queue = [from]
  while (queue.length) { const current = queue.shift()!; if (current === scenario.endStationId) return true; for (const edge of transitGraph.neighbors.get(current) ?? []) { if (blocked.has(edge.to) || seen.has(edge.to)) continue; seen.add(edge.to); queue.push(edge.to) } }
  return false
}

export const lineTone = (serviceId?: string) => {
  const mode = serviceId ? transitGraph.lineById.get(serviceId)?.mode : undefined
  return mode === 'MRT' ? 'mrt' : mode === 'LRT_JABODEBEK' || mode === 'LRT_JAKARTA' ? 'lrt' : mode === 'TRANSJAKARTA' ? 'tj' : serviceId === 'KRL_AIRPORT' ? 'airport' : 'krl'
}

export const scenarioHubName = (scenario: ChainScenario) => scenario.insightHubId ? hubFor(scenario.insightHubId)?.name : undefined
