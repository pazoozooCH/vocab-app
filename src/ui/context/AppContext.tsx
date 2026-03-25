/* eslint-disable react-refresh/only-export-components -- hooks co-exported with provider is standard React pattern */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
} from 'react'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { SupabaseWordRepository } from '../../infrastructure/supabase/SupabaseWordRepository'
import { SupabaseDeckRepository } from '../../infrastructure/supabase/SupabaseDeckRepository'
import { FetchTranslationService } from '../../infrastructure/api/FetchTranslationService'
import type { WordRepository } from '../../application/ports/WordRepository'
import type { DeckRepository } from '../../application/ports/DeckRepository'
import type { TranslationService } from '../../application/ports/TranslationService'

interface AppServices {
  wordRepository: WordRepository
  deckRepository: DeckRepository
  translationService: TranslationService
  supabase: SupabaseClient
}

interface AuthState {
  user: User | null
  loading: boolean
  authorized: boolean | null // null = checking, true = allowed, false = blocked
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

interface AppContextValue {
  services: AppServices
  auth: AuthState
}

const AppContext = createContext<AppContextValue | null>(null)

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState<boolean | null>(null)

  const supabase = useMemo(
    () => createClient(supabaseUrl, supabaseAnonKey),
    [],
  )

  const services = useMemo<AppServices>(() => {
    const wordRepository = new SupabaseWordRepository(supabase)
    const deckRepository = new SupabaseDeckRepository(supabase)
    const translationService = new FetchTranslationService(
      '',
      async () => {
        const { data } = await supabase.auth.getSession()
        return data.session?.access_token ?? null
      },
    )
    return { wordRepository, deckRepository, translationService, supabase }
  }, [supabase])

  // Check whitelist when user changes
  useEffect(() => {
    if (!user?.email) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset auth state when user logs out
      setAuthorized(null)
      return
    }
    supabase
      .from('allowed_users')
      .select('email')
      .eq('email', user.email)
      .single()
      .then(({ data }) => {
        setAuthorized(!!data)
      })
  }, [user, supabase])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      },
    )

    return () => subscription.unsubscribe()
  }, [supabase])

  const auth: AuthState = useMemo(
    () => ({
      user,
      loading,
      authorized,
      signIn: async () => {
        await supabase.auth.signInWithOAuth({ provider: 'google' })
      },
      signOut: async () => {
        await supabase.auth.signOut()
      },
    }),
    [user, loading, authorized, supabase],
  )

  return (
    <AppContext.Provider value={{ services, auth }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAuth must be used within AppProvider')
  return ctx.auth
}

export function useServices(): AppServices {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useServices must be used within AppProvider')
  return ctx.services
}
