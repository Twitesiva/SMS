import AdminShell from '../../components/AdminShell'
import crestPrimary from '../../assets/media/images.png'
import { useState, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

const adminNavGroups = [

    {
        title: 'Exam Applications',
        static: true,
        items: [
            {
                to: '/admin-portal/applications',
                label: 'Exam Applications',
                icon: 'bi-inboxes'
            }
        ]
    },
    {
        title: 'Student Portal',
        items: [
            {
                to: '/admin-portal/academic-years',
                label: 'Academic Years',
                icon: 'bi-calendar3'
            },
            {
                to: '/admin-portal/groups-courses',
                label: 'Groups & Courses',
                icon: 'bi-diagram-3'
            },
            {
                to: '/admin-portal/subjects',
                label: 'Subjects',
                icon: 'bi-journal-text'
            }
        ]
    },
    {
        title: 'Fees Creation',
        static: true,
        items: [
            {
                to: '/admin-portal/fees-creation',
                label: 'Student Fees Creation',
                icon: 'bi-currency-rupee'
            }
        ]
    },    {
        title: 'Fees Collection',
        static: true,
        items: [
            {
                to: '/admin-portal/fees-collection',
                label: 'Fees Collection',
                icon: 'bi-cash-stack'
            }
        ]
    },
    {
        title: 'Profile Creation',
        static: true,
        items: [
            {
                to: '/admin-portal/profile-creation',
                label: 'Staff Profile Creation',
                icon: 'bi-person-plus-fill'
            }
        ]
    },
    {
        title: 'Staff Management',
        static: true,
        items: [
            {
                to: '/admin-portal/subject-mapping',
                label: 'Subject Mapping',
                icon: 'bi-person-lines-fill'
            }
        ]
    },
    {
        title: 'Department',
        static: true,
        items: [
            {
                to: '/admin-portal/department',
                label: 'Department',
                icon: 'bi-diagram-3'
            }
        ]
    },
    {
        title: 'Class Time Table',
        static: true,
        items: [
            {
                to: '/admin-portal/class-time-table',
                label: 'Class Time Table',
                icon: 'bi-calendar-date'
            }
        ]
    },
    {
        title: 'Class Time Table Creation',
        static: true,
        items: [
            {
                to: '/admin-portal/class-time-table-creation',
                label: 'Class Time Table Creation',
                icon: 'bi-calendar-plus'
            }
        ]
    }
]

export default function ClassTimeTableCreation() {
    const [timeTableName, setTimeTableName] = useState('')
    const [timeTables, setTimeTables] = useState([])
    const [loading, setLoading] = useState(false)
    const [editingId, setEditingId] = useState(null)

    useEffect(() => {
        fetchTimeTables()
    }, [])

    const fetchTimeTables = async () => {
        try {
            const { data, error } = await supabase
                .from('timetable_versions')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            setTimeTables(data || [])
        } catch (error) {
            console.error('Error fetching time tables:', error)
            toast.error('Failed to load time tables')
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!timeTableName.trim()) return

        setLoading(true)
        try {
            if (editingId) {
                // Update
                const { error } = await supabase
                    .from('timetable_versions')
                    .update({ timetable_name: timeTableName })
                    .eq('id', editingId)

                if (error) throw error
                toast.success('Time table updated successfully')
            } else {
                // Insert
                const { error } = await supabase
                    .from('timetable_versions')
                    .insert([{ timetable_name: timeTableName }])

                if (error) throw error
                toast.success('Time table created successfully')
            }

            setTimeTableName('')
            setEditingId(null)
            fetchTimeTables()
        } catch (error) {
            console.error('Error saving time table:', error)
            toast.error('Failed to save time table')
        } finally {
            setLoading(false)
        }
    }

    const handleEdit = (table) => {
        setTimeTableName(table.timetable_name)
        setEditingId(table.id)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this time table?')) return

        try {
            const { error } = await supabase
                .from('timetable_versions')
                .delete()
                .eq('id', id)

            if (error) throw error

            toast.success('Time table deleted')
            fetchTimeTables()
        } catch (error) {
            console.error('Error deleting time table:', error)
            toast.error('Failed to delete time table')
        }
    }

    const handleReset = () => {
        setTimeTableName('')
        setEditingId(null)
    }

    return (
        <AdminShell
            navGroups={adminNavGroups}
            brandTitle="Admin Management Console"
            brandSubtitle="Chittoor"
            footerTitle="Admin Management Studio"
            footerSubtitle="Crafted for Vijayam College"
        >
            <div className="desktop-container" style={{ overflowX: 'hidden' }}>
                <section className="setup-hero mb-4 text-center">
                    <div className="setup-hero-copywrap mx-auto text-center" style={{ maxWidth: '640px' }}>
                        <div className="admin-applications__crest mx-auto" aria-hidden="true">
                            <img src={crestPrimary} alt="Vijayam crest" />
                        </div>
                        <h3 className="setup-hero-title mb-2">Vijayam Arts & Science College</h3>
                        <p className="setup-hero-copy mb-3">Collect, verify, and onboard applicants with confidence.</p>
                        <div className="setup-hero-chips d-flex flex-wrap gap-2 justify-content-center">
                            <span className="setup-hero-chip text-uppercase">SMART EXAMINATION PLATFORM</span>
                            <span className="setup-hero-chip text-uppercase">ADMISSIONS CONTROL</span>
                            <span className="setup-hero-chip text-uppercase">APPLICATIONS ADMIN CONSOLE</span>
                        </div>
                    </div>
                </section>

                <div className="row g-4 justify-content-center mx-0">
                    <div className="col-12">
                        <div className="card card-soft p-4">
                            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                                <div>
                                    <h4 className="mb-1">Class Time Table Creation</h4>
                                    <p className="text-muted mb-0">Create new class time tables and schedules.</p>
                                </div>
                                <button type="button" className="btn btn-outline-secondary" onClick={handleReset}>Reset</button>
                            </div>

                            <form className="row g-3" onSubmit={handleSubmit}>
                                <div className="col-12">
                                    <label className="form-label">Class Time Table Name <span className="text-danger">*</span></label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Enter time table name"
                                        value={timeTableName}
                                        onChange={(e) => setTimeTableName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="col-12 d-flex justify-content-end">
                                    <button type="submit" className="btn btn-primary" disabled={!timeTableName || loading}>
                                        {loading ? 'Saving...' : (editingId ? 'Update Time Table' : 'Create Time Table')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* List of Time Tables */}
                    {timeTables.length > 0 && (
                        <div className="col-12">
                            <div className="card card-soft p-4">
                                <h4 className="mb-3">Saved Time Tables</h4>
                                <div className="table-responsive">
                                    <table className="table table-hover align-middle">
                                        <thead className="table-light">
                                            <tr>
                                                <th>Time Table Name</th>
                                                <th>Created At</th>
                                                <th className="text-end">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {timeTables.map((table) => (
                                                <tr key={table.id}>
                                                    <td className="fw-bold">{table.timetable_name}</td>
                                                    <td>{new Date(table.created_at).toLocaleDateString()}</td>
                                                    <td className="text-end">
                                                        <div className="d-flex justify-content-end gap-2">
                                                            <button
                                                                className="btn btn-sm btn-outline-primary"
                                                                onClick={() => handleEdit(table)}
                                                            >
                                                                <i className="bi bi-pencil"></i>
                                                            </button>
                                                            <button
                                                                className="btn btn-sm btn-outline-danger"
                                                                onClick={() => handleDelete(table.id)}
                                                            >
                                                                <i className="bi bi-trash"></i>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <ToastContainer position="top-right" autoClose={3000} />
        </AdminShell>
    )
}


