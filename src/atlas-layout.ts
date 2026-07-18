import { transitGraph } from './transit-graph'

export interface Point { x: number; y: number }
export interface AtlasLayout { width: number; height: number; stationPoints: Record<string, Point>; linePoints: Record<string, Point[]>; linePaths: Record<string, string>; hubPoints: Record<string, Point> }

type RouteSpec = { points: Point[]; offset?: Point; anchors?: Record<string, Point> }
const CANVAS = { width: 1800, height: 1180, padding: 44 }
const MIN_NON_HUB_GAP = 3

// These are presentation-only, octolinear guides. They deliberately reserve different
// lanes through central Jakarta so that the overview remains legible before filtering.
const routes: Record<string, RouteSpec> = {
  MRT_NS: { points: [{ x: 900, y: 1060 }, { x: 900, y: 430 }, { x: 930, y: 365 }], anchors: { M12: { x: 900, y: 430 } } },
  LRT_JKT_SOUTH: { points: [{ x: 1260, y: 235 }, { x: 1375, y: 370 }, { x: 1290, y: 535 }] },
  LRT_JBDBK_CIBUBUR: { points: [{ x: 900, y: 430 }, { x: 980, y: 485 }, { x: 1080, y: 570 }, { x: 1240, y: 860 }], offset: { x: -7, y: 4 }, anchors: { CB01: { x: 900, y: 430 }, CB08: { x: 1120, y: 680 } } },
  LRT_JBDBK_BEKASI: { points: [{ x: 900, y: 430 }, { x: 990, y: 495 }, { x: 1120, y: 680 }, { x: 1630, y: 620 }], offset: { x: 7, y: -4 }, anchors: { BK01: { x: 900, y: 430 }, BK08: { x: 1120, y: 680 } } },
  KRL_BOGOR: { points: [{ x: 700, y: 210 }, { x: 805, y: 320 }, { x: 900, y: 610 }, { x: 860, y: 1080 }], anchors: { B01: { x: 700, y: 210 }, B07: { x: 900, y: 610 }, B09: { x: 1050, y: 715 } } },
  KRL_CIKARANG_LOOP: { points: [{ x: 900, y: 610 }, { x: 1135, y: 565 }, { x: 1660, y: 620 }], anchors: { C01: { x: 900, y: 610 }, C03: { x: 1135, y: 565 } } },
  KRL_RANGKASBITUNG: { points: [{ x: 690, y: 545 }, { x: 465, y: 660 }, { x: 90, y: 1080 }] },
  KRL_TANGERANG: { points: [{ x: 460, y: 435 }, { x: 300, y: 475 }, { x: 70, y: 390 }], anchors: { T01: { x: 460, y: 435 }, T02: { x: 505, y: 505 }, T09: { x: 210, y: 420 } } },
  KRL_TANJUNG_PRIOK: { points: [{ x: 700, y: 210 }, { x: 835, y: 150 }, { x: 1210, y: 185 }], anchors: { P01: { x: 700, y: 210 }, P02: { x: 840, y: 150 } } },
  KRL_AIRPORT: { points: [{ x: 900, y: 610 }, { x: 675, y: 440 }, { x: 460, y: 435 }, { x: 210, y: 420 }, { x: 65, y: 135 }], offset: { x: 0, y: -8 }, anchors: { A01: { x: 900, y: 610 }, A03: { x: 460, y: 435 }, A03a: { x: 210, y: 420 } } },
  TJ_1: { points: [{ x: 865, y: 850 }, { x: 865, y: 500 }, { x: 700, y: 210 }], offset: { x: -28, y: 0 } },
  TJ_2: { points: [{ x: 1510, y: 405 }, { x: 1190, y: 405 }, { x: 820, y: 375 }] },
  TJ_3: { points: [{ x: 85, y: 535 }, { x: 500, y: 535 }, { x: 820, y: 410 }], offset: { x: 0, y: 18 } },
  TJ_4: { points: [{ x: 1410, y: 295 }, { x: 1120, y: 405 }, { x: 900, y: 610 }, { x: 900, y: 430 }], offset: { x: 18, y: -12 } },
  TJ_5: { points: [{ x: 1060, y: 170 }, { x: 1135, y: 565 }, { x: 1160, y: 650 }], offset: { x: 16, y: 0 } },
  TJ_6: { points: [{ x: 630, y: 1100 }, { x: 760, y: 800 }, { x: 900, y: 430 }], offset: { x: -18, y: 0 } },
  TJ_7: { points: [{ x: 1510, y: 850 }, { x: 1120, y: 680 }, { x: 1160, y: 650 }], offset: { x: 0, y: 18 } },
  TJ_8: { points: [{ x: 620, y: 1050 }, { x: 500, y: 650 }, { x: 700, y: 420 }], offset: { x: -20, y: 12 } },
  TJ_9: { points: [{ x: 150, y: 585 }, { x: 700, y: 585 }, { x: 1120, y: 680 }], offset: { x: 0, y: 24 } },
  TJ_10: { points: [{ x: 1260, y: 135 }, { x: 1450, y: 350 }, { x: 1290, y: 540 }, { x: 1120, y: 680 }], offset: { x: 24, y: 0 } },
  TJ_11: { points: [{ x: 1690, y: 710 }, { x: 1300, y: 650 }, { x: 1135, y: 565 }, { x: 1160, y: 650 }], offset: { x: 0, y: -22 } },
  TJ_12: { points: [{ x: 185, y: 330 }, { x: 700, y: 210 }, { x: 1180, y: 235 }], offset: { x: 0, y: -20 } },
  TJ_13: { points: [{ x: 325, y: 960 }, { x: 500, y: 720 }, { x: 760, y: 760 }], offset: { x: -18, y: 10 } },
  TJ_14: { points: [{ x: 910, y: 305 }, { x: 1080, y: 340 }, { x: 1010, y: 500 }], offset: { x: 20, y: -18 } },
}

