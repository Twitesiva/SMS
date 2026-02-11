import { useEffect, useMemo, useState } from 'react'
import StaffShell from '../../components/StaffShell'
import { supabase } from '../../../supabaseClient'


const audienceLabels = {
  ALL: 'All Staff',
  STAFF: 'Staff',
  STAFFS: 'Staff'
}

export default function StaffCirculars() {
  const [circulars, setCirculars] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadCirculars = async () => {
      setLoading(true)
      setError('')
      try {
        const { data, error: fetchError } = await supabase
          .from('circulars')
          .select('id, title, description, target_audience, publish_date, expiry_date, is_active')
          .eq('is_active', true)
          .in('target_audience', ['ALL', 'STAFF', 'STAFFS'])
          .order('publish_date', { ascending: false })

        if (fetchError) throw fetchError
        setCirculars(data || [])
      } catch (err) {
        console.error('Failed to load circulars', err)
        setError('Unable to load circulars right now.')
        setCirculars([])
      } finally {
        setLoading(false)
      }
    }

    loadCirculars()
  }, [])

  const formattedCirculars = useMemo(
    () =>
      circulars.map((item) => ({
        ...item,
        audienceLabel: audienceLabels[item.target_audience] || item.target_audience || 'Staff',
        publishLabel: item.publish_date
          ? new Date(item.publish_date).toLocaleDateString('en-GB')
          : '--'
      })),
    [circulars]
  )

  return (
    <StaffShell>
      <div className="students-section-shell">
        <div className="student-card mb-4">
          <div className="student-card__header">Circulars</div>
          <div className="student-card__body">
            <p className="students-section-copy mb-0">
              Official announcements and updates for staff.
            </p>
          </div>
        </div>

        <div className="student-circulars__list">
          {loading ? (
            <div className="student-details__loading" role="status" aria-live="polite">
              <div className="student-details__loading-header">
                <div className="student-loader__spinner" aria-hidden="true"></div>
                <div>
                  <div className="student-loader__title">Loading circulars</div>
                  <div className="student-loader__subtitle">Fetching official announcements.</div>
                </div>
              </div>
              <div className="student-details__loading-grid" aria-hidden="true">
                <div className="student-loader-card">
                  <div className="student-loader-card__header student-loader__shimmer"></div>
                  <div className="student-loader-card__line student-loader__shimmer"></div>
                  <div className="student-loader-card__line student-loader__shimmer"></div>
                </div>
              </div>
              <span className="sr-only">Loading circulars...</span>
            </div>
          ) : error ? (
            <div className="student-details__status student-details__status--error">{error}</div>
          ) : formattedCirculars.length === 0 ? (
            <div className="student-details__status">No active circulars for staff.</div>
          ) : (
            formattedCirculars.map((item) => (
              <div key={item.id} className="student-card">
                <div className="student-card__header d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center gap-2">
                    <i className="bi bi-megaphone-fill opacity-75"></i>
                    <span className="text-uppercase">{item.title}</span>
                  </div>
                  <span style={{ fontSize: '0.85rem', fontWeight: '600', opacity: 0.9 }}>
                    {item.publishLabel}
                  </span>
                </div>
                <div className="student-card__body">
                  <div className="mb-3 d-flex justify-content-between align-items-center">
                    <span className="badge bg-light text-dark border">
                      <i className="bi bi-people-fill me-1"></i>
                      {item.audienceLabel}
                    </span>
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', textAlign: 'justify', color: '#334155', lineHeight: '1.7' }}>
                    {item.description}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </StaffShell>
  )
}

