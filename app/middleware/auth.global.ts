export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path.startsWith('/api/')) return
  if (to.path === '/home' || to.path === '/pusat-bantuan' || to.path === '/login') return

  const auth = useAuth()
  const user = await auth.load()

  if (!user) {
    return navigateTo({ path: '/login', query: to.path === '/' ? undefined : { redirect: to.fullPath } })
  }

  if (to.path.startsWith('/admin') && user.role !== 'ADMIN') return navigateTo('/user/dashboard')
  if (to.path.startsWith('/user') && user.role !== 'USER') return navigateTo('/admin/dashboard')
  if (to.path === '/') return navigateTo(user.role === 'ADMIN' ? '/admin/dashboard' : '/user/dashboard')
})
