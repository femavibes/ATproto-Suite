import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { evaluateGraph } from '../src/utils/graphEvaluator.js'

const fixturesDir = path.resolve(process.cwd(), '..', '..', 'fixtures', 'engine')
const fixtureFiles = fs
  .readdirSync(fixturesDir)
  .filter((f) => f.endsWith('.json'))
  .sort()

for (const fixtureFile of fixtureFiles) {
  test(`engine fixture: ${fixtureFile}`, () => {
    const payload = JSON.parse(fs.readFileSync(path.join(fixturesDir, fixtureFile), 'utf8'))
    const result = evaluateGraph(payload.graph.nodes, payload.graph.edges, payload.post)
    const expected = payload.expected.js

    assert.equal(result.passed, expected.passed)
    assert.equal(result.score, expected.score)

    if (expected.endId) {
      assert.ok(result.results.has(expected.endId), `expected END result for ${expected.endId}`)
    }
  })
}
