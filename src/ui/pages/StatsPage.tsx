import { useEffect, useState, useCallback } from 'react'
import { useAuth, useServices } from '../context/AppContext'
import { Language } from '../../domain/values/Language'

interface ApiUsageStats {
  model: string
  total: number
  today: number
  failures: number
  failuresToday: number
}

interface WordStats {
  total: number
  en: number
  fr: number
  pending: number
  exported: number
}

export function StatsPage() {
  const { user } = useAuth()
  const { supabase, wordRepository } = useServices()
  const [apiStats, setApiStats] = useState<ApiUsageStats[]>([])
  const [wordStats, setWordStats] = useState<WordStats | null>(null)
  const [loading, setLoading] = useState(true)

  const loadStats = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayIso = todayStart.toISOString()

    // API usage stats by model
    const { data: allUsage } = await supabase
      .from('api_usage')
      .select('model, success, created_at')
      .eq('user_id', user.id)

    const modelMap = new Map<string, ApiUsageStats>()
    for (const row of allUsage ?? []) {
      const key = row.model
      if (!modelMap.has(key)) {
        modelMap.set(key, { model: key, total: 0, today: 0, failures: 0, failuresToday: 0 })
      }
      const stats = modelMap.get(key)!
      stats.total++
      if (!row.success) stats.failures++
      if (row.created_at >= todayIso) {
        stats.today++
        if (!row.success) stats.failuresToday++
      }
    }
    setApiStats(Array.from(modelMap.values()).sort((a, b) => b.total - a.total))

    // Word stats
    const words = await wordRepository.findAllByUser(user.id)
    setWordStats({
      total: words.length,
      en: words.filter((w) => w.language === Language.EN).length,
      fr: words.filter((w) => w.language === Language.FR).length,
      pending: words.filter((w) => w.status === 'pending').length,
      exported: words.filter((w) => w.status === 'exported').length,
    })

    setLoading(false)
  }, [user, supabase, wordRepository])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch on mount
    loadStats()
  }, [loadStats])

  if (loading) {
    return <div className="loading-text">Loading stats…</div>
  }

  return (
    <div className="stats-page">
      <h2>Statistics</h2>

      {wordStats && (
        <div className="stats-section">
          <h3>Words</h3>
          <table className="stats-table">
            <tbody>
              <tr><td>Total words</td><td>{wordStats.total}</td></tr>
              <tr><td>{'\uD83C\uDDEC\uD83C\uDDE7'} English</td><td>{wordStats.en}</td></tr>
              <tr><td>{'\uD83C\uDDEB\uD83C\uDDF7'} French</td><td>{wordStats.fr}</td></tr>
              <tr><td>Pending</td><td>{wordStats.pending}</td></tr>
              <tr><td>Exported</td><td>{wordStats.exported}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="stats-section">
        <h3>API Usage</h3>
        {apiStats.length === 0 ? (
          <div className="empty-state">No API usage recorded yet.</div>
        ) : (
          <table className="stats-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Total</th>
                <th>Today</th>
                <th>Failures</th>
                <th>Failures today</th>
              </tr>
            </thead>
            <tbody>
              {apiStats.map((s) => (
                <tr key={s.model}>
                  <td>{s.model}</td>
                  <td>{s.total}</td>
                  <td>{s.today}</td>
                  <td>{s.failures > 0 ? s.failures : '—'}</td>
                  <td>{s.failuresToday > 0 ? s.failuresToday : '—'}</td>
                </tr>
              ))}
              <tr className="stats-table__total">
                <td>Total</td>
                <td>{apiStats.reduce((s, r) => s + r.total, 0)}</td>
                <td>{apiStats.reduce((s, r) => s + r.today, 0)}</td>
                <td>{apiStats.reduce((s, r) => s + r.failures, 0) || '—'}</td>
                <td>{apiStats.reduce((s, r) => s + r.failuresToday, 0) || '—'}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
