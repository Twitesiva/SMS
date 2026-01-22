import { useEffect, useMemo, useState } from 'react'
import StudentShell from '../../components/StudentShell'
import { supabase } from '../../../supabaseClient'
import './Student.css'

const audienceLabels = {
  ALL: 'All Students',
  STUDENT: 'Students',
  STUDENTS: 'Students'
}

export default function StudentCirculars() {
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
          .in('target_audience', ['ALL', 'STUDENT', 'STUDENTS'])
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
        audienceLabel: audienceLabels[item.target_audience] || item.target_audience || 'Students',
        publishLabel: item.publish_date
          ? new Date(item.publish_date).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          })
          : '--',
        expiryLabel: item.expiry_date
          ? new Date(item.expiry_date).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          })
          : null
      })),
    [circulars]
  )

  return (
    <StudentShell>
      <div className="students-section-shell">
        <div className="student-card mb-4">
          <div className="student-card__header">Circulars</div>
          <div className="student-card__body">
            <p className="students-section-copy mb-0">
              Official announcements and updates for students.
            </p>
          </div>
        </div>

        <div className="student-circulars__list">
          {loading ? (
            <div className="student-details__loading" role="status" aria-live="polite">
              <div className="student-loader__spinner mx-auto mb-2" aria-hidden="true"></div>
              <div className="text-center text-muted">Loading circulars...</div>
            </div>
          ) : error ? (
            <div className="student-details__status student-details__status--error">{error}</div>
          ) : formattedCirculars.length === 0 ? (
            <div className="student-details__status">No active circulars for students.</div>
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
    </StudentShell>
  )
}
