import React, { useState, useEffect } from 'react'
import AdminShell from '../../components/AdminShell'
import crestPrimary from '../../assets/media/images.png'
import { supabase } from '../../../supabaseClient'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

const adminNavGroups = [
    {
        title: 'Applications',
        static: true,
        items: [
            {
                to: '/admin-portal/applications',
                label: 'Applications',
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
    }, {
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
        title: 'Circulars',
        static: true,
        items: [
            {
                to: '/admin-portal/circulars',
                label: 'Circulars',
                icon: 'bi-megaphone'
            }
        ]
    },
    {
        title: 'Payment Reports',
        static: true,
        items: [
            {
                to: '/admin-portal/payment-reports',
                label: 'Payment Reports',
                icon: 'bi-file-earmark-bar-graph'
            }
        ]
    }
]

export default function Circulars() {
    const [circulars, setCirculars] = useState([])
    const [loading, setLoading] = useState(false)
    const [viewMode, setViewMode] = useState('list') // 'list', 'create', 'edit', 'view'
    const [viewData, setViewData] = useState(null)
    const [formData, setFormData] = useState({
        id: null,
        title: '',
        description: '',
        target_audience: 'ALL',
        publish_date: '',
        expiry_date: '',
        is_active: true,
        group_id: '',
        course_id: ''
    })
    const [groups, setGroups] = useState([])
    const [courses, setCourses] = useState([])

    useEffect(() => {
        fetchCirculars()
        fetchDropdowns()
    }, [])

    const fetchDropdowns = async () => {
        try {
            const { data: groupsData } = await supabase
                .from('groups')
                .select('*')
                .order('group_name', { ascending: true })
            setGroups(groupsData || [])

            const { data: coursesData } = await supabase
                .from('courses')
                .select('*')
                .order('course_name', { ascending: true })
            setCourses(coursesData || [])
        } catch (error) {
            console.error('Error fetching dropdowns:', error)
        }
    }

    const fetchCirculars = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('circulars')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            setCirculars(data || [])
        } catch (error) {
            console.error('Error fetching circulars:', error)
            toast.error('Failed to load circulars')
        } finally {
            setLoading(false)
        }
    }

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }))
    }

    const resetForm = () => {
        setFormData({
            id: null,
            title: '',
            description: '',
            target_audience: 'ALL',
            publish_date: new Date().toISOString().slice(0, 16), // current datetime-local
            expiry_date: '',
            is_active: true,
            group_id: '',
            course_id: ''
        })
        setViewMode('list')
        setViewData(null)
    }

    const openCreate = () => {
        setFormData({
            id: null,
            title: '',
            description: '',
            target_audience: 'ALL',
            publish_date: new Date().toISOString().slice(0, 16),
            expiry_date: '',
            is_active: true,
            group_id: '',
            course_id: ''
        })
        setViewMode('create')
    }

    const openEdit = (circular) => {
        setFormData({
            id: circular.id,
            title: circular.title,
            description: circular.description,
            target_audience: circular.target_audience,
            publish_date: circular.publish_date ? new Date(circular.publish_date).toISOString().slice(0, 16) : '',
            expiry_date: circular.expiry_date ? new Date(circular.expiry_date).toISOString().slice(0, 16) : '',
            is_active: circular.is_active,
            group_id: circular.group_id || '',
            course_id: circular.course_id || ''
        })
        setViewMode('edit')
    }

    const openView = (circular) => {
        setViewData(circular)
        setViewMode('view')
    }

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this circular?')) return

        try {
            const { error } = await supabase
                .from('circulars')
                .delete()
                .eq('id', id)

            if (error) throw error
            toast.success('Circular deleted successfully')
            fetchCirculars()
            if (viewMode === 'view' && viewData?.id === id) {
                resetForm()
            }
        } catch (error) {
            console.error('Error deleting circular:', error)
            toast.error('Failed to delete circular')
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!formData.title || !formData.description) {
            toast.warning('Title and Description are required')
            return
        }

        try {
            setLoading(true)
            const { data: userData, error: userError } = await supabase.auth.getUser()
            if (userError || !userData.user) throw new Error('User not authenticated')

            const payload = {
                title: formData.title,
                description: formData.description,
                target_audience: formData.target_audience,
                publish_date: formData.publish_date || new Date().toISOString(),
                expiry_date: formData.expiry_date || null,
                is_active: formData.is_active,
                created_by: userData.user.id,
                group_id: formData.group_id || null,
                course_id: formData.course_id || null
            }

            if (viewMode === 'edit' && formData.id) {
                // Update
                const { error } = await supabase
                    .from('circulars')
                    .update(payload)
                    .eq('id', formData.id)

                if (error) throw error
                toast.success('Circular updated successfully')
            } else {
                // Create
                const { error } = await supabase
                    .from('circulars')
                    .insert([payload])

                if (error) throw error
                toast.success('Circular created successfully')
            }

            resetForm()
            fetchCirculars()

        } catch (error) {
            console.error('Error saving circular:', error)
            toast.error(error.message || 'Failed to save circular')
        } finally {
            setLoading(false)
        }
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
                        <p className="setup-hero-copy mb-3">Manage and post circulars for students and staff.</p>
                        <div className="setup-hero-chips d-flex flex-wrap gap-2 justify-content-center">
                            <span className="setup-hero-chip text-uppercase">COMMUNICATION</span>
                            <span className="setup-hero-chip text-uppercase">ANNOUNCEMENTS</span>
                            <span className="setup-hero-chip text-uppercase">UPDATES</span>
                        </div>
                    </div>
                </section>

                <div className="row g-4 justify-content-center mx-0">
                    <div className="col-12">
                        <div className="card card-soft p-4">
                            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                                <div>
                                    <h4 className="mb-1">
                                        {viewMode === 'list' ? 'Circulars Management' :
                                            viewMode === 'create' ? 'Create New Circular' :
                                                viewMode === 'edit' ? 'Edit Circular' : 'View Circular'}
                                    </h4>
                                    <p className="text-muted mb-0">
                                        {viewMode === 'list' ? 'Create, edit, and manage circulars.' :
                                            viewMode === 'view' ? 'Circular details.' : 'Fill in the details below.'}
                                    </p>
                                </div>
                                {viewMode === 'list' && (
                                    <button className="btn btn-primary" onClick={openCreate}>
                                        <i className="bi bi-plus-lg me-2"></i>Create Circular
                                    </button>
                                )}
                                {viewMode !== 'list' && (
                                    <button className="btn btn-outline-secondary" onClick={resetForm}>
                                        <i className="bi bi-arrow-left me-2"></i>Back to List
                                    </button>
                                )}
                            </div>

                            {viewMode === 'list' && (
                                <div className="table-responsive">
                                    {circulars.length > 0 ? (
                                        <table className="table table-hover align-middle">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>Title</th>
                                                    <th>Audience</th>
                                                    <th>Publish Date</th>
                                                    <th>Status</th>
                                                    <th className="text-end">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {circulars.map((c) => (
                                                    <tr key={c.id}>
                                                        <td className="fw-bold">{c.title}</td>
                                                        <td>
                                                            <div className="d-flex flex-column align-items-start gap-1">
                                                                <span className="badge bg-light text-dark border">{c.target_audience}</span>
                                                                {c.group_id && groups.length > 0 && (
                                                                    <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                                                                        <i className="bi bi-diagram-3 me-1"></i>
                                                                        {groups.find(g => g.group_id == c.group_id)?.group_name || 'Group'}
                                                                    </small>
                                                                )}
                                                                {c.course_id && courses.length > 0 && (
                                                                    <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                                                                        <i className="bi bi-journal-text me-1"></i>
                                                                        {courses.find(cItem => cItem.course_id == c.course_id)?.course_name || 'Course'}
                                                                    </small>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td>{new Date(c.publish_date).toLocaleDateString()}</td>
                                                        <td>
                                                            {c.is_active ?
                                                                <span className="badge bg-success bg-opacity-10 text-success">Active</span> :
                                                                <span className="badge bg-secondary bg-opacity-10 text-secondary">Inactive</span>
                                                            }
                                                        </td>
                                                        <td className="text-end">
                                                            <div className="d-flex justify-content-end gap-2">
                                                                <button className="btn btn-sm btn-outline-info" onClick={() => openView(c)} title="View">
                                                                    <i className="bi bi-eye"></i>
                                                                </button>
                                                                <button className="btn btn-sm btn-outline-primary" onClick={() => openEdit(c)} title="Edit">
                                                                    <i className="bi bi-pencil"></i>
                                                                </button>
                                                                <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(c.id)} title="Delete">
                                                                    <i className="bi bi-trash"></i>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="text-center py-5">
                                            <div className="mb-3">
                                                <i className="bi bi-megaphone display-4 text-muted"></i>
                                            </div>
                                            <h5>No Circulars Found</h5>
                                            <p className="text-muted">Start by creating a new circular announcement.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {viewMode === 'view' && viewData && (
                                <div className="card-body p-0">
                                    <div className="row g-4">
                                        <div className="col-12">
                                            <div className="d-flex justify-content-between align-items-start border-bottom pb-3 mb-3">
                                                <div>
                                                    <h3 className="h4 mb-1 text-primary">{viewData.title}</h3>
                                                    <div className="d-flex gap-2 align-items-center text-muted small">
                                                        <span><i className="bi bi-calendar-event me-1"></i>Published: {new Date(viewData.publish_date).toLocaleString()}</span>
                                                        {viewData.expiry_date && (
                                                            <span><i className="bi bi-hourglass-split me-1"></i>Expires: {new Date(viewData.expiry_date).toLocaleString()}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-end">
                                                    <span className={`badge ${viewData.is_active ? 'bg-success' : 'bg-secondary'} mb-2 d-block`}>
                                                        {viewData.is_active ? 'Active' : 'Inactive'}
                                                    </span>
                                                    <span className="badge bg-light text-dark border">
                                                        Audience: {viewData.target_audience}
                                                    </span>
                                                    {viewData.group_id && (
                                                        <span className="badge bg-info bg-opacity-10 text-info border ms-1">
                                                            Group: {groups.find(g => g.group_id === viewData.group_id)?.group_name || '...'}
                                                        </span>
                                                    )}
                                                    {viewData.course_id && (
                                                        <span className="badge bg-warning bg-opacity-10 text-warning border ms-1">
                                                            Course: {courses.find(c => c.course_id === viewData.course_id)?.course_name || '...'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="bg-light p-4 rounded border">
                                                <h6 className="text-uppercase text-muted small fw-bold mb-3">Description / Content</h6>
                                                <p className="mb-0" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                                                    {viewData.description}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="col-12 d-flex justify-content-end gap-2 mt-4">
                                            <button className="btn btn-outline-primary" onClick={() => openEdit(viewData)}>
                                                <i className="bi bi-pencil me-2"></i>Edit
                                            </button>
                                            <button className="btn btn-danger" onClick={() => {
                                                if (window.confirm('Delete this circular?')) {
                                                    handleDelete(viewData.id)
                                                }
                                            }}>
                                                <i className="bi bi-trash me-2"></i>Delete
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {(viewMode === 'create' || viewMode === 'edit') && (
                                // Create/Edit Form
                                <form onSubmit={handleSubmit} className="row g-3">
                                    <div className="col-md-8">
                                        <label className="form-label">Title <span className="text-danger">*</span></label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            name="title"
                                            value={formData.title}
                                            onChange={handleInputChange}
                                            required
                                            placeholder="e.g. Annual Sports Day"
                                        />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label">Target Audience</label>
                                        <select
                                            className="form-select"
                                            name="target_audience"
                                            value={formData.target_audience}
                                            onChange={handleInputChange}
                                        >
                                            <option value="ALL">All Users</option>
                                            <option value="STUDENTS">Students Only</option>
                                            <option value="STAFF">Staff Only</option>
                                        </select>
                                    </div>

                                    <div className="col-md-6">
                                        <label className="form-label">Specific Group (Optional)</label>
                                        <select
                                            className="form-select"
                                            name="group_id"
                                            value={formData.group_id}
                                            onChange={handleInputChange}
                                        >
                                            <option value="">-- All Groups --</option>
                                            {groups.map(g => (
                                                <option key={g.group_id} value={g.group_id}>
                                                    {g.group_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label">Specific Course (Optional)</label>
                                        <select
                                            className="form-select"
                                            name="course_id"
                                            value={formData.course_id}
                                            onChange={handleInputChange}
                                        >
                                            <option value="">-- All Courses --</option>
                                            {courses
                                                .filter(c => !formData.group_id || c.group_name === groups.find(g => g.group_id == formData.group_id)?.group_name)
                                                .map(c => (
                                                    <option key={c.course_id} value={c.course_id}>
                                                        {c.course_name}
                                                    </option>
                                                ))}
                                        </select>
                                    </div>
                                    <div className="col-12">
                                        <label className="form-label">Description <span className="text-danger">*</span></label>
                                        <textarea
                                            className="form-control"
                                            name="description"
                                            rows="5"
                                            value={formData.description}
                                            onChange={handleInputChange}
                                            required
                                            placeholder="Enter the full content of the circular..."
                                        ></textarea>
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label">Publish Date</label>
                                        <input
                                            type="datetime-local"
                                            className="form-control"
                                            name="publish_date"
                                            value={formData.publish_date}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label">Expiry Date (Optional)</label>
                                        <input
                                            type="datetime-local"
                                            className="form-control"
                                            name="expiry_date"
                                            value={formData.expiry_date}
                                            onChange={handleInputChange}
                                        />
                                    </div>

                                    <div className="col-12 d-flex justify-content-end gap-2 mt-4">
                                        <button type="button" className="btn btn-outline-secondary" onClick={resetForm}>Cancel</button>
                                        <button type="submit" className="btn btn-primary" disabled={loading}>
                                            {loading ? 'Saving...' : (viewMode === 'create' ? 'Publish Circular' : 'Update Circular')}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <ToastContainer position="top-right" autoClose={3000} />
        </AdminShell>
    )
}
