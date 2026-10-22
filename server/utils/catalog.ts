export const minLevels = 2
export const maxLevels = 5

interface LevelShape { level: number }
interface IndicatorShape { weight: number; maturityLevels: LevelShape[] }
interface DomainShape { weight: number; indicators: IndicatorShape[] }

// Levels must run 1, 2, ... N without gaps so a level number reads the same on every indicator.
export function hasValidLevels(indicator: { maturityLevels: LevelShape[] }) {
  const levels = indicator.maturityLevels.map(({ level }) => level).sort((a, b) => a - b)
  return levels.length >= minLevels && levels.length <= maxLevels && levels.every((level, index) => level === index + 1)
}

export function sumWeights(items: Array<{ weight: number }>) {
  return items.reduce((sum, { weight }) => sum + weight, 0)
}

export function isCatalogReady(domains: DomainShape[]) {
  return domains.length > 0
    && sumWeights(domains) === 100
    && domains.every((domain) => domain.indicators.length > 0
      && sumWeights(domain.indicators) === 100
      && domain.indicators.every(hasValidLevels))
}
