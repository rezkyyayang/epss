export default defineEventHandler((event) => {
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
  setResponseHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin')
  // Baseline for every response; production pages replace it with the full policy from the CSP plugin.
  setResponseHeader(event, 'Content-Security-Policy', "frame-ancestors 'none'")
  setResponseHeader(event, 'X-Frame-Options', 'DENY')
  if (event.path.startsWith('/api/')) {
    setResponseHeader(event, 'Cache-Control', 'private, no-store')
  }
})
