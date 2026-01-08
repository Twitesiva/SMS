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
          ? new Date(item.publish_date).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            })
          : '--'
      })),
    [circulars]
  )

  return (
    <StaffShell>
      <div className="student-circulars">
        <section className="student-circulars__hero">
          <div>
            <div className="student-circulars__eyebrow">Staff Portal</div>
            <h2 className="student-circulars__title">Circulars</h2>
            <p className="student-circulars__subtitle">
              Official announcements and updates for staff.
            </p>
          </div>
        </section>

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
            <div className="student-circulars__empty">{error}</div>
          ) : formattedCirculars.length === 0 ? (
            <div className="student-circulars__empty">No active circulars for staff.</div>
          ) : (
            formattedCirculars.map((item) => (
              <article key={item.id} className="student-circulars__card">
                <div className="student-circulars__card-header">
                  <div className="student-circulars__card-title-wrap">
                    <span className="student-circulars__icon" aria-hidden="true">
                      <i className="bi bi-megaphone-fill"></i>
                    </span>
                    <div>
                      <h4 className="student-circulars__card-title">{item.title}</h4>
                      <div className="student-circulars__card-meta">
                        <span>{item.publishLabel}</span>
                      </div>
                    </div>
                  </div>
                  <span className="student-circulars__badge">{item.audienceLabel}</span>
                </div>
                <p className="student-circulars__card-body">{item.description}</p>
              </article>
            ))
          )}
        </div>
      </div>
    </StaffShell>
  )
}
