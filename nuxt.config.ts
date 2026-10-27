export default defineNuxtConfig({
  srcDir: 'app/',
  dir: {
    public: '../public',
  },
  serverDir: 'server',
  css: ['~/assets/css/main.css'],
  modules: [],
  typescript: {
    strict: true,
    typeCheck: false,
  },
  runtimeConfig: {
    sessionCookieName: 'sectora_session',
    sessionDurationHours: 12,
    public: {
      appName: 'Monastik',
    },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'id' },
      title: 'Monastik',
      meta: [
        { name: 'description', content: 'Monitoring Indeks Pembangunan Statistik LANRI' },
        { name: 'theme-color', content: '#174A8B' },
      ],
      link: [{ rel: 'icon', type: 'image/png', href: '/lan-ri-favicon.png' }],
    },
  },
  devtools: { enabled: false },
  // The Node server sends static files as-is, so ship gzip and brotli copies built ahead of time.
  nitro: {
    compressPublicAssets: true,
  },
})
