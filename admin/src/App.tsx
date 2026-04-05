import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import Login from './components/Login'
import SettingsPanel from './components/SettingsPanel'
import StatsPanel from './components/StatsPanel'
import JobsPanel from './components/JobsPanel'

type Tab = 'settings' | 'jobs' | 'stats'

const TABS: { key: Tab; label: string }[] = [
  { key: 'settings', label: '⚙️ Налаштування' },
  { key: 'jobs',     label: '📋 Вакансії' },
  { key: 'stats',    label: '📊 Статистика' },
]

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('settings')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>
        ...
      </div>
    )
  }

  if (!session) return <Login />

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Top nav */}
      <div style={nav.bar}>
        <div style={nav.inner}>
          <span style={nav.brand}>Freelance Monitor</span>
          <div style={nav.tabs}>
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{ ...nav.tab, ...(tab === t.key ? nav.tabActive : {}) }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            style={nav.signOut}
          >
            Вийти
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ paddingTop: 8 }}>
        {tab === 'settings' && <SettingsPanel session={session} />}
        {tab === 'jobs'     && <JobsPanel />}
        {tab === 'stats'    && <StatsPanel />}
      </div>
    </div>
  )
}

const nav: Record<string, React.CSSProperties> = {
  bar: { background: '#fff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 10 },
  inner: { maxWidth: 960, margin: '0 auto', padding: '0 16px', display: 'flex', alignItems: 'center', gap: 8, height: 52 },
  brand: { fontWeight: 700, fontSize: 15, color: '#111', marginRight: 8, whiteSpace: 'nowrap' },
  tabs: { display: 'flex', gap: 2, flex: 1 },
  tab: { padding: '6px 14px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: '#6b7280', fontFamily: 'inherit', transition: 'all .15s' },
  tabActive: { background: '#f3f4f6', color: '#111', fontWeight: 600 },
  signOut: { marginLeft: 'auto', padding: '5px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#9ca3af', fontFamily: 'inherit' },
}
