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
  // ofetch reports a request that never reached the server as "<no response> Failed to fetch".
  // That raw text means nothing to staff, so say what happened instead.
  if (error instanceof Error && /<no response>|failed to fetch|fetch failed|networkerror/i.test(error.message)) {
    return 'Server tidak dapat dihubungi. Periksa koneksi Anda, lalu coba lagi.'
  }
  return fallback
}
