import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

const STATUS_TABS = [
  { key: '', label: 'Всі' },
  { key: 'published', label: 'Опубліковано' },
  { key: 'publish_ready', label: 'Готові' },
  { key: 'llm_rejected', label: 'Відхилено LLM' },
  { key: 'prefilter_rejected', label: 'Фільтр' },
  { key: 'llm_failed', label: 'Помилки' },
]

const BADGE: Record<string, { label: string; color: string; bg: string }> = {
  published:          { label: 'published',   color: '#065f46', bg: '#d1fae5' },
  publish_ready:      { label: 'ready',        color: '#1e40af', bg: '#dbeafe' },
  llm_rejected:       { label: 'rejected',     color: '#92400e', bg: '#fef3c7' },
  prefilter_rejected: { label: 'filtered',     color: '#374151', bg: '#f3f4f6' },
  llm_failed:         { label: 'failed',       color: '#991b1b', bg: '#fee2e2' },
  publish_failed:     { label: 'pub_failed',   color: '#7f1d1d', bg: '#fee2e2' },
  new:                { label: 'new',          color: '#5b21b6', bg: '#ede9fe' },
  ready_for_llm:      { label: 'queued',       color: '#0e7490', bg: '#cffafe' },
  llm_processing:     { label: 'processing',   color: '#9a3412', bg: '#ffedd5' },
}

interface Job {
  id: string
  title: string
  source: string
  status: string
  ai_score: { relevanceScore: number } | null
  canonical_url: string
  created_at: string
}

const PAGE_SIZE = 25

export default function JobsPanel() {
  const [statusFilter, setStatusFilter] = useState('')
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)

  // Reset page when filter changes
  useEffect(() => { setPage(0) }, [statusFilter])

  useEffect(() => {
    setLoading(true)
    let q = supabase
      .from('jobs')
      .select('id, title, source, status, ai_score, canonical_url, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (statusFilter) q = q.eq('status', statusFilter)

    q.then(({ data, count }) => {
      setJobs((data ?? []) as Job[])
      setTotal(count ?? 0)
      setLoading(false)
    })
  }, [statusFilter, page])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div style={s.wrap}>
      <h2 style={s.h2}>
        Вакансії <span style={s.totalBadge}>{total}</span>
      </h2>

      {/* Status tabs */}
      <div style={s.tabs}>
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            style={{ ...s.tab, ...(statusFilter === tab.key ? s.tabActive : {}) }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={s.tableWrap}>
        {loading ? (
          <div style={s.empty}>Завантаження...</div>
        ) : jobs.length === 0 ? (
          <div style={s.empty}>Нічого не знайдено</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Назва</th>
                <th style={s.th}>Джерело</th>
                <th style={{ ...s.th, textAlign: 'center' }}>Скор</th>
                <th style={s.th}>Статус</th>
                <th style={s.th}>Дата</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const badge = BADGE[job.status] ?? { label: job.status, color: '#374151', bg: '#f3f4f6' }
                const score = job.ai_score?.relevanceScore
                return (
                  <tr key={job.id} style={s.tr}>
                    <td style={s.tdTitle}>
                      <a href={job.canonical_url} target="_blank" rel="noreferrer" style={s.link}>
                        {job.title.length > 90 ? job.title.slice(0, 90) + '…' : job.title}
                      </a>
                    </td>
                    <td style={s.td}>
                      <span style={s.srcTag}>{job.source}</span>
                    </td>
                    <td style={{ ...s.td, textAlign: 'center' }}>
                      {score != null ? (
                        <span style={{
                          ...s.scoreNum,
                          color: score >= 85 ? '#059669' : score >= 60 ? '#d97706' : '#dc2626',
                        }}>
                          {score}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={s.td}>
                      <span style={{ ...s.badge, color: badge.color, background: badge.bg }}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ ...s.td, color: '#9ca3af', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {new Date(job.created_at).toLocaleDateString('uk-UA')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={s.pager}>
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            style={s.pageBtn}
          >
            ← Назад
          </button>
          <span style={s.pageInfo}>
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page + 1 >= totalPages}
            style={s.pageBtn}
          >
            Далі →
          </button>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 960, margin: '0 auto', padding: '24px 16px' },
  h2: { margin: '0 0 16px', fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 },
  totalBadge: { fontSize: 14, fontWeight: 500, color: '#9ca3af' },
  tabs: { display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' },
  tab: { padding: '6px 14px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#555', fontFamily: 'inherit', transition: 'all .15s' },
  tabActive: { background: '#111', color: '#fff', borderColor: '#111' },
  tableWrap: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' },
  empty: { textAlign: 'center', padding: 48, color: '#9ca3af', fontSize: 14 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { padding: '10px 14px', textAlign: 'left', background: '#f9fafb', borderBottom: '2px solid #e5e7eb', fontWeight: 600, color: '#6b7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '10px 14px', verticalAlign: 'middle' },
  tdTitle: { padding: '10px 14px', maxWidth: 360 },
  link: { color: '#1d4ed8', textDecoration: 'none', fontSize: 13, lineHeight: 1.4 },
  srcTag: { fontSize: 11, background: '#f3f4f6', padding: '3px 7px', borderRadius: 5, color: '#555', whiteSpace: 'nowrap' },
  scoreNum: { fontWeight: 700, fontSize: 15 },
  badge: { fontSize: 11, padding: '3px 8px', borderRadius: 10, fontWeight: 600, whiteSpace: 'nowrap' },
  pager: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 16 },
  pageBtn: { padding: '7px 16px', borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' },
  pageInfo: { fontSize: 13, color: '#6b7280' },
}
