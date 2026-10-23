export interface ArchiveDocument {
  id: string
  type: string
  title: string
  year: number
  url: string
  updatedAt: string
}

// Groups by document type, types in alphabetical order, newest year first inside each group.
export function groupArchive(documents: ArchiveDocument[]) {
  const groups = new Map<string, ArchiveDocument[]>()
  for (const item of documents) groups.set(item.type, [...(groups.get(item.type) ?? []), item])
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'id'))
    .map(([type, items]) => ({ type, documents: items.sort((a, b) => b.year - a.year || a.title.localeCompare(b.title, 'id')) }))
}

// A short name for where the link opens, so readers know before clicking whether they need a LAN sign-in.
export function linkSource(url: string) {
  try {
    const host = new URL(url).hostname
    if (host === 'drive.google.com' || host === 'docs.google.com') return 'Google Drive'
    if (host.endsWith('.sharepoint.com')) return 'SharePoint'
    return host.replace(/^www\./, '')
  } catch {
    return ''
  }
}