const hubAnchors: Record<string, Point> = {
  'dukuh atas bni': { x: 900, y: 430 }, manggarai: { x: 900, y: 610 }, cawang: { x: 1120, y: 680 },
  'jakarta kota': { x: 700, y: 210 }, kota: { x: 700, y: 210 }, duri: { x: 460, y: 435 }, 'batu ceper': { x: 210, y: 420 },
  jatinegara: { x: 1135, y: 565 }, grogol: { x: 505, y: 505 }, 'kampung bandan': { x: 840, y: 150 }, 'kampung melayu': { x: 1160, y: 650 },
}
const normalize = (value: string) => value.toLocaleLowerCase('id').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y)
const clamp = (point: Point): Point => ({ x: Math.max(CANVAS.padding, Math.min(CANVAS.width - CANVAS.padding, point.x)), y: Math.max(CANVAS.padding, Math.min(CANVAS.height - CANVAS.padding, point.y)) })

function pointOnTrack(points: Point[], fraction: number): Point {
  const lengths = points.slice(1).map((point, index) => distance(points[index], point)); const total = lengths.reduce((sum, value) => sum + value, 0); let remaining = total * fraction
  for (let index = 0; index < lengths.length; index += 1) {
    if (remaining <= lengths[index]) { const progress = remaining / lengths[index]; return { x: points[index].x + (points[index + 1].x - points[index].x) * progress, y: points[index].y + (points[index + 1].y - points[index].y) * progress } }
    remaining -= lengths[index]
  }
  return points.at(-1)!
}

function roundedPath(points: Point[], radius = 12) {
  if (points.length < 2) return ''
  const before = (from: Point, to: Point, amount: number) => { const length = distance(from, to) || 1; return { x: to.x + (from.x - to.x) * Math.min(amount, length / 2) / length, y: to.y + (from.y - to.y) * Math.min(amount, length / 2) / length } }
  let path = `M ${points[0].x} ${points[0].y}`
  for (let index = 1; index < points.length - 1; index += 1) { const start = before(points[index - 1], points[index], radius); const end = before(points[index + 1], points[index], radius); path += ` L ${start.x} ${start.y} Q ${points[index].x} ${points[index].y} ${end.x} ${end.y}` }
  const end = points.at(-1)!; return `${path} L ${end.x} ${end.y}`
}

