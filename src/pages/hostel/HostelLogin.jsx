import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useHostelAuth } from '../../store/hostelAuth'
import crestAccent from '../../assets/media/images.png'
import '../common/Auth.css'

// Hardcoded hostel portal credentials (mirror other admin-style pages)
const HOSTEL_EMAIL = 'hostel@vijayam.in'
const HOSTEL_PASSWORD = 'admin123'

export default function HostelLogin() {
  const nav = useNavigate()
  const { setHostelUser } = useHostelAuth()
  const [email, setEmail] = useState(HOSTEL_EMAIL)
  const [password, setPassword] = useState(HOSTEL_PASSWORD)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const onLogin = (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    const cleanEmail = email.trim().toLowerCase()

    if (cleanEmail !== HOSTEL_EMAIL || password !== HOSTEL_PASSWORD) {
      setLoading(false)
      setError('Invalid hostel credentials')
      return
    }

    setHostelUser({
      id: 'local-hostel-admin',
      email: cleanEmail,
      role: 'HOSTEL_ADMIN'
    })

    setLoading(false)
    nav('/hostel/dashboard')
  }

  return (
    <main className="admission-portal admin-login-portal">
      <div className="admission-portal__header">
        <div className="admission-portal__brand-block">
          <div className="admission-portal__brand">
            <img src={crestAccent} alt="Vijayam crest" />
          </div>
          <div className="admission-portal__brand-text">
            <div className="admission-portal__brand-title">Vijayam Arts & Science College</div>
            <div className="admission-portal__brand-sub">Hostel Access</div>
          </div>
        </div>
        <Link to="/roles" className="admission-portal__back">
          <i className="bi bi-arrow-left"></i> Back to Roles
        </Link>
      </div>

      <div className="admin-login-portal__content">
        <div className="admin-login-portal__intro">
          <h1>Hostel portal login</h1>
          <p>Sign in to manage hostel occupancy, fees, and allocations.</p>
        </div>

        <section className="admin-login-card admin-login-card--portal" aria-live="polite">
          <div className="admin-login-card-header">
            <h2>Welcome back</h2>
            <p>Use your hostel admin credentials to continue.</p>
          </div>
          <form className="admin-login-form" onSubmit={onLogin}>
            <label className="admin-login-field">
              <span>Email</span>
              <input
                type="text"
                className="admin-login-input"
                value={email}
                autoComplete="off"
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>

            <label className="admin-login-field">
              <span>Password</span>
              <div className="admin-login-password">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="admin-login-input"
                  value={password}
                  autoComplete="new-password"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="admin-login-toggle"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7c.44 0 .87-.03 1.28-.09" />
                      <path d="m2 2 20 20" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </label>

            {error && <p className="admin-login-error">{error}</p>}

            <button className="admin-login-submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
