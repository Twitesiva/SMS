import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/mockApi'
import crestPrimary from '../../assets/media/images.png'

export default function AdmissionPortal() {
  const admissionYear = new Date().getFullYear()
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
      <div className="admission-portal__header admission-portal__hero public-apply-hero">
        <div className="public-apply-hero-brand">
          <img src={crestPrimary} className="brand-logo public-apply-logo" alt="Vijayam crest" />
          <div>
            <div className="public-apply-eyebrow">ADMISSIONS {admissionYear}</div>
            <h2 className="public-apply-title">Vijayam College of Arts & Science</h2>
            <div className="public-apply-subtitle">Chittor</div>
          </div>
        </div>
        <div className="d-flex gap-3">
          <Link to="/admission/login" className="btn btn-outline-light rounded-pill px-4">
            <i className="bi bi-person-circle me-2"></i>Track Application
          </Link>
          <Link to="/home" className="admission-portal__back admission-portal__back--hero">
            <i className="bi bi-arrow-left"></i> Back to Home
          </Link>
        </div>
      </div>

      <div className="admission-portal__content">
        <div className="admission-portal__intro">
          <h1>Admission Portal</h1>
          <p className="admission-portal__subtitle">
            Explore groups, courses, and duration. Start your registration in minutes.
          </p>
        </div>

        <div className="admission-portal__table-wrapper">
          <div className="admission-portal__table-title">ADMISSION PROGRAMMES</div>
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
                      <Link
                        to="/apply"
                        state={{ selectedCourse: course }}
                        className="admission-portal__table-link"
                      >
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

        <section className="admission-portal__steps">
          <div className="admission-portal__steps-text">
            <p className="admission-portal__steps-eyebrow">YOUR ONLINE APPLICATION</p>
            <h2 className="admission-portal__steps-heading">
              Follow these steps to complete your admission
            </h2>
            <ul className="admission-portal__steps-list">
              <li>Register by filling the above details.</li>
              <li>Fill the application form online.</li>
              <li>Upload required documents.</li>
              <li>Submit your application.</li>
            </ul>
            <div className="admission-portal__note">
              <div className="admission-portal__note-title">NOTE</div>
              <ul className="admission-portal__note-list">
                <li>Upload clear photo in jpg or png format. Suggested size 135px x 175px (max 200KB).</li>
                <li>Upload transfer certificate and marksheets in jpg or png format (max 200KB each).</li>
              </ul>
            </div>
          </div>

          <div className="admission-portal__steps-card">
            <div className="admission-portal__steps-card-title">STEPS TO FOLLOW</div>
            <ol className="admission-portal__steps-flow">
              <li className="admission-portal__step admission-portal__step--green">
                <span className="admission-portal__step-badge">01</span>
                <span className="admission-portal__step-icon">
                  <i className="bi bi-person-plus"></i>
                </span>
                <span className="admission-portal__step-text">Register Yourself</span>
              </li>
              <li className="admission-portal__step admission-portal__step--coral">
                <span className="admission-portal__step-badge">02</span>
                <span className="admission-portal__step-icon">
                  <i className="bi bi-pencil-square"></i>
                </span>
                <span className="admission-portal__step-text">Fill Application Form Online</span>
              </li>
              <li className="admission-portal__step admission-portal__step--blue">
                <span className="admission-portal__step-badge">03</span>
                <span className="admission-portal__step-icon">
                  <i className="bi bi-upload"></i>
                </span>
                <span className="admission-portal__step-text">Upload Required Documents</span>
              </li>
              <li className="admission-portal__step admission-portal__step--teal">
                <span className="admission-portal__step-badge">04</span>
                <span className="admission-portal__step-icon">
                  <i className="bi bi-check2-circle"></i>
                </span>
                <span className="admission-portal__step-text">Submit Application</span>
              </li>
            </ol>
          </div>
        </section>
      </div>
    </div>
  )
}
