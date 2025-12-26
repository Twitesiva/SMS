import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/mockApi'
import crestPrimary from '../../assets/media/images.png'

export default function AdmissionPortal() {
  const [courses, setCourses] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        setLoading(true)
        const [courseRows, groupRows] = await Promise.all([
          api.listCourses(),
          api.listGroups?.() || []
        ])
        if (!active) return
        setCourses(courseRows || [])
        setGroups(groupRows || [])
        setError('')
      } catch (err) {
        if (!active) return
        setCourses([])
        setGroups([])
        setError(err?.message || 'Unable to load admission data.')
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [])

  const groupLookup = useMemo(() => {
    const lookup = new Map()
    groups.forEach((group) => {
      if (group?.name) lookup.set(String(group.name).toLowerCase(), group)
      if (group?.code) lookup.set(String(group.code).toLowerCase(), group)
    })
    return lookup
  }, [groups])

  const getDuration = (course) => {
    if (course?.duration_years) return `${course.duration_years} years`
    const key = course?.group_name || course?.group_code || ''
    const group = key ? groupLookup.get(String(key).toLowerCase()) : null
    if (group?.years) return `${group.years} years`
    if (course?.semesters) return `${Math.ceil(course.semesters / 2)} years`
    return 'N/A'
  }

  return (
    <div className="admission-portal">
      <div className="admission-portal__header">
        <Link to="/home" className="admission-portal__back">
          <i className="bi bi-arrow-left"></i> Back to Home
        </Link>
        <div className="admission-portal__brand">
          <img src={crestPrimary} alt="Vijayam crest" />
        </div>
      </div>

      <div className="admission-portal__content">
        <h1>Admission Portal</h1>
        <p className="admission-portal__subtitle">
          Explore groups, courses, and duration. Start your registration in minutes.
        </p>

        <div className="admission-portal__table-wrapper">
          <div className="admission-portal__table-title">Admission Programmes</div>
          {loading && <div className="admission-portal__status">Loading admission data...</div>}
          {!loading && error && <div className="admission-portal__status">{error}</div>}
          {!loading && !error && (
            <table className="admission-portal__table">
              <thead>
                <tr>
                  <th className="admission-portal__col-sno">S.No</th>
                  <th>Name of the Programme</th>
                  <th className="admission-portal__col-duration">Duration</th>
                  <th className="admission-portal__col-register">Registration Form</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course, index) => (
                  <tr key={course.id || `${course.code}-${course.name}-${index}`}>
                    <td className="admission-portal__col-sno">{index + 1}</td>
                    <td>
                      <div className="admission-portal__program">
                        <span className="admission-portal__program-name">
                          {course.name || 'N/A'}
                        </span>
                        {(course.group_name || course.code) && (
                          <span className="admission-portal__program-meta">
                            {course.group_name || course.code}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="admission-portal__col-duration">{getDuration(course)}</td>
                    <td className="admission-portal__col-register">
                      <Link to="/apply" className="admission-portal__table-link">
                        Apply Now <i className="bi bi-box-arrow-up-right"></i>
                      </Link>
                    </td>
                  </tr>
                ))}
                {courses.length === 0 && (
                  <tr>
                    <td colSpan={4} className="admission-portal__empty">
                      No admission courses available yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
