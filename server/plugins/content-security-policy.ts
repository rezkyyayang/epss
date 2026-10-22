import { randomBytes } from 'node:crypto'

// Nuxt writes its runtime config and component styles as inline tags, so each page gets a
// fresh nonce instead of allowing 'unsafe-inline'. Only the generated head and tail chunks are
// tagged; the rendered body holds user text and is left untouched.
// The Vite dev server injects styles and an HMR socket that this policy would block, so it
// applies only to production builds. The anti-framing headers in security-headers.ts apply everywhere.
export default defineNitroPlugin((nitroApp) => {
  if (import.meta.dev) return

  nitroApp.hooks.hook('render:html', (html, { event }) => {
    const nonce = randomBytes(16).toString('base64')
    const addNonce = (chunk: string) => chunk.replace(/<(script|style)\b/g, `<$1 nonce="${nonce}"`)
    html.head = html.head.map(addNonce)
    html.bodyPrepend = html.bodyPrepend.map(addNonce)
    html.bodyAppend = html.bodyAppend.map(addNonce)

    setResponseHeader(event, 'Content-Security-Policy', [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}'`,
      `style-src 'self' 'nonce-${nonce}'`,
      // The progress bar sets its width through a style attribute.
      "style-src-attr 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '))
  })
})
