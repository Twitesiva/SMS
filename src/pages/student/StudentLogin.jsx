import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../../supabaseClient'
import { useStudentAuth } from '../../store/studentAuth'
import crest from '../../assets/media/images.png'

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
    <main className="student-login">
      <div className="student-login__card">
        <div className="student-login__brand">
          <img src={crest} alt="Vijayam crest" />
          <div>
            <div className="student-login__title">Student Portal</div>
            <div className="student-login__subtitle">Vijayam Arts & Science College</div>
          </div>
        </div>

        <h2 className="student-login__heading">Student Login</h2>
        <p className="student-login__copy">Use your student ID and registered mobile number.</p>

        <form className="student-login__form" onSubmit={onLogin}>
          <label className="student-login__field">
            <span>Name</span>
            <input
              type="text"
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              placeholder="Student ID"
              required
            />
          </label>

          <label className="student-login__field">
            <span>Password</span>
            <input
              type="password"
              value={mobile}
              onChange={(event) => setMobile(event.target.value)}
              placeholder="Mobile number"
              required
            />
          </label>

          {error && <div className="student-login__error">{error}</div>}

          <button type="submit" className="student-login__submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <Link to="/roles" className="student-login__back">
          <i className="bi bi-arrow-left"></i> Back to Roles
        </Link>
      </div>
    </main>
  )
}
