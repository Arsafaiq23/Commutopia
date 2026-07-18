import { transitGraph } from './transit-graph'

export type PipeRushPaletteService = string

export interface PipeRushScenario {
  id: string
  title: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  startStationId: string
  endStationId: string
  stationIds: string[]
  minSteps: number
  transfers: number
  seconds: number
  reward: number
  perfectBonus: number
  palette: Array<{ serviceId: PipeRushPaletteService; label: string; color: string }>
  insight: string
}

export interface PipeRushRunState { currentStationId: string; path: string[]; stepsUsed: number }

export interface PipeRushRunSummary {
  scenarioId: string; title: string; startName: string; endName: string; stationIds: string[]; serviceIds: string[]; serviceNames: string[]
  stepsUsed: number; minSteps: number; transfers: number; stars: 1 | 2 | 3; score: number; durationMs: number; baseReward: number; perfectBonus: number; insight: string; timedOut?: boolean
}

const station = (serviceId: string, code: string) => `${serviceId}:${code}`
const lineColor = (serviceId: string) => transitGraph.lineById.get(serviceId)?.color ?? '#7658de'
const lineLabel = (serviceId: string) => transitGraph.lineById.get(serviceId)?.name ?? serviceId
const route = (id: string, stationIds: string[]) => {
  stationIds.slice(1).forEach((to, index) => {
    const from = stationIds[index]
    if (!(transitGraph.neighbors.get(from) ?? []).some((edge) => edge.to === to)) throw new Error(`Pipe Rush ${id} contains an invalid graph edge: ${from} → ${to}`)
  })
  return stationIds
}
const palette = (...serviceIds: string[]) => serviceIds.map((serviceId) => ({ serviceId, label: lineLabel(serviceId).replace(' Line', '').replace('KRL ', 'KRL '), color: lineColor(serviceId) }))

export const pipeRushScenarios: PipeRushScenario[] = [
  {
    id: 'tebet-kota', title: 'Tebet → Jakarta Kota', difficulty: 'Easy', startStationId: station('KRL_BOGOR', 'B08'), endStationId: station('KRL_BOGOR', 'B01'),
    stationIds: route('tebet-kota', ['B08','B07','B06','B05','B04','B03','B02','B01'].map((code) => station('KRL_BOGOR', code))), minSteps: 7, transfers: 0, seconds: 105, reward: 20, perfectBonus: 5,
    palette: [...palette('KRL_BOGOR'), { serviceId: 'MRT_NS', label: 'MRT', color: lineColor('MRT_NS') }, { serviceId: 'TJ_1', label: 'TJ', color: lineColor('TJ_1') }, { serviceId: 'LRT_JBDBK_BEKASI', label: 'LRT', color: lineColor('LRT_JBDBK_BEKASI') }],
    insight: 'Manggarai adalah hub KRL, tetapi dari Tebet ke Jakarta Kota kamu tetap berada di Lin Bogor—tidak perlu transfer.',
  },
  {
    id: 'jatinegara-kota', title: 'Jatinegara → Jakarta Kota', difficulty: 'Medium', startStationId: station('KRL_CIKARANG_LOOP', 'C03'), endStationId: station('KRL_BOGOR', 'B01'),
    stationIds: route('jatinegara-kota', [station('KRL_CIKARANG_LOOP', 'C03'), station('KRL_CIKARANG_LOOP', 'C02'), station('KRL_CIKARANG_LOOP', 'C01'), station('KRL_BOGOR', 'B07'), ...['B06','B05','B04','B03','B02','B01'].map((code) => station('KRL_BOGOR', code))]), minSteps: 9, transfers: 1, seconds: 95, reward: 30, perfectBonus: 10,
    palette: palette('KRL_CIKARANG_LOOP', 'KRL_BOGOR', 'MRT_NS', 'TJ_1'),
    insight: 'Di Manggarai kamu harus berpindah dari KRL Cikarang Loop ke Lin Bogor sebelum melanjutkan ke Jakarta Kota.',
  },
  {
    id: 'dukuh-blokm', title: 'Dukuh Atas → Blok M', difficulty: 'Medium', startStationId: station('LRT_JBDBK_BEKASI', 'BK01'), endStationId: station('MRT_NS', 'M06'),
    stationIds: route('dukuh-blokm', [station('LRT_JBDBK_BEKASI', 'BK01'), station('MRT_NS', 'M12'), ...['M11', 'M10', 'M09', 'M08', 'M07', 'M06'].map((code) => station('MRT_NS', code))]), minSteps: 7, transfers: 1, seconds: 90, reward: 35, perfectBonus: 10,
    palette: palette('LRT_JBDBK_BEKASI', 'MRT_NS', 'TJ_1', 'KRL_BOGOR'),
    insight: 'Dukuh Atas menghubungkan LRT Jabodebek dan MRT Jakarta. Setelah transfer, ikuti MRT ke arah Lebak Bulus hingga Blok M.',
  },
  {
    id: 'dukuh-kota', title: 'Dukuh Atas → Kota', difficulty: 'Hard', startStationId: station('LRT_JBDBK_CIBUBUR', 'CB01'), endStationId: station('TJ_1', '1-20'),
    stationIds: route('dukuh-kota', [station('LRT_JBDBK_CIBUBUR', 'CB01'), station('TJ_1', '1-9'), ...['1-10', '1-11', '1-12', '1-13', '1-14', '1-15', '1-16', '1-17', '1-18', '1-19', '1-20'].map((code) => station('TJ_1', code))]), minSteps: 12, transfers: 1, seconds: 120, reward: 45, perfectBonus: 15,
    palette: palette('LRT_JBDBK_CIBUBUR', 'TJ_1', 'MRT_NS', 'KRL_BOGOR'),
    insight: 'Di Dukuh Atas, ganti dari LRT Jabodebek ke TransJakarta Koridor 1. Tetap di Koridor 1 sampai terminus Kota.',
  },
  {
    id: 'cawang-bandara', title: 'Cawang → Bandara', difficulty: 'Hard', startStationId: station('KRL_BOGOR', 'B09'), endStationId: station('KRL_AIRPORT', 'A05'),
    stationIds: route('cawang-bandara', [station('KRL_BOGOR', 'B09'), station('KRL_BOGOR', 'B08'), station('KRL_BOGOR', 'B07'), station('KRL_AIRPORT', 'A01'), ...['A02','A03','A03a','A04','A05'].map((code) => station('KRL_AIRPORT', code))]), minSteps: 8, transfers: 1, seconds: 85, reward: 40, perfectBonus: 10,
    palette: palette('KRL_BOGOR', 'KRL_AIRPORT', 'KRL_CIKARANG_LOOP', 'MRT_NS'),
    insight: 'Dari Cawang, ikuti Lin Bogor ke Manggarai lalu transfer ke Airport Rail Link untuk mencapai Bandara.',
  },
]

