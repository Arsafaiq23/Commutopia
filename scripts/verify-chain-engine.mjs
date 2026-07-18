import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const server = await createServer({ appType: 'custom', server: { hmr: false, middlewareMode: true, ws: false } })

try {
  const engine = await server.ssrLoadModule('/src/chain-engine.ts')
  const storage = await server.ssrLoadModule('/src/storage.ts')
  const graph = await server.ssrLoadModule('/src/transit-graph.ts')
  const expectedIds = ['dukuh-blokm', 'kota-priok', 'dukuh-kota', 'jatinegara-kota', 'manggarai-bandara', 'cawang-bandara', 'dukuh-priok']

  assert.deepEqual(engine.chainScenarios.map((scenario) => scenario.id), expectedIds, 'the curated mission set should only contain decision-rich routes')
  for (const scenario of engine.chainScenarios) {
    assert.ok(scenario.legs.length > 0, `${scenario.id} has an optimal route`)
    assert.equal(scenario.legs[0].fromStationId, scenario.startStationId, `${scenario.id} optimal route starts at mission origin`)
    assert.equal(scenario.legs.at(-1).toStationId, scenario.endStationId, `${scenario.id} optimal route reaches mission target`)
    for (const decision of scenario.decisions) {
      assert.ok(decision.options.length >= 3 && decision.options.length <= 4, `${scenario.id} decisions expose exactly 3–4 choices`)
      assert.equal(decision.options.filter((option) => option.outcome === 'optimal').length, 1, `${scenario.id} has one optimal choice per decision`)
      assert.equal(new Set(decision.options.map((option) => option.id)).size, decision.options.length, `${scenario.id} choice ids are unique`)
      assert.deepEqual(engine.legsForDecision(scenario, decision.stationId), decision.options, `${scenario.id} looks choices up from the current decision node`)
      for (const option of decision.options) {
        assert.equal(option.fromStationId, decision.stationId, `${scenario.id} option begins at its decision node`)
        option.stationIds.slice(1).forEach((to, index) => {
          const from = option.stationIds[index]
          assert.ok((graph.transitGraph.neighbors.get(from) ?? []).some((edge) => edge.to === to), `${scenario.id} option ${option.id} is graph-backed`)
        })
      }
    }
  }

  const showcase = engine.chainScenarioById('jatinegara-kota')
  assert.ok(showcase, 'Jatinegara → Kota scenario exists')
  const atManggarai = engine.legsForDecision(showcase, 'KRL_CIKARANG_LOOP:C01')
  assert.ok(atManggarai.some((leg) => leg.outcome === 'optimal' && leg.serviceId === 'KRL_BOGOR'), 'Manggarai exposes the optimal Bogor transfer')
  assert.ok(atManggarai.some((leg) => leg.outcome === 'viable' && leg.toStationId === 'KRL_CIKARANG_LOOP:C03'), 'Manggarai exposes a real detour')
  assert.ok(atManggarai.some((leg) => leg.outcome === 'dead_end' && leg.serviceId === 'KRL_AIRPORT'), 'Manggarai exposes a real hard-break branch')

  const ui = await readFile(new URL('../src/chain-reaction.tsx', import.meta.url), 'utf8')
  assert.ok(ui.includes('3–4 RUTE NYATA'), 'the game renders a single direct choice panel')
  assert.ok(!ui.includes('selectedService'), 'the old choose-service state is removed')
  assert.ok(!ui.includes("phase === 'stop'"), 'the old second choice stage is removed')

  const migrated = storage.migrateProfile({ completed: ['chain-blokm'] })
  assert.ok(migrated.completedChainScenarioIds.includes('dukuh-blokm'), 'legacy chain completion migrates')
  const first = storage.claimChainScenarioReward(storage.defaultProfile, 'kota-priok', 100)
  const replay = storage.claimChainScenarioReward(first.profile, 'kota-priok', 100)
  assert.equal(first.rewardEarned, 100, 'first completion earns XP')
  assert.equal(replay.rewardEarned, 0, 'replay earns no extra XP')
  assert.equal(replay.profile.xp, first.profile.xp, 'replay leaves XP unchanged')
  console.log('Chain engine contracts passed: 7 curated routes, graph-backed 3–4 choice decisions, detours, hard breaks, migration, and replay rewards.')
} finally {
  await server.close()
}
