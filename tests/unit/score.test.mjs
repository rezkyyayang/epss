// Unit tests for the score helpers. Node 24 strips the TypeScript types on import.
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { scorePredicate, weightedScore } from '../../app/utils/score.ts'

describe('scorePredicate on the 1 to 3 scale', () => {
  const cases = [
    [3, 'Memuaskan'],
    [2.34, 'Memuaskan'],
    [2.339, 'Memuaskan'], // shown as 2,34
    [2.334, 'Cukup'], // shown as 2,33
    [2.33, 'Cukup'],
    [1.67, 'Cukup'],
    [1.666, 'Cukup'], // shown as 1,67
    [1.664, 'Kurang'], // shown as 1,66
    [1.66, 'Kurang'],
    [1, 'Kurang'],
  ]
  for (const [total, label] of cases) {
    test(`${total} is ${label}`, () => assert.equal(scorePredicate(total, 3), label))
  }

  test('no predicate before every indicator has a level', () => {
    assert.equal(scorePredicate(null, 3), null)
  })

  test('no predicate when the catalog does not use the 1 to 3 scale', () => {
    assert.equal(scorePredicate(2.5, 5), null)
    assert.equal(scorePredicate(1.5, 2), null)
  })
})

describe('scorePredicate with weightedScore', () => {
  const levels = [1, 2, 3].map((level) => ({ id: `L${level}`, level }))
  const domain = { id: 'D1', name: 'Domain', weight: 100, position: 0 }
  const answer = (weight, level) => ({ maturityLevelId: `L${level}`, indicator: { weight, maturityLevels: levels, domain } })

  test('a standard-scale assessment gets the predicate of its total', () => {
    const result = weightedScore([answer(50, 3), answer(50, 2)])
    assert.equal(result.maxLevel, 3)
    assert.equal(result.total, 2.5)
    assert.equal(scorePredicate(result.total, result.maxLevel), 'Memuaskan')
  })
})