export const pipeRushScenario = pipeRushScenarios[0]
export const pipeRushScenarioById = (id: string) => pipeRushScenarios.find((scenario) => scenario.id === id)
export const createPipeRushState = (scenario = pipeRushScenario): PipeRushRunState => ({ currentStationId: scenario.startStationId, path: [scenario.startStationId], stepsUsed: 0 })
export const stationName = (stationId: string) => transitGraph.stationById.get(stationId)?.name ?? stationId

export function isValidPipeRushMove(state: PipeRushRunState, toStationId: string, selectedServiceId?: string, scenario = pipeRushScenario) {
  if (!selectedServiceId || !scenario.stationIds.includes(toStationId)) return false
  return (transitGraph.neighbors.get(state.currentStationId) ?? []).some((edge) => {
    if (edge.to !== toStationId) return false
    if (edge.kind === 'ride') return edge.serviceId === selectedServiceId
    return edge.kind === 'transfer' && transitGraph.stationById.get(toStationId)?.serviceId === selectedServiceId
  })
}

export function applyPipeRushMove(state: PipeRushRunState, toStationId: string, selectedServiceId?: string, scenario = pipeRushScenario): PipeRushRunState {
  if (!isValidPipeRushMove(state, toStationId, selectedServiceId, scenario)) return state
  return { currentStationId: toStationId, path: [...state.path, toStationId], stepsUsed: state.stepsUsed + 1 }
}

export const isPipeRushComplete = (state: PipeRushRunState, scenario = pipeRushScenario) => state.currentStationId === scenario.endStationId
export const starsForPipeRush = (stepsUsed: number, scenario = pipeRushScenario): 1 | 2 | 3 => stepsUsed <= scenario.minSteps ? 3 : stepsUsed === scenario.minSteps + 1 ? 2 : 1

export function pipeRushSummary(state: PipeRushRunState, durationMs: number, scenario = pipeRushScenario, timedOut = false): PipeRushRunSummary {
  const stars = starsForPipeRush(state.stepsUsed, scenario)
  const serviceIds = [...new Set(state.path.slice(1).flatMap((to, index) => {
    const from = state.path[index]
    const edge = (transitGraph.neighbors.get(state.path[index]) ?? []).find((item) => item.to === to)
    if (edge?.kind === 'transfer') return [transitGraph.stationById.get(from)?.serviceId, transitGraph.stationById.get(to)?.serviceId]
    return [edge?.serviceId ?? transitGraph.stationById.get(to)?.serviceId]
  }).filter((serviceId): serviceId is string => Boolean(serviceId)))]
  return { scenarioId: scenario.id, title: scenario.title, startName: stationName(scenario.startStationId), endName: stationName(scenario.endStationId), stationIds: state.path, serviceIds, serviceNames: serviceIds.map(lineLabel), stepsUsed: state.stepsUsed, minSteps: scenario.minSteps, transfers: scenario.transfers, stars, score: state.stepsUsed ? Math.round((scenario.minSteps / state.stepsUsed) * 100) : 0, durationMs, baseReward: scenario.reward, perfectBonus: stars === 3 ? scenario.perfectBonus : 0, insight: scenario.insight, timedOut }
}
