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
        <main className="student-login">
            <div className="student-login__card">
                <div className="student-login__brand">
                    <img src={crest} alt="Vijayam crest" />
                    <div>
                        <div className="student-login__title">Staff Portal</div>
                        <div className="student-login__subtitle">Vijayam Arts & Science College</div>
                    </div>
                </div>

                <h2 className="student-login__heading">Staff Login</h2>
                <p className="student-login__copy">Use your Staff ID and registered mobile number.</p>

                <form className="student-login__form" onSubmit={onLogin}>
                    <label className="student-login__field">
                        <span>Staff ID</span>
                        <input
                            type="text"
                            value={staffId}
                            onChange={(event) => setStaffId(event.target.value)}
                            placeholder="Staff ID"
                            required
                        />
                    </label>

                    <label className="student-login__field">
                        <span>Mobile Number (Password)</span>
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
