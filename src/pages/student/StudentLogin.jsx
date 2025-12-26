import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../../supabaseClient'
import { useAuth } from '../../store/auth'
import crestAccent from '../../assets/media/images.png'

export default function StudentLogin() {
    useEffect(() => {
        const previous = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = previous
        }
    }, [])

    const nav = useNavigate()
    const { setUser } = useAuth()
    const [hallTicket, setHallTicket] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [showPassword, setShowPassword] = useState(false)

    const onLogin = async (event) => {
        event.preventDefault()
        setLoading(true)
        setError('')

        try {
            // Direct query to students table as per verification requirements
            const { data, error: queryError } = await supabase
                .from('students')
                .select('*')
                .eq('hall_ticket_no', hallTicket.trim())
                .eq('phone_number', password.trim())
                .single()

            if (queryError || !data) {
                throw new Error('Invalid Hall Ticket Number or Phone Number')
            }

            // Log the login activity (optional, but consistent with other flows)
            try {
                await supabase.from('activity_logs').insert([
                    {
                        user_id: null, // No auth.users ID for students in this flow
                        role: 'student',
                        action: 'LOGIN',
                        page: 'Student Login',
                        description: `Student ${data.full_name} (${data.hall_ticket_no}) logged in successfully`,
                    },
                ])
            } catch (logErr) {
                // Ignore logging errors to not block login
                console.warn('Logging failed', logErr)
            }

            // Store student session
            setUser({
                id: data.id,
                name: data.full_name,
                hallTicket: data.hall_ticket_no,
                role: 'STUDENT',
                studentData: data
            })

            // Navigate to profile
            nav('/student/profile')
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
                        <p className="admin-login-eyebrow">Student Portal</p>
                        <h1 className="admin-login-title">Student Login</h1>
                        <p className="admin-login-subtitle">Sign in to view your profile and results.</p>
                    </div>
                </div>

                <form className="admin-login-form" onSubmit={onLogin}>
                    <label className="admin-login-field">
                        <span>Hall Ticket Number</span>
                        <input
                            type="text"
                            className="admin-login-input"
                            value={hallTicket}
                            onChange={(event) => setHallTicket(event.target.value)}
                            placeholder="Enter your Hall Ticket No"
                            required
                        />
                    </label>

                    <label className="admin-login-field">
                        <span>Password (Phone Number)</span>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className="admin-login-input"
                                style={{ paddingRight: '2.5rem', width: '100%' }}
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                placeholder="Enter your registered Phone No"
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
                                    <i className="bi bi-eye-slash"></i>
                                ) : (
                                    <i className="bi bi-eye"></i>
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
