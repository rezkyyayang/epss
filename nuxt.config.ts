export default defineNuxtConfig({
  srcDir: 'app/',
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
      appName: 'SectOra',
    },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'id' },
      title: 'SectOra',
      meta: [
        { name: 'description', content: 'Penilaian dan pemeriksaan indikator internal.' },
        { name: 'theme-color', content: '#0B6470' },
      ],
    },
  },
  devtools: { enabled: false },
})
