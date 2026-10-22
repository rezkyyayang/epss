export function formatDate(value?: string | Date | null) {
  if (!value) return 'Belum tersedia'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Belum tersedia'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function getApiError(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = (error as { data?: { statusMessage?: unknown } }).data
    if (typeof data?.statusMessage === 'string') return data.statusMessage
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}
