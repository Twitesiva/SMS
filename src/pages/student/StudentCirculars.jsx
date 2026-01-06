import { useEffect, useMemo, useState } from 'react'
import StudentShell from '../../components/StudentShell'
import { supabase } from '../../../supabaseClient'

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
      <div className="student-details student-circulars">
        <div className="student-details__header">
          <h2>Circulars</h2>
          <p>Official announcements and updates for students.</p>
        </div>

        <div className="student-circulars__list">
          {loading ? (
            <div className="student-circulars__empty">Loading circulars...</div>
          ) : error ? (
            <div className="student-circulars__empty">{error}</div>
          ) : formattedCirculars.length === 0 ? (
            <div className="student-circulars__empty">No active circulars for students.</div>
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
    </StudentShell>
  )
}
