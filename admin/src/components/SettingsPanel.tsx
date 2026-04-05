import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabase'

interface SourceHealth {
  ok: boolean
  last_run: string
  error: string | null
}

interface Settings {
  is_bot_active: boolean
  stop_words: string[]
  min_score: number
  min_budget_usd: number
  active_sources: string[]
  telegram_chat_id: number | null
  llm_provider: string | null
  llm_api_key: string | null
  llm_model: string | null
  developer_profile: string | null
  source_health: Record<string, SourceHealth> | null
}

interface Props {
  session: Session
}

const ALL_SOURCES = [
  { key: 'freelancer-react',      label: 'Freelancer.com — React' },
  { key: 'freelancer-typescript', label: 'Freelancer.com — TypeScript' },
  { key: 'freelancer-vue',        label: 'Freelancer.com — Vue.js' },
  { key: 'freelancer-nextjs',     label: 'Freelancer.com — Next.js' },
  { key: 'freelancer-nodejs',     label: 'Freelancer.com — Node.js' },
  { key: 'pph-js',                label: 'PeoplePerHour — JavaScript' },
  { key: 'pph-react',             label: 'PeoplePerHour — React' },
  { key: 'guru-react',            label: 'Guru.com — React' },
  { key: 'guru-nodejs',           label: 'Guru.com — Node.js' },
  { key: 'upwork-react',          label: 'Upwork — React' },
  { key: 'upwork-typescript',     label: 'Upwork — TypeScript' },
  { key: 'upwork-vue',            label: 'Upwork — Vue.js' },
  { key: 'upwork-nodejs',         label: 'Upwork — Node.js' },
  { key: 'reddit-forhire',        label: 'Reddit r/forhire' },
  { key: 'reddit-slavelabour',    label: 'Reddit r/slavelabour' },
  { key: 'hn-hiring',             label: 'Hacker News — Who is Hiring' },
]

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: '680px',
    margin: '0 auto',
    padding: '24px 16px 80px',
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '20px 24px',
    marginBottom: '14px',
  },
  cardTitle: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '16px',
  },
  label: {
    fontSize: '13px',
    color: '#374151',
    display: 'block',
    marginBottom: '8px',
    fontWeight: 500,
  },
  input: {
    width: '100%',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    color: '#111',
    padding: '9px 12px',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    color: '#111',
    padding: '10px 12px',
    fontSize: '13px',
    fontFamily: 'inherit',
    resize: 'vertical',
    outline: 'none',
    minHeight: '160px',
    boxSizing: 'border-box',
  },
  hint: {
    fontSize: '12px',
    color: '#9ca3af',
    marginTop: '6px',
  },
  toggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    cursor: 'pointer',
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '10px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#374151',
  },
  saveBtn: {
    background: '#111',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    padding: '12px 28px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '8px',
  },
  saveBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
}

function message(type: 'success' | 'error'): React.CSSProperties {
  return {
    padding: '12px 16px',
    borderRadius: '10px',
    fontSize: '14px',
    marginBottom: '14px',
    background: type === 'success' ? '#f0fdf4' : '#fef2f2',
    color: type === 'success' ? '#15803d' : '#dc2626',
    border: `1px solid ${type === 'success' ? '#bbf7d0' : '#fecaca'}`,
  }
}

