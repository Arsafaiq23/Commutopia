import transitSource from '../jabodetabek_transit_data (1).json'

export type EdgeType = 'ride' | 'same_station' | 'in_station' | 'short_walk' | 'unsupported'
export type Mechanic = 'pipe' | 'chain' | 'race' | 'flood'

export interface CanonicalPlace { id: string; name: string; aliases: string[]; modes: string[] }
export interface TransitNode { id: string; placeId: string; serviceId: string; label: string }
export interface TransitEdge { from: string; to: string; type: EdgeType; serviceId?: string; cost: number }
export interface RouteSolution { nodeIds: string[]; serviceIds: string[]; transfers: number; stopCount: number; score: number }
export interface Challenge {
  id: string; mechanic: Mechanic; title: string; kicker: string; start: string; end: string;
  prompt: string; choices?: string[]; answer: string | string[]; solution: RouteSolution; reward: number;
}
export interface Attempt {
  challengeId: string
  scenarioId?: string
  outcome: 'correct' | 'wrong'
  durationMs: number
  mistakes: number
  maxCombo?: number
  softMistakes?: number
  hardBreaks?: number
  timeouts?: number
  efficiency?: number
}
export interface MentorFact { type: 'hub' | 'transfer'; placeId: string; evidence: string; copyKey: string }

type RawStation = { code: string; name: string }
type RawLine = { id: string; stations: RawStation[] }
const rawLines = transitSource.lines as RawLine[]
const stationName = (lineId: string, code: string) => rawLines.find((line) => line.id === lineId)?.stations.find((station) => station.code === code)?.name ?? code
export const dataAudit = { source: transitSource.meta.source, services: transitSource.lines.length + transitSource.transjakarta_corridors.length, hubs: transitSource.major_interchange_hubs.length }

export const places: CanonicalPlace[] = [
  { id: 'bekasi', name: 'Bekasi', aliases: ['Bekasi'], modes: ['LRT Jabodebek', 'KRL'] },
  { id: 'dukuh-atas', name: 'Dukuh Atas', aliases: ['Dukuh Atas BNI', 'Dukuh Atas/Galunggung'], modes: ['LRT Jabodebek', 'MRT', 'TransJakarta'] },
  { id: 'blok-m', name: 'Blok M', aliases: ['Blok M', 'Blok M BCA'], modes: ['MRT', 'TransJakarta'] },
  { id: 'cawang', name: 'Cawang', aliases: ['Cawang'], modes: ['LRT Jabodebek', 'KRL', 'TransJakarta'] },
  { id: 'jatinegara', name: 'Jatinegara', aliases: ['Jatinegara'], modes: ['KRL'] },
  { id: 'manggarai', name: 'Manggarai', aliases: ['Manggarai'], modes: ['KRL', 'Airport Rail Link'] },
  { id: 'kota', name: 'Kota (Jakarta Kota)', aliases: ['Kota', 'Jakarta Kota'], modes: ['KRL'] },
  { id: 'bandara', name: 'Bandara Soekarno-Hatta', aliases: ['Soekarno-Hatta'], modes: ['Airport Rail Link'] },
]

export const nodes: TransitNode[] = [
  { id: 'bekasi-lrt', placeId: 'bekasi', serviceId: 'LRT_BEKASI', label: stationName('LRT_JBDBK_BEKASI', 'BK13') },
  { id: 'cawang-lrt', placeId: 'cawang', serviceId: 'LRT_BEKASI', label: stationName('LRT_JBDBK_BEKASI', 'BK08') },
  { id: 'dukuh-lrt', placeId: 'dukuh-atas', serviceId: 'LRT_BEKASI', label: stationName('LRT_JBDBK_BEKASI', 'BK01') },
  { id: 'dukuh-mrt', placeId: 'dukuh-atas', serviceId: 'MRT_NS', label: stationName('MRT_NS', 'M12') },
  { id: 'blok-m-mrt', placeId: 'blok-m', serviceId: 'MRT_NS', label: stationName('MRT_NS', 'M06') },
  { id: 'dukuh-tj', placeId: 'dukuh-atas', serviceId: 'TJ_1', label: 'Dukuh Atas/Galunggung' },
  { id: 'blok-m-tj', placeId: 'blok-m', serviceId: 'TJ_1', label: 'Blok M' },
  { id: 'jatinegara-krl', placeId: 'jatinegara', serviceId: 'KRL_CIKARANG_LOOP', label: stationName('KRL_CIKARANG_LOOP', 'C03') },
  { id: 'manggarai-cikarang', placeId: 'manggarai', serviceId: 'KRL_CIKARANG_LOOP', label: stationName('KRL_CIKARANG_LOOP', 'C01') },
  { id: 'manggarai-bogor', placeId: 'manggarai', serviceId: 'KRL_BOGOR', label: stationName('KRL_BOGOR', 'B07') },
  { id: 'kota-krl', placeId: 'kota', serviceId: 'KRL_BOGOR', label: stationName('KRL_BOGOR', 'B01') },
  { id: 'manggarai-airport', placeId: 'manggarai', serviceId: 'KRL_AIRPORT', label: stationName('KRL_AIRPORT', 'A01') },
  { id: 'bandara-airport', placeId: 'bandara', serviceId: 'KRL_AIRPORT', label: stationName('KRL_AIRPORT', 'A05') },
]

