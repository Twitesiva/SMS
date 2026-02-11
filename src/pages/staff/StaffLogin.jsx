import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../../supabaseClient'
import { useStaffAuth } from '../../store/staffAuth'
import crest from '../../assets/media/images.png'
import '../common/Auth.css'
import '../common/AdmissionPortal.css'

export default function StaffLogin() {
    const nav = useNavigate()
    const { setStaff } = useStaffAuth()
    const [staffId, setStaffId] = useState('')
    const [mobile, setMobile] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const onLogin = async (event) => {
        event.preventDefault()
        setLoading(true)
        setError('')

        const cleanStaffId = staffId.trim()
        const cleanMobile = mobile.trim()

        try {
            const { data, error: fetchError } = await supabase
                .from('teachers')
                .select('*')
                .eq('staff_id', cleanStaffId)
                .eq('phone_number', cleanMobile)
                .maybeSingle()

            if (fetchError) throw fetchError
            if (!data) {
                setError('Invalid Staff ID or mobile number')
                setLoading(false)
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
        <main className="admission-portal admin-login-portal">
            <div className="admission-portal__header">
                <div className="admission-portal__brand-block">
                    <div className="admission-portal__brand">
                        <img src={crest} alt="Vijayam crest" />
                    </div>
                    <div className="admission-portal__brand-text">
                        <div className="admission-portal__brand-title">Vijayam Arts & Science College</div>
                        <div className="admission-portal__brand-sub">Staff Portal</div>
                    </div>
                </div>
                <Link to="/roles" className="admission-portal__back">
                    <i className="bi bi-arrow-left"></i> Back to Roles
                </Link>
            </div>

            <div className="admin-login-portal__content">
                <div className="admin-login-portal__intro">
                    <h1>Staff portal login</h1>
                    <p>Use your Staff ID and registered mobile number.</p>
                </div>

                <section className="admin-login-card admin-login-card--portal" aria-live="polite">
                    <div className="admin-login-card-header">
                        <h2>Welcome back</h2>
                        <p>Use your credentials to continue.</p>
                    </div>
                    <form className="admin-login-form" onSubmit={onLogin} autoComplete="off">
                        <label className="admin-login-field">
                            <span>Staff ID</span>
                            <input
                                type="text"
                                className="admin-login-input"
                                name="staff_id_input"
                                value={staffId}
                                onChange={(event) => setStaffId(event.target.value)}
                                placeholder="Enter Staff ID"
                                required
                                autoComplete="off"
                            />
                        </label>

                        <label className="admin-login-field">
                            <span>Mobile Number</span>
                            <input
                                type="password"
                                className="admin-login-input"
                                name="staff_mobile_input"
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
