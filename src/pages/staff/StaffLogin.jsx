import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../../supabaseClient'
import { useStaffAuth } from '../../store/staffAuth'
import crest from '../../assets/media/images.png'

export default function StaffLogin() {
  const nav = useNavigate()
  const { setStaff } = useStaffAuth()

  const [staffId, setStaffId] = useState('')
  const [mobile, setMobile] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error: fetchError } = await supabase
        .from('teachers')
        .select(`
          id,
          staff_id,
          full_name,
          gender,
          date_of_birth,
          aadhar_number,
          phone_number,
          email,
          address,
          designation,
          qualification,
          experience_years,
          joining_date,
          status,
          created_at
        `)
        .eq('staff_id', staffId.trim())
        .eq('phone_number', mobile.trim())
        .eq('status', 'ACTIVE')
        .maybeSingle()

      if (fetchError) throw fetchError

      if (!data) {
        setError('Invalid staff ID or mobile number')
        return
      }

      setStaff(data)
      nav('/staff/dashboard')
    } catch (err) {
      console.error(err)
      setError(err?.message || 'Unable to sign in right now')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="staff-login">
      <div className="staff-login__card">
        <div className="staff-login__brand">
          <img src={crest} alt="Vijayam crest" />
          <div>
            <div className="staff-login__title">Staff Portal</div>
            <div className="staff-login__subtitle">
              Vijayam Arts & Science College
            </div>
          </div>
        </div>

        <h2 className="staff-login__heading">Staff Login</h2>
        <p className="staff-login__copy">
          Use your staff ID and registered mobile number.
        </p>

        <form className="staff-login__form" onSubmit={onLogin}>
          <label className="staff-login__field">
            <span>Staff ID</span>
            <input
              type="text"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              placeholder="Staff ID"
              required
            />
          </label>

          <label className="staff-login__field">
            <span>Mobile Number</span>
            <input
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="Registered mobile number"
              required
            />
          </label>

          {error && <div className="staff-login__error">{error}</div>}

          <button
            type="submit"
            className="staff-login__submit"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <Link to="/roles" className="staff-login__back">
          ← Back to Roles
        </Link>
      </div>
    </main>
  )
}