export const edges: TransitEdge[] = [
  { from: 'bekasi-lrt', to: 'cawang-lrt', type: 'ride', serviceId: 'LRT_BEKASI', cost: 5 },
  { from: 'cawang-lrt', to: 'dukuh-lrt', type: 'ride', serviceId: 'LRT_BEKASI', cost: 8 },
  { from: 'dukuh-lrt', to: 'dukuh-mrt', type: 'short_walk', cost: 4 },
  { from: 'dukuh-mrt', to: 'blok-m-mrt', type: 'ride', serviceId: 'MRT_NS', cost: 7 },
  { from: 'dukuh-lrt', to: 'dukuh-tj', type: 'short_walk', cost: 4 },
  { from: 'dukuh-tj', to: 'blok-m-tj', type: 'ride', serviceId: 'TJ_1', cost: 9 },
  { from: 'jatinegara-krl', to: 'manggarai-cikarang', type: 'ride', serviceId: 'KRL_CIKARANG_LOOP', cost: 2 },
  { from: 'manggarai-cikarang', to: 'manggarai-bogor', type: 'in_station', cost: 1 },
  { from: 'manggarai-bogor', to: 'kota-krl', type: 'ride', serviceId: 'KRL_BOGOR', cost: 6 },
  { from: 'manggarai-cikarang', to: 'manggarai-airport', type: 'in_station', cost: 1 },
  { from: 'manggarai-airport', to: 'bandara-airport', type: 'ride', serviceId: 'KRL_AIRPORT', cost: 5 },
]

export const solutions = {
  bekasiDukuh: { nodeIds: ['bekasi-lrt', 'cawang-lrt', 'dukuh-lrt'], serviceIds: ['LRT_BEKASI'], transfers: 0, stopCount: 13, score: 13 },
  dukuhBlokM: { nodeIds: ['dukuh-lrt', 'dukuh-mrt', 'blok-m-mrt'], serviceIds: ['LRT_BEKASI', 'MRT_NS'], transfers: 1, stopCount: 7, score: 17 },
} satisfies Record<string, RouteSolution>

export const challenges: Challenge[] = [
  { id: 'pipe-tebet-kota', mechanic: 'pipe', title: 'Tebet ke Jakarta Kota', kicker: 'PIPE RUSH', start: 'Tebet', end: 'Jakarta Kota', prompt: 'Tarik KRL Bogor dari Tebet sampai Jakarta Kota.', answer: [], solution: { nodeIds: ['KRL_BOGOR:B08', 'KRL_BOGOR:B07', 'KRL_BOGOR:B06', 'KRL_BOGOR:B05', 'KRL_BOGOR:B04', 'KRL_BOGOR:B03', 'KRL_BOGOR:B02', 'KRL_BOGOR:B01'], serviceIds: ['KRL_BOGOR'], transfers: 0, stopCount: 7, score: 7 }, reward: 20 },
  { id: 'chain-blokm', mechanic: 'chain', title: 'Susun transfer', kicker: 'CHAIN REACTION', start: 'Dukuh Atas', end: 'Blok M', prompt: 'Setelah tiba di Dukuh Atas lewat LRT, pilih langkah paling tepat.', choices: ['Pindah ke MRT arah Lebak Bulus', 'Tetap di LRT menuju Harjamukti', 'Naik KRL di Manggarai'], answer: 'Pindah ke MRT arah Lebak Bulus', solution: solutions.dukuhBlokM, reward: 100 },
  { id: 'race-blokm', mechanic: 'race', title: 'Pilih rute efisien', kicker: 'PATH RACE', start: 'Dukuh Atas', end: 'Blok M', prompt: 'Rute mana yang paling efisien untuk mencapai Blok M?', choices: ['MRT: 1 transfer, 7 pemberhentian', 'TransJakarta: 1 transfer, 9 pemberhentian'], answer: 'MRT: 1 transfer, 7 pemberhentian', solution: solutions.dukuhBlokM, reward: 100 },
  { id: 'flood-dukuh', mechanic: 'flood', title: 'Buka jaringan', kicker: 'COLOR FLOOD', start: 'Bekasi Barat', end: 'Blok M', prompt: 'Pilih warna jalur untuk membuka akses menuju Blok M.', choices: ['LRT Bekasi', 'MRT Jakarta', 'TransJakarta Koridor 1'], answer: ['LRT Bekasi', 'MRT Jakarta'], solution: solutions.dukuhBlokM, reward: 120 },
]

export const nodeById = (id: string) => nodes.find((node) => node.id === id)
export const chainEdgesFor = (nodeId: string) => edges.flatMap((edge) => [edge, { ...edge, from: edge.to, to: edge.from }]).filter((edge) => edge.from === nodeId)

export function mentorFor(challenge: Challenge): MentorFact {
  return challenge.id === 'pipe-tebet-kota'
    ? { type: 'hub', placeId: 'dukuh-atas', evidence: 'LRT Jabodebek, MRT, dan beberapa koridor TransJakarta bertemu di kawasan Dukuh Atas.', copyKey: 'hub-dukuh' }
    : { type: 'transfer', placeId: 'dukuh-atas', evidence: 'Dukuh Atas memberi akses cepat dari LRT ke MRT arah selatan.', copyKey: 'transfer-dukuh' }
}

export function mentorCopy(fact: MentorFact) {
  return fact.type === 'hub'
    ? { heading: 'Insight dari Commu', body: 'Keren! Dukuh Atas itu bukan sekadar pemberhentian akhir LRT. Di sini kamu bisa menyambung ke MRT dan TransJakarta—hub kecil yang membuka banyak perjalanan.', tip: 'Saat ragu, cari hub besar lebih dulu.' }
    : { heading: 'Insight dari Commu', body: 'Strategimu tepat: satu transfer di Dukuh Atas membuat kamu langsung masuk koridor MRT menuju Blok M.', tip: 'Transfer yang tepat sering lebih cepat daripada bertahan di satu moda.' }
}
