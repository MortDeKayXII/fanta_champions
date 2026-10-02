import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { teamEmail } from './slug'
import type { Profile } from './types'

interface AuthState {
  /** true until the stored session (if any) has been read */
  loading: boolean
  session: Session | null
  profile: Profile | null
  signIn: (teamName: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  changePassword: (password: string) => Promise<string | null>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId!)
        .single()
      if (error) throw error
      return data as Profile
    },
  })

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      profile: userId ? (profile ?? null) : null,
      async signIn(teamName, password) {
        const { error } = await supabase.auth.signInWithPassword({
          email: teamEmail(teamName),
          password,
        })
        if (!error) return null
        return error.message === 'Invalid login credentials'
          ? 'Nome squadra o password non corretti.'
          : 'Accesso non riuscito, riprova più tardi.'
      },
      async signOut() {
        await supabase.auth.signOut()
        queryClient.clear()
      },
      async changePassword(password) {
        const { error } = await supabase.auth.updateUser({ password })
        return error ? 'Impossibile cambiare la password: ' + error.message : null
      },
    }),
    [loading, session, userId, profile, queryClient],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