function avoidNonHubCollisions(stationPoints: Record<string, Point>) {
  const ids = transitGraph.stations.filter((station) => !station.hubId).map((station) => station.id)
  for (let pass = 0; pass < 2; pass += 1) {
    for (let index = 0; index < ids.length; index += 1) for (let other = 0; other < index; other += 1) {
      const point = stationPoints[ids[index]]; const against = stationPoints[ids[other]]; const gap = distance(point, against)
      if (gap > 0 && gap < 7) { const angle = Math.atan2(point.y - against.y, point.x - against.x) || ((index + 1) * 1.618); const shift = (7 - gap) / 2 + 1; point.x += Math.cos(angle) * shift; point.y += Math.sin(angle) * shift }
    }
  }
}

export function createAtlasLayout(): AtlasLayout {
  const stationPoints: Record<string, Point> = {}; const linePoints: Record<string, Point[]> = {}
  for (const line of transitGraph.lines) {
    const spec = routes[line.id] ?? { points: [{ x: 120, y: 120 }, { x: 1680, y: 1060 }] }
    const points = line.stationIds.map((id, index) => {
      const station = transitGraph.stationById.get(id)!; const anchored = spec.anchors?.[station.code] ?? (station.hubId ? hubAnchors[normalize(station.name)] : undefined)
      if (anchored) return { ...anchored }
      const point = pointOnTrack(spec.points, line.stationIds.length === 1 ? 0 : index / (line.stationIds.length - 1)); return clamp({ x: point.x + (spec.offset?.x ?? 0), y: point.y + (spec.offset?.y ?? 0) })
    })
    line.stationIds.forEach((id, index) => { stationPoints[id] = points[index] }); linePoints[line.id] = points
  }
  avoidNonHubCollisions(stationPoints)
  // The arrays share their point references with stationPoints, so collision nudges stay on the drawn routes.
  const linePaths = Object.fromEntries(Object.entries(linePoints).map(([id, points]) => [id, roundedPath(points)]))
  const hubPoints = Object.fromEntries(transitGraph.hubs.map((hub) => {
    const points = hub.stationIds.map((id) => stationPoints[id]).filter(Boolean); const fallback = hubAnchors[normalize(hub.name)] ?? { x: CANVAS.width / 2, y: CANVAS.height / 2 }
    return [hub.id, points.length ? { x: points.reduce((sum, point) => sum + point.x, 0) / points.length, y: points.reduce((sum, point) => sum + point.y, 0) / points.length } : fallback]
  }))
  return { ...CANVAS, stationPoints, linePoints, linePaths, hubPoints }
}

export const atlasLayout = createAtlasLayout()
export function validateAtlasLayout() {
  const expected = new Set(transitGraph.stations.map((station) => station.id)); const actual = new Set(Object.keys(atlasLayout.stationPoints))
  const missing = [...expected].filter((id) => !actual.has(id)); const unknown = [...actual].filter((id) => !expected.has(id))
  const missingRoutes = transitGraph.lines.filter((line) => !routes[line.id]).map((line) => line.id); const unknownRoutes = Object.keys(routes).filter((id) => !transitGraph.lineById.has(id))
  const outOfBounds = Object.entries(atlasLayout.stationPoints).filter(([, point]) => point.x < 0 || point.x > atlasLayout.width || point.y < 0 || point.y > atlasLayout.height).map(([id]) => id)
  const collisions = transitGraph.stations.filter((station, index, list) => !station.hubId && list.slice(0, index).some((other) => !other.hubId && distance(atlasLayout.stationPoints[station.id], atlasLayout.stationPoints[other.id]) < MIN_NON_HUB_GAP)).map((station) => station.id)
  if (missing.length || unknown.length || missingRoutes.length || unknownRoutes.length || outOfBounds.length || collisions.length) throw new Error(`Atlas layout mismatch: missing ${missing.join(', ')} unknown ${unknown.join(', ')} routes ${missingRoutes.join(', ')} extra-routes ${unknownRoutes.join(', ')} bounds ${outOfBounds.join(', ')} spacing ${collisions.join(', ')}`)
  return true
}
validateAtlasLayout()
