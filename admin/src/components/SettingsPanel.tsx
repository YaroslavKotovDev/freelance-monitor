import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabase'

interface Settings {
  is_bot_active: boolean
  stop_words: string[]
  min_score: number
  active_sources: string[]
  telegram_chat_id: number | null
  llm_provider: string | null
  llm_api_key: string | null
  llm_model: string | null
  developer_profile: string | null
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
      .select('is_bot_active, stop_words, min_score, active_sources, telegram_chat_id, llm_provider, llm_api_key, llm_model, developer_profile')
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
        llm_provider: settings.llm_provider || null,
        llm_api_key: settings.llm_api_key || null,
        llm_model: settings.llm_model || null,
        developer_profile: settings.developer_profile || null,
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

  const missingFields: string[] = []
  if (!settings.telegram_chat_id) missingFields.push('Telegram не підключено — надішли /start боту')
  if (!settings.llm_provider)     missingFields.push('Провайдер AI не обраний')
  if (!settings.llm_api_key)      missingFields.push('API Key не вказано')
  if (!settings.llm_model)        missingFields.push('Модель не вказана')
  if ((settings.active_sources ?? []).length === 0) missingFields.push('Жодне джерело не активоване')

  const canActivate = missingFields.length === 0

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

      {/* Missing fields banner */}
      {missingFields.length > 0 && (
        <div style={{
          background: '#1c1500',
          border: '1px solid #78350f',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '16px',
        }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#f59e0b', marginBottom: '10px' }}>
            ⚠️ Бот не може запуститись — заповніть обов'язкові поля:
          </div>
          {missingFields.map((f) => (
            <div key={f} style={{ fontSize: '13px', color: '#92400e', marginBottom: '4px' }}>✗ {f}</div>
          ))}
        </div>
      )}

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
        <label style={{ ...s.toggle, opacity: canActivate ? 1 : 0.4, cursor: canActivate ? 'pointer' : 'not-allowed' }}>
          <Toggle
            checked={settings.is_bot_active}
            onChange={(v) => { if (canActivate) update('is_bot_active', v) }}
          />
          <div>
            <div style={{ fontSize: '15px', color: settings.is_bot_active ? '#22c55e' : '#888', fontWeight: 600 }}>
              {settings.is_bot_active ? 'Бот увімкнений' : 'Бот вимкнений'}
            </div>
            <div style={{ fontSize: '12px', color: '#444', marginTop: '2px' }}>
              {canActivate
                ? 'Якщо вимкнено — пайплайн завершується одразу без зайвих запитів'
                : 'Заповніть усі обов\'язкові поля щоб увімкнути бота'}
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

      {/* LLM settings */}
      <div style={s.card}>
        <div style={s.cardTitle}>AI / LLM</div>

        <label style={s.label}>
          Провайдер
          <select
            value={settings.llm_provider ?? ''}
            onChange={(e) => update('llm_provider', e.target.value || null)}
            style={{ ...s.input, marginTop: '8px', cursor: 'pointer' }}
          >
            <option value="">— оберіть —</option>
            <option value="openai">OpenAI</option>
            <option value="openrouter">OpenRouter</option>
          </select>
        </label>

        <label style={{ ...s.label, marginTop: '16px' }}>
          API Key
          <input
            type="password"
            value={settings.llm_api_key ?? ''}
            onChange={(e) => update('llm_api_key', e.target.value || null)}
            placeholder="sk-..."
            style={{ ...s.input, marginTop: '8px' }}
          />
        </label>

        <label style={{ ...s.label, marginTop: '16px' }}>
          Модель
          <input
            type="text"
            value={settings.llm_model ?? ''}
            onChange={(e) => update('llm_model', e.target.value || null)}
            placeholder="gpt-4.1-mini або openai/gpt-4.1-mini"
            style={{ ...s.input, marginTop: '8px' }}
          />
        </label>
        <div style={s.hint}>
          OpenAI: <code style={{ color: '#666' }}>gpt-4.1-mini</code> &nbsp;·&nbsp;
          OpenRouter: <code style={{ color: '#666' }}>openai/gpt-4.1-mini</code>
        </div>
      </div>

      {/* Developer profile for cover letters */}
      <div style={s.card}>
        <div style={s.cardTitle}>Профіль розробника</div>
        <label style={s.label}>Використовується для генерації відгуків на вакансії (кнопка ✍️ Написати відгук)</label>
        <textarea
          value={settings.developer_profile ?? ''}
          onChange={(e) => update('developer_profile', e.target.value || null)}
          placeholder={`Приклад:\n4+ роки досвіду Full-Stack розробки. Стек: TypeScript, React, Node.js, PostgreSQL.\nПрацюю в FAVBET TECH над high-load маркетинговими платформами (мільярди записей).\nРаніше в SOLUTION MENTORS: створив AI-чатбота (скоротив час відповіді на 97%), прискорив деплой у 3 рази.\nMaster's Degree in Computer Science.`}
          style={{ ...s.textarea, minHeight: '140px', marginTop: '8px' }}
          spellCheck={false}
        />
        <div style={s.hint}>Чим конкретніше — тим кращий відгук. Вказуй цифри, технології, конкретні результати.</div>
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
