import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabase'

interface Settings {
  is_bot_active: boolean
  stop_words: string[]
  min_score: number
  active_sources: string[]
  telegram_chat_id: number | null
}

interface Props {
  session: Session
}

const ALL_SOURCES = [
  { key: 'freelancer-js',    label: 'Freelancer.com — JavaScript' },
  { key: 'freelancer-html',  label: 'Freelancer.com — HTML/CSS' },
  { key: 'freelancer-react', label: 'Freelancer.com — React.js' },
  { key: 'reddit-forhire',   label: 'Reddit r/forhire' },
]

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  page: {
    maxWidth: '680px',
    margin: '0 auto',
    padding: '40px 24px 80px',
  } as React.CSSProperties,
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '40px',
  } as React.CSSProperties,
  title: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#fff',
  } as React.CSSProperties,
  signOut: {
    background: 'none',
    border: '1px solid #2a2a2a',
    color: '#555',
    padding: '8px 14px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
  } as React.CSSProperties,
  card: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '14px',
    padding: '24px',
    marginBottom: '16px',
  } as React.CSSProperties,
  cardTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#888',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginBottom: '16px',
  },
  label: {
    fontSize: '14px',
    color: '#ccc',
    display: 'block',
    marginBottom: '8px',
  } as React.CSSProperties,
  input: {
    width: '100%',
    background: '#111',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    color: '#e5e5e5',
    padding: '10px 12px',
    fontSize: '14px',
    outline: 'none',
  } as React.CSSProperties,
  textarea: {
    width: '100%',
    background: '#111',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    color: '#e5e5e5',
    padding: '10px 12px',
    fontSize: '13px',
    fontFamily: 'monospace',
    resize: 'vertical' as const,
    outline: 'none',
    minHeight: '180px',
  } as React.CSSProperties,
  hint: {
    fontSize: '12px',
    color: '#444',
    marginTop: '6px',
  } as React.CSSProperties,
  toggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    cursor: 'pointer',
  } as React.CSSProperties,
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '10px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#ccc',
  } as React.CSSProperties,
  saveBtn: {
    background: '#22c55e',
    color: '#000',
    border: 'none',
    borderRadius: '10px',
    padding: '12px 28px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '8px',
  } as React.CSSProperties,
  saveBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  } as React.CSSProperties,
  message: (type: 'success' | 'error') => ({
    padding: '12px 16px',
    borderRadius: '10px',
    fontSize: '14px',
    marginBottom: '16px',
    background: type === 'success' ? '#052e16' : '#2d0b0b',
    color: type === 'success' ? '#22c55e' : '#f87171',
    border: `1px solid ${type === 'success' ? '#166534' : '#7f1d1d'}`,
  } as React.CSSProperties),
}

