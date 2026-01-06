import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../../supabaseClient'
import { useParentAuth } from '../../store/parentAuth'
import crest from '../../assets/media/images.png'

export default function ParentLogin() {
    const nav = useNavigate()
    const { setParent } = useParentAuth()
    const [studentId, setStudentId] = useState('')
    const [parentMobile, setParentMobile] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const onLogin = async (event) => {
        event.preventDefault()
        setLoading(true)
        setError('')

        const cleanStudentId = studentId.trim()
        const cleanMobile = parentMobile.trim()

        try {
            // Validate credentials against students table using Parent_no
            const { data, error: fetchError } = await supabase
                .from('students')
                .select(
                    'id, student_id, full_name, hall_ticket_no, academic_year, group_name, course_name, Parent_no, status, photo_url, current_semester'
                )
                .eq('student_id', cleanStudentId)
                .eq('Parent_no', cleanMobile)
                .maybeSingle()

            if (fetchError) throw fetchError
            if (!data) {
                setError('Invalid Student ID or Parent Mobile Number')
                setLoading(false)
                return
            }

            setParent(data)
            nav('/parent/dashboard')
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
                        <div className="student-login__title">Parent Portal</div>
                        <div className="student-login__subtitle">Vijayam Arts & Science College</div>
                    </div>
                </div>

                <h2 className="student-login__heading">Parent Login</h2>
                <p className="student-login__copy">Enter Student ID and Registered Parent Mobile Number.</p>

                <form className="student-login__form" onSubmit={onLogin} autoComplete="off">
                    <label className="student-login__field">
                        <span>Student ID</span>
                        <input
                            type="text"
                            value={studentId}
                            onChange={(event) => setStudentId(event.target.value)}
                            placeholder="Enter Student ID"
                            required
                            autoComplete="off"
                        />
                    </label>

                    <label className="student-login__field">
                        <span>Parent Mobile Number</span>
                        <input
                            type="tel"
                            value={parentMobile}
                            onChange={(event) => setParentMobile(event.target.value)}
                            placeholder="Enter Parent Mobile Number"
                            required
                            autoComplete="new-password"
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
