import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ appType: 'custom', server: { hmr: false, middlewareMode: true, ws: false } })

try {
  const engine = await server.ssrLoadModule('/src/pipe-rush-engine.ts')
  const graph = await server.ssrLoadModule('/src/transit-graph.ts')
  const storage = await server.ssrLoadModule('/src/storage.ts')
  const scenario = engine.pipeRushScenario

  assert.equal(scenario.startStationId, 'KRL_BOGOR:B08')
  assert.equal(scenario.endStationId, 'KRL_BOGOR:B01')
  assert.equal(scenario.minSteps, 7)
  assert.equal(scenario.stationIds.length, 8)
  scenario.stationIds.slice(1).forEach((to, index) => {
    const from = scenario.stationIds[index]
    assert.ok((graph.transitGraph.neighbors.get(from) ?? []).some((edge) => edge.to === to && edge.kind === 'ride' && edge.serviceId === 'KRL_BOGOR'), `${from} → ${to} is a graph-backed KRL Bogor edge`)
  })
  assert.deepEqual(engine.pipeRushScenarios.map((item) => item.id), ['tebet-kota', 'jatinegara-kota', 'dukuh-blokm', 'dukuh-kota', 'cawang-bandara'], 'Pipe Rush exposes KRL, LRT, MRT, and TransJakarta graph-backed routes')
  for (const mission of engine.pipeRushScenarios) mission.stationIds.slice(1).forEach((to, index) => {
    const from = mission.stationIds[index]
    assert.ok((graph.transitGraph.neighbors.get(from) ?? []).some((edge) => edge.to === to), `${mission.id} uses only graph-backed edges`)
  })

  let state = engine.createPipeRushState()
  assert.equal(engine.isValidPipeRushMove(state, 'KRL_BOGOR:B07', 'MRT_NS'), false, 'wrong line cannot start a move')
  assert.equal(engine.isValidPipeRushMove(state, 'KRL_BOGOR:B06', 'KRL_BOGOR'), false, 'non-neighbor cannot start a move')
  const unchanged = engine.applyPipeRushMove(state, 'KRL_BOGOR:B07', 'TJ_1')
  assert.equal(unchanged, state, 'invalid move leaves state untouched')
  for (const stop of scenario.stationIds.slice(1)) state = engine.applyPipeRushMove(state, stop, 'KRL_BOGOR')
  assert.equal(state.stepsUsed, 7)
  assert.equal(engine.isPipeRushComplete(state), true)
  const perfect = engine.pipeRushSummary(state, 32000)
  assert.equal(perfect.stars, 3)
  assert.equal(perfect.score, 100)
  assert.equal(perfect.perfectBonus, 5)
  assert.equal(engine.starsForPipeRush(8), 2)
  assert.equal(engine.starsForPipeRush(9), 1)

  let backtrack = engine.createPipeRushState()
  backtrack = engine.applyPipeRushMove(backtrack, 'KRL_BOGOR:B07', 'KRL_BOGOR')
  backtrack = engine.applyPipeRushMove(backtrack, 'KRL_BOGOR:B08', 'KRL_BOGOR')
  backtrack = engine.applyPipeRushMove(backtrack, 'KRL_BOGOR:B07', 'KRL_BOGOR')
  for (const stop of scenario.stationIds.slice(2)) backtrack = engine.applyPipeRushMove(backtrack, stop, 'KRL_BOGOR')
  assert.equal(backtrack.stepsUsed, 9)
  assert.equal(engine.pipeRushSummary(backtrack, 60000).stars, 1)

  const transferScenario = engine.pipeRushScenarioById('jatinegara-kota')
  let transferState = engine.createPipeRushState(transferScenario)
  transferState = engine.applyPipeRushMove(transferState, 'KRL_CIKARANG_LOOP:C02', 'KRL_CIKARANG_LOOP', transferScenario)
  transferState = engine.applyPipeRushMove(transferState, 'KRL_CIKARANG_LOOP:C01', 'KRL_CIKARANG_LOOP', transferScenario)
  assert.equal(engine.isValidPipeRushMove(transferState, 'KRL_BOGOR:B07', 'KRL_CIKARANG_LOOP', transferScenario), false, 'transfer rejects the old line selection')
  assert.equal(engine.isValidPipeRushMove(transferState, 'KRL_BOGOR:B07', 'KRL_BOGOR', transferScenario), true, 'transfer accepts the destination line selection')

  const multimodalScenario = engine.pipeRushScenarioById('dukuh-blokm')
  let multimodalState = engine.createPipeRushState(multimodalScenario)
  assert.equal(engine.isValidPipeRushMove(multimodalState, 'MRT_NS:M12', 'LRT_JBDBK_BEKASI', multimodalScenario), false, 'multimodal transfer rejects the old service selection')
  assert.equal(engine.isValidPipeRushMove(multimodalState, 'MRT_NS:M12', 'MRT_NS', multimodalScenario), true, 'multimodal transfer accepts the destination service selection')
  for (const stop of multimodalScenario.stationIds.slice(1)) multimodalState = engine.applyPipeRushMove(multimodalState, stop, 'MRT_NS', multimodalScenario)
  const multimodalSummary = engine.pipeRushSummary(multimodalState, 44000, multimodalScenario)
  assert.deepEqual(multimodalSummary.serviceIds, ['LRT_JBDBK_BEKASI', 'MRT_NS'], 'result preserves both modes used in a transfer route')

  const migrated = storage.migrateProfile({ completed: ['pipe-dukuh', 'chain-blokm'] })
  assert.ok(!migrated.completed.includes('pipe-dukuh'), 'obsolete pipe completion is reset')
  assert.deepEqual(migrated.pipeRushBestTimesMs, {}, 'old profiles receive empty best-time storage')
  const first = storage.claimPipeRushReward(storage.defaultProfile, 'pipe-tebet-kota', scenario.id, 32000, 25)
  const completedProfile = { ...first.profile, completed: ['pipe-tebet-kota'] }
  const replay = storage.claimPipeRushReward(completedProfile, 'pipe-tebet-kota', scenario.id, 29000, 25)
  assert.equal(first.rewardEarned, 25, 'first completion earns XP')
  assert.equal(replay.rewardEarned, 0, 'replay earns no XP')
  assert.equal(replay.isNewBest, true, 'faster replay updates best time')
  assert.equal(replay.profile.pipeRushBestTimesMs[scenario.id], 29000)
  console.log('Pipe Rush engine contracts passed: graph validation, drag rules, scores, rewards, best times, and migration.')
} finally {
  await server.close()
}
