import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

const STATUS_LABELS: Record<string, string> = {
  new: 'Нові',
  ready_for_llm: 'Черга LLM',
  llm_processing: 'Обробляються',
  llm_rejected: 'Відхилено LLM',
  llm_failed: 'Помилка LLM',
  prefilter_rejected: 'Відхилено фільтром',
  publish_ready: 'Готові до публікації',
  published: 'Опубліковано',
  publish_failed: 'Помилка публікації',
}

const STATUS_COLORS: Record<string, string> = {
  published: '#10b981',
  publish_ready: '#3b82f6',
  llm_rejected: '#f59e0b',
  prefilter_rejected: '#9ca3af',
  llm_failed: '#ef4444',
  publish_failed: '#dc2626',
  new: '#8b5cf6',
  ready_for_llm: '#06b6d4',
  llm_processing: '#f97316',
}

interface StatRow { status: string; count: number }
interface SourceRow { source: string; count: number }

export default function StatsPanel() {
  const [byStatus, setByStatus] = useState<StatRow[]>([])
  const [bySrc, setBySrc] = useState<SourceRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('jobs')
      .select('status, source')
      .then(({ data }) => {
        if (!data) return
        const statusMap: Record<string, number> = {}
        const srcMap: Record<string, number> = {}
        for (const job of data) {
          statusMap[job.status as string] = (statusMap[job.status as string] ?? 0) + 1
          srcMap[job.source as string] = (srcMap[job.source as string] ?? 0) + 1
        }
        setByStatus(
          Object.entries(statusMap)
            .map(([status, count]) => ({ status, count }))
            .sort((a, b) => b.count - a.count),
        )
        setBySrc(
          Object.entries(srcMap)
            .map(([source, count]) => ({ source, count }))
            .sort((a, b) => b.count - a.count),
        )
        setLoading(false)
      })
  }, [])

  const total = byStatus.reduce((s, r) => s + r.count, 0)
  const published = byStatus.find((r) => r.status === 'published')?.count ?? 0
  const rejected =
    (byStatus.find((r) => r.status === 'llm_rejected')?.count ?? 0) +
    (byStatus.find((r) => r.status === 'prefilter_rejected')?.count ?? 0)
  const conversion = total > 0 ? ((published / total) * 100).toFixed(1) : '0'

  if (loading) return <div style={s.loading}>Завантаження...</div>

  return (
    <div style={s.wrap}>
      <h2 style={s.h2}>Статистика</h2>

      <div style={s.cards}>
        <div style={s.card}>
          <div style={s.cardNum}>{total}</div>
          <div style={s.cardLabel}>Всього вакансій</div>
        </div>
        <div style={s.card}>
          <div style={{ ...s.cardNum, color: '#10b981' }}>{published}</div>
          <div style={s.cardLabel}>Опубліковано</div>
        </div>
        <div style={s.card}>
          <div style={{ ...s.cardNum, color: '#ef4444' }}>{rejected}</div>
          <div style={s.cardLabel}>Відхилено</div>
        </div>
        <div style={s.card}>
          <div style={{ ...s.cardNum, color: '#3b82f6' }}>{conversion}%</div>
          <div style={s.cardLabel}>Conversion rate</div>
        </div>
      </div>

      <div style={s.grid}>
        <div style={s.section}>
          <h3 style={s.h3}>По статусах</h3>
          {byStatus.map(({ status, count }) => (
            <div key={status} style={s.row}>
              <span style={{ ...s.dot, background: STATUS_COLORS[status] ?? '#d1d5db' }} />
              <span style={s.label}>{STATUS_LABELS[status] ?? status}</span>
              <span style={s.count}>{count}</span>
            </div>
          ))}
        </div>

        <div style={s.section}>
          <h3 style={s.h3}>По джерелах</h3>
          {bySrc.length === 0 ? (
            <div style={{ color: '#9ca3af', fontSize: 13 }}>Немає даних</div>
          ) : (
            bySrc.map(({ source, count }) => (
              <div key={source} style={s.row}>
                <span style={s.label}>{source}</span>
                <span style={s.count}>{count}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 820, margin: '0 auto', padding: '24px 16px' },
  loading: { textAlign: 'center', padding: 40, color: '#888' },
  h2: { margin: '0 0 20px', fontSize: 22, fontWeight: 700 },
  h3: { margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em' },
  cards: { display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' },
  card: { flex: '1 1 120px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px', textAlign: 'center' },
  cardNum: { fontSize: 30, fontWeight: 700, color: '#111', lineHeight: 1 },
  cardLabel: { fontSize: 12, color: '#9ca3af', marginTop: 6 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  section: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px' },
  row: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #f3f4f6' },
  dot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  label: { flex: 1, fontSize: 13, color: '#374151' },
  count: { fontSize: 13, fontWeight: 600, color: '#111', minWidth: 28, textAlign: 'right' },
}