// ─── Toggle Switch ─────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: '52px',
        height: '28px',
        borderRadius: '14px',
        border: 'none',
        background: checked ? '#22c55e' : '#333',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        top: '3px',
        left: checked ? '27px' : '3px',
        width: '22px',
        height: '22px',
        borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.2s',
      }} />
    </button>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function SettingsPanel({ session }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [stopWordsText, setStopWordsText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('is_bot_active, stop_words, min_score, active_sources, telegram_chat_id')
      .eq('id', 1)
      .single()
      .then(({ data, error }) => {
        if (error) {
          setMsg({ type: 'error', text: error.message })
        } else {
          const s = data as Settings
          setSettings(s)
          setStopWordsText((s.stop_words ?? []).join('\n'))
        }
        setLoading(false)
      })
  }, [])

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => prev ? { ...prev, [key]: value } : prev)
  }

  function toggleSource(key: string, checked: boolean) {
    if (!settings) return
    const next = checked
      ? [...settings.active_sources, key]
      : settings.active_sources.filter((s) => s !== key)
    update('active_sources', next)
  }

  async function handleSave() {
    if (!settings) return
    setSaving(true)
    setMsg(null)

    const stop_words = stopWordsText
      .split('\n')
      .map((w) => w.trim())
      .filter(Boolean)

    const { error } = await supabase
      .from('app_settings')
      .update({
        is_bot_active: settings.is_bot_active,
        stop_words,
        min_score: settings.min_score,
        active_sources: settings.active_sources,
      })
      .eq('id', 1)

    setSaving(false)
    if (error) {
      setMsg({ type: 'error', text: error.message })
    } else {
      update('stop_words', stop_words)
      setMsg({ type: 'success', text: 'Збережено успішно!' })
      setTimeout(() => setMsg(null), 3000)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>
        Завантаження...
      </div>
    )
  }

  if (!settings) return null

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={s.title}>Freelance Monitor</div>
          <div style={{ fontSize: '13px', color: '#555', marginTop: '2px' }}>{session.user.email}</div>
        </div>
        <button style={s.signOut} onClick={() => supabase.auth.signOut()}>
          Вийти
        </button>
      </div>

      {msg && <div style={s.message(msg.type)}>{msg.text}</div>}

      {/* Telegram connection status */}
      <div style={s.card}>
        <div style={s.cardTitle}>Telegram</div>
        {settings.telegram_chat_id ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '20px' }}>✅</span>
            <div>
              <div style={{ fontSize: '14px', color: '#22c55e', fontWeight: 600 }}>Підключено</div>
              <div style={{ fontSize: '12px', color: '#444', marginTop: '2px' }}>chat_id: {settings.telegram_chat_id}</div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <div>
              <div style={{ fontSize: '14px', color: '#f59e0b', fontWeight: 600 }}>Не підключено</div>
              <div style={{ fontSize: '12px', color: '#444', marginTop: '2px' }}>
                Напиши <code style={{ color: '#888' }}>/start</code> своєму боту — він автоматично збереже твій chat_id
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bot toggle */}
      <div style={s.card}>
        <div style={s.cardTitle}>Головний рубильник</div>
        <label style={{ ...s.toggle }}>
          <Toggle
            checked={settings.is_bot_active}
            onChange={(v) => update('is_bot_active', v)}
          />
          <div>
            <div style={{ fontSize: '15px', color: settings.is_bot_active ? '#22c55e' : '#888', fontWeight: 600 }}>
              {settings.is_bot_active ? 'Бот увімкнений' : 'Бот вимкнений'}
            </div>
            <div style={{ fontSize: '12px', color: '#444', marginTop: '2px' }}>
              Якщо вимкнено — пайплайн завершується одразу без зайвих запитів
            </div>
          </div>
        </label>
      </div>

      {/* Active sources */}
      <div style={s.card}>
        <div style={s.cardTitle}>Активні джерела</div>
        {ALL_SOURCES.map(({ key, label }) => (
          <label key={key} style={s.checkbox}>
            <input
              type="checkbox"
              checked={settings.active_sources.includes(key)}
              onChange={(e) => toggleSource(key, e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: '#22c55e', cursor: 'pointer' }}
            />
            {label}
          </label>
        ))}
      </div>

      {/* Min score */}
      <div style={s.card}>
        <div style={s.cardTitle}>Поріг AI-скорингу</div>
        <label style={s.label}>
          Мінімальний бал (0–100)
          <input
            type="number"
            min={0}
            max={100}
            value={settings.min_score}
            onChange={(e) => update('min_score', parseInt(e.target.value, 10) || 0)}
            style={{ ...s.input, marginTop: '8px', width: '120px' }}
          />
        </label>
        <div style={s.hint}>Вакансії з балом нижче цього порогу відхиляються AI-скорером</div>
      </div>

      {/* Stop words */}
      <div style={s.card}>
        <div style={s.cardTitle}>Стоп-слова</div>
        <label style={s.label}>Одне слово або фраза на рядок</label>
        <textarea
          value={stopWordsText}
          onChange={(e) => setStopWordsText(e.target.value)}
          style={s.textarea}
          spellCheck={false}
        />
        <div style={s.hint}>
          Вакансії, що містять будь-яке з цих слів у заголовку або описі, відхиляються на етапі префільтрації
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        style={{ ...s.saveBtn, ...(saving ? s.saveBtnDisabled : {}) }}
      >
        {saving ? 'Збереження...' : 'Зберегти налаштування'}
      </button>
    </div>
  )
}
