import source from '../jabodetabek_transit_data (1).json'
import { services, type Mode, type Service } from './catalog'

export type AtlasFilter = 'ALL' | Mode | 'AIRPORT_RAIL' | 'HUBS'
export type AtlasEdgeKind = 'ride' | 'transfer'

export interface AtlasStation {
  id: string
  serviceId: string
  placeId: string
  code: string
  name: string
  sequence: number
  isTerminus: boolean
  hubId?: string
}

export interface AtlasLine {
  id: string
  mode: Mode
  name: string
  color: string
  route: string
  stationIds: string[]
  variants: Array<{ id: string; route: string }>
}

export interface AtlasEdge {
  id: string
  from: string
  to: string
  kind: AtlasEdgeKind
  serviceId?: string
  hubId?: string
}

export interface TransitHub {
  id: string
  name: string
  modes: string[]
  note: string
  stationIds: string[]
}

export interface TransitGraph {
  stations: AtlasStation[]
  lines: AtlasLine[]
  edges: AtlasEdge[]
  hubs: TransitHub[]
  stationById: Map<string, AtlasStation>
  lineById: Map<string, AtlasLine>
  neighbors: Map<string, AtlasEdge[]>
}

export interface RoutePracticeScenario {
  id: string
  startStationId: string
  endStationId: string
  stationIds: string[]
  lineIds: string[]
  transfers: number
}

const normal = (value: string) => value.toLocaleLowerCase('id').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const hubAliases: Record<string, string[]> = {
  'dukuh-atas': ['dukuh atas', 'dukuh atas bni', 'dukuh atas galunggung'],
  manggarai: ['manggarai'], cawang: ['cawang'], duri: ['duri'], jatinegara: ['jatinegara'],
  'kampung-bandan': ['kampung bandan'], 'batu-ceper': ['batu ceper'], 'kota-jakarta-kota': ['kota', 'jakarta kota'],
  grogol: ['grogol'], 'kampung-melayu': ['kampung melayu'],
}
const hubId = (name: string) => normal(name).replace(/ /g, '-')

function createGraph(): TransitGraph {
  const rawHubs = source.major_interchange_hubs
  const serviceById = new Map(services.map((service) => [service.id, service]))
  const stations: AtlasStation[] = services.flatMap((service) => service.stops.map((stop) => ({
    id: stop.id, serviceId: service.id, placeId: stop.placeId, code: stop.sourceCode, name: stop.label,
    sequence: stop.sequence, isTerminus: stop.sequence === 0 || stop.sequence === service.stops.length - 1,
  } satisfies AtlasStation)))
  const hubs = rawHubs.map((hub) => {
    const id = hubId(hub.name)
    const aliases = new Set((hubAliases[id] ?? [hub.name]).map(normal))
    const stationIds = stations.filter((station) => aliases.has(normal(station.name))).map((station) => station.id)
    return { id, name: hub.name, modes: hub.modes, note: hub.note, stationIds }
  })
  const hubForStation = new Map(hubs.flatMap((hub) => hub.stationIds.map((id) => [id, hub.id] as const)))
  stations.forEach((station) => { station.hubId = hubForStation.get(station.id) })
  const lines = services.map((service) => ({
    id: service.id, mode: service.mode, name: service.name, color: service.color, route: service.route,
    stationIds: service.stops.map((stop) => stop.id),
    variants: (source.transjakarta_variants ?? []).filter((variant) => `TJ_${variant.base_corridor}` === service.id).map((variant) => ({ id: variant.id, route: variant.route })),
  } satisfies AtlasLine))
  const rideEdges = lines.flatMap((line) => line.stationIds.slice(1).map((to, index) => ({ id: `${line.id}:${index}`, from: line.stationIds[index], to, kind: 'ride' as const, serviceId: line.id })))
  const transferEdges = hubs.flatMap((hub) => hub.stationIds.flatMap((from, index) => hub.stationIds.slice(index + 1).map((to) => ({ id: `hub:${hub.id}:${from}:${to}`, from, to, kind: 'transfer' as const, hubId: hub.id }))))
  const edges = [...rideEdges, ...transferEdges]
  const neighbors = new Map<string, AtlasEdge[]>()
  for (const edge of edges) {
    neighbors.set(edge.from, [...(neighbors.get(edge.from) ?? []), edge])
    neighbors.set(edge.to, [...(neighbors.get(edge.to) ?? []), { ...edge, from: edge.to, to: edge.from }])
  }
  return { stations, lines, edges, hubs, stationById: new Map(stations.map((station) => [station.id, station])), lineById: new Map(lines.map((line) => [line.id, line])), neighbors }
}

export const transitGraph = createGraph()

export const filterMatchesLine = (filter: AtlasFilter, line: AtlasLine) => filter === 'ALL' || filter === 'HUBS' || (filter === 'AIRPORT_RAIL' ? line.id === 'KRL_AIRPORT' : line.mode === filter)
export const hubFor = (hubIdValue: string) => transitGraph.hubs.find((hub) => hub.id === hubIdValue)
export const linesForStation = (stationId: string) => transitGraph.lines.filter((line) => line.stationIds.includes(stationId))
export const transfersForStation = (stationId: string) => transitGraph.edges.filter((edge) => edge.kind === 'transfer' && (edge.from === stationId || edge.to === stationId))

export function shortestStationPath(startStationId: string, endStationId: string, allowedLineId?: string): string[] | null {
  if (startStationId === endStationId) return [startStationId]
  const seen = new Set([startStationId]); const queue = [[startStationId]]
  while (queue.length) {
    const path = queue.shift()!; const last = path.at(-1)!
    for (const edge of transitGraph.neighbors.get(last) ?? []) {
      if (allowedLineId && edge.kind === 'ride' && edge.serviceId !== allowedLineId) continue
      if (seen.has(edge.to)) continue
      const next = [...path, edge.to]
      if (edge.to === endStationId) return next
      seen.add(edge.to); queue.push(next)
    }
  }
  return null
}

export function createRoutePractice(startStationId: string, endStationId: string, allowedLineId?: string): RoutePracticeScenario | null {
  const stationIds = shortestStationPath(startStationId, endStationId, allowedLineId)
  if (!stationIds || stationIds.length < 2) return null
  const traversed = stationIds.slice(1).map((id, index) => (transitGraph.neighbors.get(stationIds[index]) ?? []).find((edge) => edge.to === id)!).filter(Boolean)
  const lineIds = [...new Set(traversed.flatMap((edge) => edge.serviceId ? [edge.serviceId] : []))]
  return { id: `atlas:${startStationId}:${endStationId}`, startStationId, endStationId, stationIds, lineIds, transfers: traversed.filter((edge) => edge.kind === 'transfer').length }
}

export function practiceDestinations(startStationId: string, allowedLineId?: string) {
  const candidates = transitGraph.stations.filter((station) => station.id !== startStationId && (allowedLineId ? station.serviceId === allowedLineId && station.isTerminus : station.isTerminus || Boolean(station.hubId)))
  return candidates.map((station) => ({ station, path: shortestStationPath(startStationId, station.id, allowedLineId) })).filter((item): item is { station: AtlasStation; path: string[] } => Boolean(item.path)).sort((a, b) => a.path.length - b.path.length || a.station.name.localeCompare(b.station.name)).slice(0, 6)
}

export const serviceFor = (id: string): Service | undefined => serviceByIdFor(id)
const serviceByIdFor = (id: string) => services.find((service) => service.id === id)
