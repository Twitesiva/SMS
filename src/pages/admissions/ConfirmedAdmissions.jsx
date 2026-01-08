import { useEffect, useState } from 'react'
import AdminShell from '../../components/AdminShell'
import ConfirmationModal from '../../components/ConfirmationModal'
import { supabase } from '../../../supabaseClient'

import { showToast } from '../../store/ui'

const navGroups = [
    {
        title: 'Admissions Overview',
        static: true,
        items: [
            { to: '/admissions/overview', label: 'Admissions Overview', icon: 'bi-speedometer2' }
        ]
    },
    {
        title: 'Application Review',
        static: true,
        items: [
            { to: '/admissions/review', label: 'Application Review', icon: 'bi-file-earmark-check' }
        ]
    },
    {
        title: 'Student Application',
        static: true,
        items: [
            { to: '/admissions/application', label: 'Student Application', icon: 'bi-window-plus' }
        ]
    },
    {
        title: 'Admissions Enrolled',
        static: true,
        items: [
            { to: '/admissions/confirmed', label: 'Admissions Enrolled', icon: 'bi-person-check' }
        ]
    }
]

export default function ConfirmedAdmissions() {
    const [applications, setApplications] = useState([])
    const [loading, setLoading] = useState(false)
    const [meta, setMeta] = useState({ groups: {}, courses: {} })
    const [selectedApp, setSelectedApp] = useState(null)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [appToDelete, setAppToDelete] = useState(null)

    useEffect(() => {
        const loadMetadata = async () => {
            const [gRes, cRes] = await Promise.all([
                supabase.from('groups').select('group_id, group_name'),
                supabase.from('courses').select('course_id, course_name, course_code')
            ])
            const groupsMap = {}
            if (gRes.data) gRes.data.forEach(g => { groupsMap[g.group_id] = g })

            const coursesMap = {}
            if (cRes.data) cRes.data.forEach(c => { coursesMap[c.course_id] = c })

            setMeta({ groups: groupsMap, courses: coursesMap })
        }
        loadMetadata()
    }, [])

    const fetchConfirmedApplications = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('applications')
            .select(`
                *,
                documents:application_documents(*),
                admission:admissions(
                    *,
                    student:students(*)
                )
            `)
            .eq('status', 'CONFIRMED')
            .order('created_at', { ascending: false })

        if (!error) {
            setApplications(data || [])
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchConfirmedApplications()
    }, [])

    const confirmDelete = (app) => {
        setAppToDelete(app)
        setShowDeleteModal(true)
    }

    const handleDeleteAdmission = async () => {
        if (!appToDelete) return

        setLoading(true)
        try {
            // Get admission record (handle array/object case)
            const admissionRecord = Array.isArray(appToDelete.admission) ? appToDelete.admission[0] : appToDelete.admission
            const studentId = admissionRecord?.student_id

            // 1. Unlink student from admission and reset admission status
            const { error: admError } = await supabase
                .from('admissions')
                .update({
                    student_id: null,
                    admission_status: 'PENDING',
                    confirmed_at: null,
                    confirmed_by: null
                })
                .eq('application_id', appToDelete.id)

            if (admError) throw admError

            // 2. Delete student record
            if (studentId) {
                const { error: delError } = await supabase
                    .from('students')
                    .delete()
                    .eq('id', studentId)

                if (delError) throw delError
            }

            // 3. Reset Application Status to SUBMITTED (so it returns to review list)
            const { error: appError } = await supabase
                .from('applications')
                .update({ status: 'SUBMITTED', application_status: 'SUBMITTED' })
                .eq('id', appToDelete.id)

            if (appError) throw appError

            // Success
            showToast('Admission cancelled and student record removed.', { type: 'success' })
            setShowDeleteModal(false)
            setAppToDelete(null)
            fetchConfirmedApplications()

        } catch (error) {
            console.error('Error deleting admission:', error)
            showToast('Failed to delete: ' + error.message, { type: 'error' })
        } finally {
            setLoading(false)
        }
    }

    // Helper to extract student ID safely
    const getStudentIdDisplay = (app) => {
        const adm = Array.isArray(app.admission) ? app.admission[0] : app.admission
        return adm?.student?.student_id || adm?.student_id || 'Pending'
    }

    return (
        <AdminShell
            navGroups={navGroups}
            brandTitle="Admissions Portal"
            brandSubtitle="Admissions Enrolled"
            footerTitle="Admission Management"
            footerSubtitle="Administrator Access"
        >
            <div className="container-fluid p-0">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h4 className="mb-0">Admissions Enrolled</h4>
                    <span className="badge bg-success fs-6">{applications.length} Students</span>
                </div>

                {selectedApp ? (
                    <div className="card shadow-sm border-0 mb-4 overflow-hidden">
                        {/* Header Banner */}
                        <div className="bg-primary text-white p-4 d-flex justify-content-between align-items-center">
                            <div>
                                <h3 className="mb-1 fw-bold">{selectedApp.full_name}</h3>
                                <div className="d-flex align-items-center gap-2 opacity-75">
                                    <i className="bi bi-card-heading"></i>
                                    <span>Application No: {selectedApp.application_no}</span>
                                </div>
                            </div>
                            <div className="text-end">
                                <span className="badge bg-white text-primary px-3 py-2 fw-bold shadow-sm">
                                    <i className="bi bi-check-circle-fill me-1"></i> ADMITTED
                                </span>
                            </div>
                        </div>

                        <div className="card-body p-0">
                            <div className="row g-0">
                                {/* Left Sidebar - Photo & ID */}
                                <div className="col-md-3 bg-light border-end p-4 text-center d-flex flex-column align-items-center justify-content-center">
                                    <div className="mb-3 position-relative">
                                        {selectedApp.photo_url ? (
                                            <img
                                                src={selectedApp.photo_url}
                                                alt="Student"
                                                className="rounded shadow-sm border border-4 border-white"
                                                style={{ width: '160px', height: '190px', objectFit: 'cover' }}
                                            />
                                        ) : (
                                            <div className="bg-white rounded shadow-sm border border-4 border-white d-flex align-items-center justify-content-center" style={{ width: '160px', height: '190px' }}>
                                                <i className="bi bi-person-fill fs-1 text-muted"></i>
                                            </div>
                                        )}
                                    </div>
                                    <div className="w-100">
                                        <div className="text-uppercase text-muted small fw-bold mb-1">Student ID</div>
                                        <div className="bg-white border rounded p-2 fw-bold text-primary font-monospace shadow-sm">
                                            {getStudentIdDisplay(selectedApp)}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Content - Details Grid */}
                                <div className="col-md-9 p-4 bg-white">
                                    <h6 className="text-primary fw-bold text-uppercase mb-3 border-bottom pb-2">Academic & Personal Details</h6>

                                    <div className="d-flex flex-column gap-3 mb-4">
                                        {[
                                            { label: 'Student Name', value: selectedApp.full_name },
                                            { label: 'Course', value: meta.courses[selectedApp.course_id]?.course_name || selectedApp.course_id },
                                            { label: 'Group', value: meta.groups[selectedApp.group_id]?.group_name || selectedApp.group_id },
                                            { label: 'Date of Birth', value: selectedApp.date_of_birth ? new Date(selectedApp.date_of_birth).toLocaleDateString() : '-' },
                                            { label: 'Gender', value: selectedApp.gender },
                                            { label: 'Phone Number', value: selectedApp.phone_number, monospace: true },
                                            { label: 'Address', value: `${selectedApp.address} ${selectedApp.state ? `, ${selectedApp.state}` : ''}` }
                                        ].map((item, idx) => (
                                            <div key={idx} className="d-flex align-items-baseline gap-3">
                                                <div className="d-flex justify-content-between text-muted text-uppercase small fw-bold" style={{ minWidth: '160px', width: '160px' }}>
                                                    <span>{item.label}</span>
                                                    <span>:</span>
                                                </div>
                                                <div className={`fw-bold text-dark ${item.monospace ? 'font-monospace' : ''} text-break`}>
                                                    {item.value}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Action Footer integrated in right panel or separate */}
                                    <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
                                        <button
                                            className="btn btn-light border text-muted px-4"
                                            onClick={() => setSelectedApp(null)}
                                        >
                                            Close View
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="card card-soft p-4">
                        <div className="table-responsive">
                            <table className="table table-hover align-middle">
                                <thead className="table-light">
                                    <tr>
                                        <th>S.No</th>
                                        <th>Student ID</th>
                                        <th>App No</th>
                                        <th>Student Name</th>
                                        <th>Course</th>
                                        <th>Group</th>
                                        <th>Admission Date</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="8" className="text-center py-4">Loading...</td></tr>
                                    ) : applications.length === 0 ? (
                                        <tr><td colSpan="8" className="text-center py-4 text-muted">No confirmed admissions found.</td></tr>
                                    ) : (
                                        applications.map((app, index) => (
                                            <tr key={app.id}>
                                                <td>{index + 1}</td>
                                                <td className="fw-bold font-monospace text-primary">{getStudentIdDisplay(app)}</td>
                                                <td className="fw-bold">{app.application_no}</td>
                                                <td>
                                                    <div className="d-flex align-items-center">
                                                        {app.photo_url && <img src={app.photo_url} alt="" className="rounded-circle me-2" style={{ width: '30px', height: '30px', objectFit: 'cover' }} />}
                                                        {app.full_name}
                                                    </div>
                                                </td>
                                                <td>{meta.courses[app.course_id]?.course_name || '-'}</td>
                                                <td>{meta.groups[app.group_id]?.group_name || '-'}</td>
                                                <td>{app.admission?.confirmed_at || (Array.isArray(app.admission) && app.admission[0]?.confirmed_at) ? new Date(app.admission.confirmed_at || app.admission[0].confirmed_at).toLocaleDateString() : '-'}</td>
                                                <td>
                                                    <div className="d-flex gap-2">
                                                        <button
                                                            className="btn btn-sm btn-outline-primary"
                                                            onClick={() => setSelectedApp(app)}
                                                            title="View Details"
                                                        >
                                                            View Details
                                                        </button>
                                                        <button
                                                            className="btn btn-sm btn-outline-danger"
                                                            onClick={() => confirmDelete(app)}
                                                            title="Delete Admission"
                                                        >
                                                            <i className="bi bi-trash"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            <ConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleDeleteAdmission}
                title="Cancel Admission"
                message={`Are you sure you want to cancel admission for ${appToDelete?.full_name}? This will remove the student record and return the application to the review list.`}
                confirmText="Cancel Admission"
                confirmButtonClass="btn-danger"
                isLoading={loading}
            />
        </AdminShell>
    )
}
