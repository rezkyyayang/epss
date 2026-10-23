// Unit tests for the self-service password rules. Node 24 strips the TypeScript types on import.
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { unmetPasswordRules } from '../../app/utils/passwordPolicy.ts'

describe('unmetPasswordRules', () => {
  test('accepts 8 characters with a letter, a digit, and a symbol', () => {
    assert.deepEqual(unmetPasswordRules('lanri#25'), [])
  })

  const cases = [
    ['lan#25', ['Minimal 8 karakter']],
    ['lanriabc#', ['Memuat angka']],
    ['lanriab25', ['Memuat simbol, misalnya ! @ # atau -']],
    ['12345678#', ['Memuat huruf']],
    ['lanri 25x', ['Memuat simbol, misalnya ! @ # atau -']], // a space is not a symbol
    ['', ['Minimal 8 karakter', 'Memuat huruf', 'Memuat angka', 'Memuat simbol, misalnya ! @ # atau -']],
  ]
  for (const [value, expected] of cases) {
    test(`"${value}" misses ${expected.length} rule(s)`, () => assert.deepEqual(unmetPasswordRules(value), expected))
  }
})
