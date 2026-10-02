import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import { setToken } from '../api/client'
import { ADMIN_ROLES, SELLER_ROLES } from '../lib/constants'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['me'], queryFn: api.auth.me, staleTime: 5 * 60_000 })
  const user = data?.user ?? null
  const [prompt, setPrompt] = useState(null) // { reason, onSuccess }
  const pendingRef = useRef(null)

  const afterAuth = useCallback(
    async (res) => {
      if (res.token) setToken(res.token)
      qc.setQueryData(['me'], { user: res.user })
      await qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'me' })
      const pending = pendingRef.current
      pendingRef.current = null
      setPrompt(null)
      if (pending) setTimeout(() => pending(res.user), 0)
      return res.user
    },
    [qc],
  )

  const login = useCallback(async (body) => afterAuth(await api.auth.login(body)), [afterAuth])
  const register = useCallback(async (body) => afterAuth(await api.auth.register(body)), [afterAuth])
  const logout = useCallback(async () => {
    try {
      await api.auth.logout()
    } finally {
      setToken(null)
      qc.setQueryData(['me'], { user: null })
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' && q.queryKey[0] !== 'taxonomy' })
    }
  }, [qc])

  /** Runs `action` now if signed in, otherwise opens the sign-in prompt and runs it after. */
  const requireAuth = useCallback(
    (reason, action) => {
      if (user) {
        action?.(user)
        return true
      }
      pendingRef.current = action || null
      setPrompt({ reason })
      return false
    },
    [user],
  )

  const value = useMemo(
    () => ({
      user,
      loading: isLoading,
      isAdmin: !!user && ADMIN_ROLES.includes(user.role),
      isSeller: !!user && SELLER_ROLES.includes(user.role),
      isDealer: !!user?.dealer,
      login,
      register,
      logout,
      requireAuth,
      prompt,
      closePrompt: () => {
        pendingRef.current = null
        setPrompt(null)
      },
      refresh: () => qc.invalidateQueries({ queryKey: ['me'] }),
    }),
    [user, isLoading, login, register, logout, requireAuth, prompt, qc],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