// ─── Toggle Switch ─────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: '46px',
        height: '26px',
        borderRadius: '13px',
        border: 'none',
        background: checked ? '#22c55e' : '#d1d5db',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        top: '3px',
        left: checked ? '23px' : '3px',
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,.2)',
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
      .select('is_bot_active, stop_words, min_score, min_budget_usd, active_sources, telegram_chat_id, llm_provider, llm_api_key, llm_model, developer_profile, source_health')
      .eq('id', 1)
      .single()
      .then(({ data, error }) => {
        if (error) {
          setMsg({ type: 'error', text: error.message })
        } else {
          const d = data as Settings
          setSettings(d)
          setStopWordsText((d.stop_words ?? []).join('\n'))
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
      : settings.active_sources.filter((k) => k !== key)
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
        min_budget_usd: settings.min_budget_usd,
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, color: '#9ca3af' }}>
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
      {/* User email row */}
      <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>
        {session.user.email}
      </div>

      {/* Missing fields banner */}
      {missingFields.length > 0 && (
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fcd34d',
          borderRadius: '12px',
          padding: '14px 18px',
          marginBottom: '14px',
        }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#b45309', marginBottom: '8px' }}>
            ⚠️ Бот не може запуститись — заповніть обов'язкові поля:
          </div>
          {missingFields.map((f) => (
            <div key={f} style={{ fontSize: '13px', color: '#92400e', marginBottom: '4px' }}>✗ {f}</div>
          ))}
        </div>
      )}

      {msg && <div style={message(msg.type)}>{msg.text}</div>}

      {/* Telegram */}
      <div style={s.card}>
        <div style={s.cardTitle}>Telegram</div>
        {settings.telegram_chat_id ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 20 }}>✅</span>
            <div>
              <div style={{ fontSize: 14, color: '#15803d', fontWeight: 600 }}>Підключено</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>chat_id: {settings.telegram_chat_id}</div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 14, color: '#d97706', fontWeight: 600 }}>Не підключено</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                Надішли <code style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: 4 }}>/start</code> своєму боту — він збереже chat_id автоматично
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
            <div style={{ fontSize: 14, color: settings.is_bot_active ? '#15803d' : '#6b7280', fontWeight: 600 }}>
              {settings.is_bot_active ? 'Бот увімкнений' : 'Бот вимкнений'}
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
          {ALL_SOURCES.map(({ key, label }) => {
            const h = settings.source_health?.[key]
            const dot = !h ? null : h.ok
              ? <span title="Працює" style={{ color: '#22c55e', fontSize: 10 }}>●</span>
              : <span title={h.error ?? 'Помилка'} style={{ color: '#ef4444', fontSize: 10 }}>●</span>
            return (
              <label key={key} style={s.checkbox}>
                <input
                  type="checkbox"
                  checked={settings.active_sources.includes(key)}
                  onChange={(e) => toggleSource(key, e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: '#22c55e', cursor: 'pointer', flexShrink: 0 }}
                />
                {label}
                {dot && <span style={{ marginLeft: 4 }}>{dot}</span>}
              </label>
            )
          })}
        </div>
        <div style={{ ...s.hint, marginTop: 10 }}>● зелений — ОК, ● червоний — помилка на останньому запуску</div>
      </div>

      {/* LLM settings */}
      <div style={s.card}>
        <div style={s.cardTitle}>AI / LLM</div>

        <label style={s.label}>
          Провайдер
          <select
            value={settings.llm_provider ?? ''}
            onChange={(e) => update('llm_provider', e.target.value || null)}
            style={{ ...s.input, marginTop: 6, cursor: 'pointer' }}
          >
            <option value="">— оберіть —</option>
            <option value="openai">OpenAI</option>
            <option value="openrouter">OpenRouter</option>
          </select>
        </label>

        <label style={{ ...s.label, marginTop: 14 }}>
          API Key
          <input
            type="password"
            value={settings.llm_api_key ?? ''}
            onChange={(e) => update('llm_api_key', e.target.value || null)}
            placeholder="sk-..."
            style={{ ...s.input, marginTop: 6 }}
          />
        </label>

        <label style={{ ...s.label, marginTop: 14 }}>
          Модель
          <input
            type="text"
            value={settings.llm_model ?? ''}
            onChange={(e) => update('llm_model', e.target.value || null)}
            placeholder="gpt-4.1-mini або openai/gpt-4.1-mini"
            style={{ ...s.input, marginTop: 6 }}
          />
        </label>
        <div style={s.hint}>
          OpenAI: <code>gpt-4.1-mini</code> · OpenRouter: <code>openai/gpt-4.1-mini</code>
        </div>
      </div>

      {/* Developer profile */}
      <div style={s.card}>
        <div style={s.cardTitle}>Профіль розробника</div>
        <div style={{ ...s.hint, marginBottom: 10 }}>
          Використовується для генерації відгуків на вакансії (кнопка ✍️ у Telegram)
        </div>
        <textarea
          value={settings.developer_profile ?? ''}
          onChange={(e) => update('developer_profile', e.target.value || null)}
          placeholder={`Приклад:\n4+ роки досвіду Full-Stack розробки. Стек: TypeScript, React, Node.js, PostgreSQL.\nПрацюю в FAVBET TECH над high-load маркетинговими платформами.\nРаніше в SOLUTION MENTORS: створив AI-чатбота, скоротив час відповіді на 97%.`}
          style={s.textarea}
          spellCheck={false}
        />
        <div style={s.hint}>Чим конкретніше — тим кращий відгук. Вказуй цифри, технології, результати.</div>
      </div>

      {/* Quality filters */}
      <div style={s.card}>
        <div style={s.cardTitle}>Фільтри якості</div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <label style={s.label}>
            Мінімальний AI-бал (0–100)
            <input
              type="number"
              min={0}
              max={100}
              value={settings.min_score}
              onChange={(e) => update('min_score', parseInt(e.target.value, 10) || 0)}
              style={{ ...s.input, marginTop: 6, width: 110 }}
            />
            <span style={s.hint}>Вакансії нижче порогу відхиляє AI</span>
          </label>
          <label style={s.label}>
            Мінімальний бюджет ($)
            <input
              type="number"
              min={0}
              value={settings.min_budget_usd}
              onChange={(e) => update('min_budget_usd', parseInt(e.target.value, 10) || 0)}
              style={{ ...s.input, marginTop: 6, width: 110 }}
            />
            <span style={s.hint}>0 = без фільтру</span>
          </label>
        </div>
      </div>

      {/* Stop words */}
      <div style={s.card}>
        <div style={s.cardTitle}>Стоп-слова</div>
        <div style={{ ...s.hint, marginBottom: 8 }}>Одне слово або фраза на рядок</div>
        <textarea
          value={stopWordsText}
          onChange={(e) => setStopWordsText(e.target.value)}
          style={s.textarea}
          spellCheck={false}
        />
        <div style={s.hint}>
          Вакансії з цими словами в заголовку/описі відхиляються до LLM
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
