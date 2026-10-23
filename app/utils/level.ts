// "Level 2. Tersedia Landasan Kebijakan" when the catalog names the level, "Level 2" when it does not.
export function levelName(level: { level: number; title?: string | null }) {
  return level.title ? `Level ${level.level}. ${level.title}` : `Level ${level.level}`
}
