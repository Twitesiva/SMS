import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../../supabaseClient'
import { useParentAuth } from '../../store/parentAuth'
import crest from '../../assets/media/images.png'
import '../common/Auth.css'
import '../common/AdmissionPortal.css'
import { resolveStudentCourseGroup } from '../../lib/resolveStudentCourseGroup'

export default function ParentLogin() {
    const nav = useNavigate()
    const { setParent } = useParentAuth()
    const [studentId, setStudentId] = useState('')
    const [studentMobile, setStudentMobile] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const onLogin = async (event) => {
        event.preventDefault()
        setLoading(true)
        setError('')

        const cleanStudentId = studentId.trim()
        const cleanMobile = studentMobile.trim()

        try {
            // Validate credentials against students table using phone_number (Student Mobile)
            const { data, error: fetchError } = await supabase
                .from('students')
                .select(
                    'id, student_id, full_name, hall_ticket_no, academic_year, group_name, course_name, Parent_no, phone_number, status, photo_url, current_semester'
                )
                .eq('student_id', cleanStudentId)
                .eq('phone_number', cleanMobile)
                .maybeSingle()

            if (fetchError) throw fetchError
            if (!data) {
                setError('Invalid Student ID or Student Mobile Number')
                setLoading(false)
                return
            }

            const resolvedParent = await resolveStudentCourseGroup(supabase, data)
            setParent(resolvedParent)
            nav('/parent/student-details')
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
                        <div className="admission-portal__brand-sub">Parent Portal</div>
                    </div>
                </div>
                <Link to="/roles" className="admission-portal__back" style={{ position: 'fixed', top: '18px', right: '24px', zIndex: 1000 }}>
                    <i className="bi bi-arrow-left"></i> Back to Roles
                </Link>
            </div>

            <div className="admin-login-portal__content">
                <div className="admin-login-portal__intro">
                    <h1>Parent portal login</h1>
                    <p>Enter Student ID and Registered Student Mobile Number.</p>
                </div>

                <section className="admin-login-card admin-login-card--portal" aria-live="polite">
                    <div className="admin-login-card-header">
                        <h2>Welcome back</h2>
                        <p>Use your student credentials to continue.</p>
                    </div>
                    <form className="admin-login-form" onSubmit={onLogin} autoComplete="off">
                        <label className="admin-login-field">
                            <span>Student ID</span>
                            <input
                                type="text"
                                className="admin-login-input"
                                value={studentId}
                                onChange={(event) => setStudentId(event.target.value)}
                                placeholder="Enter Student ID"
                                required
                                autoComplete="off"
                            />
                        </label>

                        <label className="admin-login-field">
                            <span>Student Mobile Number</span>
                            <input
                                type="tel"
                                className="admin-login-input"
                                value={studentMobile}
                                onChange={(event) => setStudentMobile(event.target.value)}
                                placeholder="Enter Student Mobile Number"
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
