// Unit tests for the score helpers. Node 24 strips the TypeScript types on import.
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { scorePredicate, weightedScore } from '../../app/utils/score.ts'

describe('scorePredicate on the 1 to 5 scale', () => {
  const cases = [
    [5, 'Memuaskan'],
    [4.2, 'Memuaskan'],
    [4.195, 'Memuaskan'], // shown as 4,20
    [4.19, 'Sangat Baik'],
    [3.5, 'Sangat Baik'],
    [3.49, 'Baik'],
    [2.6, 'Baik'],
    [2.594, 'Cukup'], // shown as 2,59
    [1.8, 'Cukup'],
    [1.79, 'Kurang'],
    [1, 'Kurang'],
  ]
  for (const [total, label] of cases) {
    test(`${total} is ${label}`, () => assert.equal(scorePredicate(total, 5), label))
  }

  test('no predicate before every indicator has a level', () => {
    assert.equal(scorePredicate(null, 5), null)
  })

  test('no predicate when the catalog does not use the 1 to 5 scale', () => {
    assert.equal(scorePredicate(2.5, 3), null)
    assert.equal(scorePredicate(1.5, 2), null)
  })
})

describe('scorePredicate with weightedScore', () => {
  const levels = [1, 2, 3, 4, 5].map((level) => ({ id: `L${level}`, level }))
  const domain = { id: 'D1', name: 'Domain', weight: 100, position: 0 }
  const answer = (weight, level) => ({ maturityLevelId: `L${level}`, indicator: { weight, maturityLevels: levels, domain } })

  test('a standard-scale assessment gets the predicate of its total', () => {
    const result = weightedScore([answer(50, 5), answer(50, 4)])
    assert.equal(result.maxLevel, 5)
    assert.equal(result.total, 4.5)
    assert.equal(scorePredicate(result.total, result.maxLevel), 'Memuaskan')
  })
})
