import { useEffect, useState } from 'react'
import AdminShell from '../../components/AdminShell'
import ConfirmationModal from '../../components/ConfirmationModal'
import { supabase } from '../../../supabaseClient'

import { showToast } from '../../store/ui'

const navGroups = [
    {
        title: 'Overview',
        static: true,
        items: [
            { to: '/admissions/overview', label: 'Admissions Overview', icon: 'bi-speedometer2' }
        ]
    },
    {
        title: 'Management',
        items: [
            { to: '/admissions/review', label: 'Application Review', icon: 'bi-file-earmark-check' },
            { to: '/admissions/confirmed', label: 'Confirmed Admissions', icon: 'bi-person-check' }
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
                admission:admissions(*)
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

    return (
        <AdminShell
            navGroups={navGroups}
            brandTitle="Admissions Portal"
            brandSubtitle="Confirmed Admissions"
            footerTitle="Admission Management"
            footerSubtitle="Administrator Access"
        >
            <div className="container-fluid p-0">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h4 className="mb-0">Confirmed Admissions</h4>
                    <span className="badge bg-success fs-6">{applications.length} Students</span>
                </div>

                {selectedApp ? (
                    <div className="card card-soft p-4 border-2 border-primary">
                        <div className="d-flex justify-content-between align-items-start border-bottom pb-4 mb-3">
                            <div>
                                <h4 className="mb-2 text-primary">{selectedApp.full_name}</h4>
                                <p className="mb-0 text-muted">Application No: <span className="fw-bold text-dark">{selectedApp.application_no}</span></p>
                            </div>
                            <button className="btn btn-outline-secondary btn-sm" onClick={() => setSelectedApp(null)}>
                                <i className="bi bi-x-lg"></i> Close
                            </button>
                        </div>

                        <div className="row g-4">
                            <div className="col-md-3 text-center">
                                {selectedApp.photo_url ? (
                                    <img src={selectedApp.photo_url} alt="Student" className="img-thumbnail" style={{ width: '150px', height: '180px', objectFit: 'cover' }} />
                                ) : (
                                    <div className="bg-light d-flex align-items-center justify-content-center border" style={{ width: '150px', height: '180px' }}>
                                        <i className="bi bi-person fs-1 text-muted"></i>
                                    </div>
                                )}
                                <div className="mt-2">
                                    <span className="badge bg-success">ADMITTED</span>
                                </div>
                            </div>
                            <div className="col-md-9">
                                <div className="row g-3">
                                    <div className="col-md-6">
                                        <label className="text-muted small text-uppercase">Course</label>
                                        <div className="fw-bold">{meta.courses[selectedApp.course_id]?.course_name || selectedApp.course_id}</div>
                                    </div>
                                    <div className="col-md-6">
                                        <label className="text-muted small text-uppercase">Group</label>
                                        <div className="fw-bold">{meta.groups[selectedApp.group_id]?.group_name || selectedApp.group_id}</div>
                                    </div>
                                    <div className="col-md-6">
                                        <label className="text-muted small text-uppercase">Date of Birth</label>
                                        <div>{selectedApp.date_of_birth}</div>
                                    </div>
                                    <div className="col-md-6">
                                        <label className="text-muted small text-uppercase">Gender</label>
                                        <div>{selectedApp.gender}</div>
                                    </div>
                                    <div className="col-md-6">
                                        <label className="text-muted small text-uppercase">Phone</label>
                                        <div>{selectedApp.phone_number}</div>
                                    </div>
                                    <div className="col-md-6">
                                        <label className="text-muted small text-uppercase">Admission ID</label>
                                        <div className="font-monospace">
                                            {Array.isArray(selectedApp.admission)
                                                ? selectedApp.admission[0]?.student_id
                                                : selectedApp.admission?.student_id || 'Pending Generation'}
                                        </div>
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
                                        <tr><td colSpan="7" className="text-center py-4">Loading...</td></tr>
                                    ) : applications.length === 0 ? (
                                        <tr><td colSpan="7" className="text-center py-4 text-muted">No confirmed admissions found.</td></tr>
                                    ) : (
                                        applications.map((app, index) => (
                                            <tr key={app.id}>
                                                <td>{index + 1}</td>
                                                <td className="fw-bold">{app.application_no}</td>
                                                <td>
                                                    <div className="d-flex align-items-center">
                                                        {app.photo_url && <img src={app.photo_url} alt="" className="rounded-circle me-2" style={{ width: '30px', height: '30px', objectFit: 'cover' }} />}
                                                        {app.full_name}
                                                    </div>
                                                </td>
                                                <td>{meta.courses[app.course_id]?.course_code || '-'}</td>
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
