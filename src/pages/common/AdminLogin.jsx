import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../../supabaseClient'
import { useAuth } from '../../store/auth'
import crestAccent from '../../assets/media/images.png'

export default function AdminLogin() {
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  const nav = useNavigate()
  const { setUser } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('ADMIN')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const onLogin = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    const cleanEmail = email.trim().toLowerCase()
    const allowedEmails = ['admin@vijayam.in', 'principal@vijayam.in']

    if (!allowedEmails.includes(cleanEmail)) {
      setLoading(false)
      setError('Access denied: Unauthorized email address')
      return
    }

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      })

      if (authError) throw authError

      // Determine role based on specific email
      let userRole = 'ADMIN'
      if (cleanEmail === 'principal@vijayam.in') {
        userRole = 'PRINCIPAL' // or 'principal', matching your system's role naming convention
      }

      // Log the login activity
      const { data: logData } = await supabase.from('activity_logs').insert([
        {
          user_id: data.user.id,
          role: userRole.toLowerCase(),
          action: 'LOGIN',
          page: 'Admin Login',
          description: `1. ${userRole.charAt(0).toUpperCase() + userRole.slice(1).toLowerCase()} logged in successfully`,
        },
      ]).select().single()

      setUser({ id: data.user.id, email: data.user.email, role: userRole, sessionLogId: logData?.id })

      // Small delay to ensure session log is propagated/discoverable
      await new Promise(resolve => setTimeout(resolve, 500))

      nav('/admin')
    } catch (err) {
      console.error(err)
      setError(err.message || 'Unable to sign in right now')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="admin-login-shell">
      <Link
        to="/roles"
        style={{
          position: 'absolute',
          top: '2rem',
          left: '2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          textDecoration: 'none',
          color: '#4b5563',
          fontWeight: 600,
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '0.8rem 1.5rem',
          borderRadius: '50px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          zIndex: 20
        }}
        className="home-back-btn"
      >
        <i className="bi bi-arrow-left"></i> Back to Roles
      </Link>
      <section className="admin-login-card" aria-live="polite">
        <div className="admin-login-brand">
          <div className="admin-login-logo" aria-hidden="true">
            <img src={crestAccent} alt="Vijayam crest" />
          </div>
          <div>
            <p className="admin-login-eyebrow">Exam Control Centre</p>
            <h1 className="admin-login-title">Admin login</h1>
            <p className="admin-login-subtitle">Sign in to manage Vijayam exams.</p>
          </div>
        </div>

        <form className="admin-login-form" onSubmit={onLogin}>
          <label className="admin-login-field">
            <span>Login as</span>
            <select
              className="admin-login-input admin-login-select"
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              <option value="ADMIN">Admin</option>
              <option value="PRINCIPAL">Principal</option>
            </select>
          </label>

          <label className="admin-login-field">
            <span>Email</span>
            <input
              type="text"
              className="admin-login-input"
              value={email}
              autoComplete="username"
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="admin-login-field">
            <span>Password</span>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="admin-login-input"
                style={{ paddingRight: '2.5rem', width: '100%' }}
                value={password}
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  color: '#6b7280',
                }}
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
    </main>
  )
}
