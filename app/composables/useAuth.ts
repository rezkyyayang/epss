export interface SessionUser {
  id: string
  displayName: string
  email: string
  role: 'ADMIN' | 'USER'
  memberships: Array<{ id: string; name: string; code: string }>
}

export function useAuth() {
  const user = useState<SessionUser | null>('auth:user', () => null)
  const loaded = useState('auth:loaded', () => false)
  const loading = useState('auth:loading', () => false)
  const requestFetch = useRequestFetch()

  async function load() {
    if (loaded.value || loading.value) return user.value
    loading.value = true
    try {
      const result = await requestFetch<{ user: SessionUser }>('/api/auth/me')
      user.value = result.user
    } catch {
      user.value = null
    } finally {
      loaded.value = true
      loading.value = false
    }
    return user.value
  }

  // Memberships change when an Admin creates a unit, so callers can re-read the session.
  async function refresh() {
    loaded.value = false
    return load()
  }

  async function login(email: string, password: string) {
    const result = await $fetch<{ user: SessionUser }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    user.value = result.user
    loaded.value = true
    return result.user
  }

  async function logout() {
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      user.value = null
      loaded.value = true
      await navigateTo('/login')
    }
  }

  return { user, loaded, loading, load, refresh, login, logout }
}
