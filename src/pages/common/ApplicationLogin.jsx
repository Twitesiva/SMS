import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../supabaseClient'
import crestPrimary from '../../assets/media/images.png'

export default function ApplicationLogin() {
    const [appNo, setAppNo] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()

    const handleLogin = async (e) => {
        e.preventDefault()
        if (!appNo || !password) {
            setError('Please enter both Application No and Password (Mobile Number)')
            return
        }

        setLoading(true)
        setError('')

        try {
            // Find application by number
            const { data: appData, error: appError } = await supabase
                .from('applications')
                .select('*')
                .eq('application_no', appNo.trim())
                .single()

            if (appError || !appData) {
                setError('Application not found. Please check your Application Number.')
                setLoading(false)
                return
            }

            // Verify password (which is phone number)
            // Note: In a real app, we should hash this or have a proper auth system.
            // Here, per requirements, password is "student mobile number".
            // We should check 'phone_number' column.
            if (appData.phone_number !== password.trim()) {
                setError('Invalid credentials. Please check your Mobile Number.')
                setLoading(false)
                return
            }

            // Success. Store session in localStorage (simple mock auth) or just navigate with state
            // For security, using context or storing a token is better, but for this task specific scope:
            localStorage.setItem('studentAppSession', JSON.stringify({ id: appData.id, appNo: appData.application_no }))
            navigate('/admission/tracker')

        } catch (err) {
            console.error(err)
            setError('Login failed. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="admission-portal" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div className="admission-portal__header admission-portal__hero public-apply-hero" style={{ flexGrow: 0 }}>
                <div className="public-apply-hero-brand d-flex align-items-center gap-3">
                    <img src={crestPrimary} className="brand-logo public-apply-logo" alt="Vijayam crest" />
                    <div>
                        <div className="public-apply-eyebrow">ADMISSIONS {new Date().getFullYear()}</div>
                        <h2 className="public-apply-title">Vijayam College of Arts & Science</h2>
                        <div className="public-apply-subtitle">Chittor</div>
                    </div>
                </div>
            </div>

            <div className="container py-5 d-flex justify-content-center align-items-center" style={{ flexGrow: 1 }}>
                <div className="card border-0 shadow-lg p-4" style={{ maxWidth: '450px', width: '100%', borderRadius: '16px' }}>
                    <div className="text-center mb-4">
                        <h3 className="fw-bold text-primary">Application Tracker</h3>
                        <p className="text-muted">Login to track your application status</p>
                    </div>

                    {error && <div className="alert alert-danger font-monospace fs-6 py-2">{error}</div>}

                    <form onSubmit={handleLogin} autoComplete="off">
                        <div className="mb-3">
                            <label className="form-label text-muted small fw-bold text-uppercase">Application Number</label>
                            <input
                                type="text"
                                name="tracker_app_no"
                                className="form-control form-control-lg"
                                placeholder="Enter App No (e.g., APP2026...)"
                                value={appNo}
                                onChange={(e) => setAppNo(e.target.value)}
                                autoComplete="off"
                            />
                        </div>
                        <div className="mb-4">
                            <label className="form-label text-muted small fw-bold text-uppercase">Password (Mobile Number)</label>
                            <input
                                type="password"
                                name="tracker_mobile_pass"
                                className="form-control form-control-lg"
                                placeholder="Enter Registered Mobile No"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="new-password"
                            />
                        </div>
                        <button
                            type="submit"
                            className="btn btn-primary btn-lg w-100 fw-bold mb-3"
                            disabled={loading}
                        >
                            {loading ? 'Verifying...' : 'Login to Dashboard'}
                        </button>
                    </form>

                    <div className="text-center mt-3 border-top pt-3">
                        <a href="/" className="text-decoration-none text-muted small">
                            <i className="bi bi-arrow-left me-1"></i> Back to Admission Portal
                        </a>
                    </div>
                </div>
            </div>
        </div>
    )
}
