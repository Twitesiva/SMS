import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../../supabaseClient'
import { useStudentAuth } from '../../store/studentAuth'
import crest from '../../assets/media/images.png'
import '../common/Auth.css'
import '../common/AdmissionPortal.css'

export default function StudentLogin() {
  const nav = useNavigate()
  const { setStudent } = useStudentAuth()
  const [studentId, setStudentId] = useState('')
  const [mobile, setMobile] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onLogin = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    const cleanStudentId = studentId.trim()
    const cleanMobile = mobile.trim()

    try {
      const { data, error: fetchError } = await supabase
        .from('students')
        .select(
          'id, student_id, full_name, hall_ticket_no, academic_year, group_name, course_name, phone_number, status, photo_url, current_semester'
        )
        .eq('student_id', cleanStudentId)
        .eq('phone_number', cleanMobile)
        .maybeSingle()

      if (fetchError) throw fetchError
      if (!data) {
        setError('Invalid student ID or mobile number')
        setLoading(false)
        return
      }

      setStudent(data)
      nav('/student/dashboard')
    } catch (err) {
      console.error(err)
      setError(err?.message || 'Unable to sign in right now')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="admission-portal admin-login-portal">
      <div className="admission-portal__header">
        <div className="admission-portal__brand-block">
          <div className="admission-portal__brand">
            <img src={crest} alt="Vijayam crest" />
          </div>
          <div className="admission-portal__brand-text">
            <div className="admission-portal__brand-title">Vijayam Arts & Science College</div>
            <div className="admission-portal__brand-sub">Student Portal</div>
          </div>
        </div>
        <Link to="/roles" className="admission-portal__back">
          <i className="bi bi-arrow-left"></i> Back to Roles
        </Link>
      </div>

      <div className="admin-login-portal__content">
        <div className="admin-login-portal__intro">
          <h1>Student portal login</h1>
          <p>Use your student ID and registered mobile number.</p>
        </div>

        <section className="admin-login-card admin-login-card--portal" aria-live="polite">
          <div className="admin-login-card-header">
            <h2>Welcome back</h2>
            <p>Use your credentials to continue.</p>
          </div>
          <form className="admin-login-form" onSubmit={onLogin} autoComplete="off">
            <label className="admin-login-field">
              <span>Student ID</span>
              <input
                type="text"
                className="admin-login-input"
                name="student_id_entry"
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                placeholder="Enter Student ID"
                required
                autoComplete="off"
              />
            </label>

            <label className="admin-login-field">
              <span>Mobile Number</span>
              <input
                type="password"
                className="admin-login-input"
                name="student_mobile_entry"
                value={mobile}
                onChange={(event) => setMobile(event.target.value)}
                placeholder="Enter Mobile Number"
                required
                autoComplete="new-password"
              />
            </label>

            {error && <p className="admin-login-error">{error}</p>}

            <button type="submit" className="admin-login-submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
