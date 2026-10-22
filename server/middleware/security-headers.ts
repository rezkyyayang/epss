export default defineEventHandler((event) => {
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
  setResponseHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin')
  if (event.path.startsWith('/api/')) {
    setResponseHeader(event, 'Cache-Control', 'private, no-store')
  }
})
