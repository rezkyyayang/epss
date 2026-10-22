interface ScoredResponse {
  maturityLevelId: string | null
  indicator: {
    weight: number
    maturityLevels: Array<{ id: string; level: number }>
    domain: { id: string; name: string; weight: number; position: number }
  }
}

export interface DomainScore { id: string; name: string; weight: number; score: number | null }

// Score = sum of (domain weight x sum of (indicator weight x chosen level)), with weights as fractions.
// A domain or the total stays null until every indicator under it has a level, so partial answers never look final.
export function weightedScore(responses: ScoredResponse[]) {
  const domains = new Map<string, DomainScore & { position: number; missing: boolean; sum: number }>()
  let maxLevel = 0
  for (const response of responses) {
    const { domain } = response.indicator
    const entry = domains.get(domain.id) || { id: domain.id, name: domain.name, weight: domain.weight, position: domain.position, missing: false, sum: 0, score: null }
    const level = response.indicator.maturityLevels.find(({ id }) => id === response.maturityLevelId)?.level
    maxLevel = Math.max(maxLevel, ...response.indicator.maturityLevels.map(({ level: value }) => value))
    if (level === undefined) entry.missing = true
    else entry.sum += response.indicator.weight / 100 * level
    domains.set(domain.id, entry)
  }
  const scored = [...domains.values()]
    .sort((a, b) => a.position - b.position)
    .map(({ id, name, weight, missing, sum }) => ({ id, name, weight, score: missing ? null : sum }))
  const total = scored.length && scored.every(({ score }) => score !== null)
    ? scored.reduce((sum, { weight, score }) => sum + weight / 100 * (score as number), 0)
    : null
  return { total, maxLevel, domains: scored }
}

// Scores Pusdatin's verified levels with the same formula: each response is read through its verification.
export function withFinalLevels<T extends { verification?: { maturityLevelId: string } | null }>(responses: T[]) {
  return responses.map((response) => ({ ...response, maturityLevelId: response.verification?.maturityLevelId ?? null }))
}

// Index predicate bands, defined for the 1 to 3 scale only. A catalog on another scale has no agreed
// bands, so its score gets no predicate.
export const predicateBands = [
  { min: 2.34, label: 'Memuaskan' },
  { min: 1.67, label: 'Cukup' },
  { min: 1, label: 'Kurang' },
] as const

// The band follows the score as displayed (two decimals), so the number and its label never disagree.
export function scorePredicate(total: number | null, maxLevel: number) {
  if (total === null || maxLevel !== 3) return null
  const shown = Number(total.toFixed(2))
  return predicateBands.find(({ min }) => shown >= min)?.label ?? null
}

export function levelOf(response: { maturityLevelId: string | null; indicator: { maturityLevels: Array<{ id: string; level: number }> } }) {
  return response.indicator.maturityLevels.find(({ id }) => id === response.maturityLevelId)?.level ?? null
}

export function formatScore(value: number) {
  return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}
