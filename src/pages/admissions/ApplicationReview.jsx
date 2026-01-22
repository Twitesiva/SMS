import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AdmissionShell from '../../components/AdmissionShell'
import ConfirmationModal from '../../components/ConfirmationModal'
import { supabase } from '../../../supabaseClient'
import crestPrimary from '../../assets/media/images.png'

import { showToast } from '../../store/ui'
import './Admissions.css'

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

export default function ApplicationReview() {
    const [applications, setApplications] = useState([])
    const [searchQuery, setSearchQuery] = useState('')
    const [searchedApplication, setSearchedApplication] = useState(null)
    const [loading, setLoading] = useState(false)
    const [meta, setMeta] = useState({ groups: {}, courses: {} })
    const [showConfirmModal, setShowConfirmModal] = useState(false)
    const [showVerifyModal, setShowVerifyModal] = useState(false)

    // Filters
    const [filterGroup, setFilterGroup] = useState('')
    const [filterCourse, setFilterCourse] = useState('')

    useEffect(() => {
        const loadMetadata = async () => {
            const [gRes, cRes] = await Promise.all([
                supabase.from('groups').select('*'),
                supabase.from('courses').select('*')
            ])
            const groupsMap = {}
            if (gRes.data) gRes.data.forEach(g => { groupsMap[g.group_id || g.id] = g })

            const coursesMap = {}
            if (cRes.data) cRes.data.forEach(c => { coursesMap[c.course_id || c.id] = c })

            setMeta({ groups: groupsMap, courses: coursesMap })
        }
        loadMetadata()
    }, [])

    const fetchApplications = async () => {
        setLoading(true)
        // Check if we have foreign keys. If not, simple select.
        // We will fetch metadata separately to be safe.
        const { data, error } = await supabase
            .from('applications')
            .select(`
                *,
                documents:application_documents(*),
                admission:admissions(*)
            `)
            .neq('status', 'CONFIRMED')
            .order('created_at', { ascending: false })

        if (!error) {
            setApplications(data || [])
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchApplications()
    }, [])

    const handleSearch = async (e, overrideQuery) => {
        if (e) e.preventDefault()
        const query = overrideQuery || searchQuery

        if (!query.trim()) {
            setSearchedApplication(null)
            return
        }

        setLoading(true)
        const { data, error } = await supabase
            .from('applications')
            .select(`
                *,
                documents:application_documents(*),
                admission:admissions(*)
            `)
            .eq('application_no', query.trim())
            .single()

        if (!error && data) {
            setSearchedApplication(data)
        } else {
            setSearchedApplication(null)
        }
        setLoading(false)
    }

    const approveApplication = () => {
        setShowConfirmModal(true)
    }

    const navigate = useNavigate()

    const handleConfirmApproval = async () => {
        if (!searchedApplication) return

        setShowConfirmModal(false)

        // Navigate to Student Application form with data
        // Status updates will happen after successful student creation
        navigate('/admissions/application', {
            state: {
                applicationData: searchedApplication
            }
        })
    }

    const handleVerifyDocuments = () => {
        if (!searchedApplication) return
        setShowVerifyModal(true)
    }

    const confirmVerifyDocuments = async () => {
        if (!searchedApplication) return

        setLoading(true)
        try {
            const { error } = await supabase
                .from('admissions')
                .update({
                    document_verification_status: 'VERIFIED',
                    documents_verified_at: new Date().toISOString()
                })
                .eq('application_id', searchedApplication.id)

            if (error) throw error

            showToast('Documents verified successfully', { type: 'success' })

            // Update local state to reflect change (deep merge or re-fetch)
            setSearchedApplication(prev => ({
                ...prev,
                admission: Array.isArray(prev.admission)
                    ? [{ ...prev.admission[0], document_verification_status: 'VERIFIED' }]
                    : { ...prev.admission, document_verification_status: 'VERIFIED' }
            }))
            setShowVerifyModal(false)

        } catch (error) {
            console.error('Error verifying documents:', error)
            showToast('Failed to verify documents: ' + error.message, { type: 'error' })
        } finally {
            setLoading(false)
        }
    }

    const openImageInNewTab = (url) => {
        if (!url) return

        if (url.startsWith('http')) {
            window.open(url, '_blank')
        } else {
            const newWindow = window.open();
            if (newWindow) {
                newWindow.document.write(
                    `<html><body style="margin:0;display:flex;justify-content:center;align-items:center;background:#222;"><img src="${url}" style="max-width:100%;max-height:100vh;" /></body></html>`
                );
                newWindow.document.close();
            }
        }
    }

    return (
        <AdmissionShell
            navGroups={navGroups}
            brandTitle="Admissions Portal"
            brandSubtitle=""
            footerTitle="Admission Management"
            footerSubtitle="Administrator Access"
            className="admin-shell--admissions"
        >
            <div className="admissions-page">
                <section className="setup-hero mb-4">
                  <div className="setup-hero__inner">
                    <div className="setup-hero__content">
                      <div className="setup-hero__crest" aria-hidden="true">
                        <img src={crestPrimary} alt="Vijayam crest" />
                      </div>
                      <div>
                        <div className="setup-hero__eyebrow">Admissions 2026</div>
                        <h1 className="setup-hero__title mb-1">Vijayam College of Arts & Science</h1>

                        <p className="setup-hero__subtitle mb-0">
                          Admission portal for group registration and student engagement.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>
                <div className="container-fluid p-0">
                    <h4 className="mb-4">Application Review</h4>

                    <div className="card card-soft p-4 mb-4">
                        <form onSubmit={handleSearch} className="row g-3 align-items-end">
                            <div className="col-md-3">
                                <label className="form-label fw-bold">Search Application</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Enter Application No"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <div className="col-md-3">
                                <label className="form-label fw-bold">Filter by Group</label>
                                <select className="form-select" value={filterGroup} onChange={e => {
                                    setFilterGroup(e.target.value)
                                    setFilterCourse('')
                                }}>
                                    <option value="">All Groups</option>
                                    {Object.values(meta.groups).map(g => (
                                        <option key={g.group_id || g.id} value={g.group_id || g.id}>{g.name || g.group_name || g.code || g.group_code}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-md-3">
                                <label className="form-label fw-bold">Filter by Course</label>
                                <select className="form-select" value={filterCourse} onChange={e => setFilterCourse(e.target.value)}>
                                    <option value="">All Courses</option>
                                    {Object.values(meta.courses)
                                        .filter(c => {
                                            if (!filterGroup) return true
                                            // Resolve group name from selected ID
                                            const selectedGroup = meta.groups[filterGroup]
                                            // Match by group_name (schema-based) or group_id (legacy/future-proof)
                                            if (selectedGroup && c.group_name === selectedGroup.group_name) return true
                                            if (String(c.group_id || '') === String(filterGroup)) return true
                                            return false
                                        })
                                        .map(c => (
                                            <option key={c.course_id || c.id} value={c.course_id || c.id}>{c.name || c.course_name || c.code || c.course_code}</option>
                                        ))}
                                </select>
                            </div>
                            <div className="col-md-2">
                                <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                                    {loading ? 'Searching...' : 'Search'}
                                </button>
                            </div>
                            {searchedApplication && (
                                <div className="col-md-1">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary w-100"
                                        onClick={() => {
                                            setSearchedApplication(null);
                                            setSearchQuery('');
                                            setFilterGroup('');
                                            setFilterCourse('');
                                        }}
                                    >
                                        <i className="bi bi-x-lg"></i>
                                    </button>
                                </div>
                            )}
                        </form>
                    </div>

                    {searchedApplication && (
                        <div className="card card-soft p-4 mb-4 border-primary border-2">
                            <div className="row g-4">
                                {/* Header Section with Photo */}
                                <div className="col-12 border-bottom pb-4 mb-3">
                                    <div className="d-flex justify-content-between">
                                        <div>
                                            <h4 className="mb-2 text-primary">Application: {searchedApplication.application_no}</h4>
                                            <div className="d-flex gap-2">
                                                <span className={`badge ${searchedApplication.status === 'CONFIRMED' ? 'bg-success' : 'bg-warning text-dark'} fs-6`}>
                                                    {searchedApplication.status}
                                                </span>
                                                {/* Show Verification Status Badge */}
                                                {(() => {
                                                    const adm = Array.isArray(searchedApplication.admission) ? searchedApplication.admission[0] : searchedApplication.admission
                                                    if (adm?.document_verification_status === 'VERIFIED') {
                                                        return <span className="badge bg-info text-dark fs-6">Documents Verified</span>
                                                    }
                                                    return <span className="badge bg-secondary fs-6">Docs Pending</span>
                                                })()}
                                            </div>
                                        </div>
                                        {searchedApplication.photo_url && (
                                            <div className="border p-1 bg-white shadow-sm" style={{ width: '110px', height: '140px' }}>
                                                <img
                                                    src={searchedApplication.photo_url}
                                                    alt="Applicant"
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Section: Academic Information */}
                                <div className="col-12 col-lg-6">
                                    <h6 className="text-uppercase text-primary fw-bold mb-3 border-bottom pb-2">Academic Information</h6>
                                    <div className="mb-3">
                                        <div className="row mb-2">
                                            <div className="col-sm-5 text-muted">Admission Year :</div>
                                            <div className="col-sm-7 fw-bold">{searchedApplication.admission_year || '-'}</div>
                                        </div>
                                        <div className="row mb-2">
                                            <div className="col-sm-5 text-muted">Group :</div>
                                            <div className="col-sm-7 fw-semibold">{(() => {
                                                const g = meta.groups[searchedApplication.group_id]
                                                return g ? (g.name || g.group_name || g.code || g.group_code) : (searchedApplication.group_id || '-')
                                            })()}</div>
                                        </div>
                                        <div className="row mb-2">
                                            <div className="col-sm-5 text-muted">Course :</div>
                                            <div className="col-sm-7 fw-semibold">{(() => {
                                                const c = meta.courses[searchedApplication.course_id]
                                                return c ? (c.name || c.course_name || c.code || c.course_code) : (searchedApplication.course_id || '-')
                                            })()}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Section: Contact Information */}
                                <div className="col-12 col-lg-6">
                                    <h6 className="text-uppercase text-primary fw-bold mb-3 border-bottom pb-2">Contact Information</h6>
                                    <div className="mb-3">
                                        <div className="row mb-2">
                                            <div className="col-sm-5 text-muted">Mobile Number :</div>
                                            <div className="col-sm-7 font-monospace">{searchedApplication.phone_number || '-'}</div>
                                        </div>
                                        <div className="row mb-2">
                                            <div className="col-sm-5 text-muted">Parent Mobile :</div>
                                            <div className="col-sm-7 font-monospace">{searchedApplication.parent_no || '-'}</div>
                                        </div>
                                        <div className="row mb-2">
                                            <div className="col-sm-5 text-muted">Address :</div>
                                            <div className="col-sm-7">
                                                {searchedApplication.address}
                                                {searchedApplication.state ? `, ${searchedApplication.state}` : ''}
                                                {searchedApplication.pincode ? ` - ${searchedApplication.pincode}` : ''}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Section: Personal Details */}
                                <div className="col-12">
                                    <h6 className="text-uppercase text-primary fw-bold mb-3 border-bottom pb-2">Personal Details</h6>
                                    <div className="row">
                                        <div className="col-lg-6">
                                            <div className="row mb-2">
                                                <div className="col-sm-5 text-muted">Full Name :</div>
                                                <div className="col-sm-7 fw-bold">{searchedApplication.full_name || '-'}</div>
                                            </div>
                                            <div className="row mb-2">
                                                <div className="col-sm-5 text-muted">Date of Birth :</div>
                                                <div className="col-sm-7">{searchedApplication.date_of_birth ? new Date(searchedApplication.date_of_birth).toLocaleDateString() : '-'}</div>
                                            </div>
                                            <div className="row mb-2">
                                                <div className="col-sm-5 text-muted">Gender :</div>
                                                <div className="col-sm-7">{searchedApplication.gender || '-'}</div>
                                            </div>
                                            <div className="row mb-2">
                                                <div className="col-sm-5 text-muted">Nationality :</div>
                                                <div className="col-sm-7">{searchedApplication.nationality || '-'}</div>
                                            </div>
                                        </div>
                                        <div className="col-lg-6">
                                            <div className="row mb-2">
                                                <div className="col-sm-5 text-muted">Father's Name :</div>
                                                <div className="col-sm-7">{searchedApplication.father_name || '-'}</div>
                                            </div>
                                            <div className="row mb-2">
                                                <div className="col-sm-5 text-muted">Mother's Name :</div>
                                                <div className="col-sm-7">{searchedApplication.mother_name || '-'}</div>
                                            </div>
                                            <div className="row mb-2">
                                                <div className="col-sm-5 text-muted">Aadhar Number :</div>
                                                <div className="col-sm-7">{searchedApplication.aadhar_number || '-'}</div>
                                            </div>
                                            <div className="row mb-2">
                                                <div className="col-sm-5 text-muted">Community/Caste :</div>
                                                <div className="col-sm-7">{searchedApplication.religion} / {searchedApplication.caste}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {searchedApplication.documents && searchedApplication.documents.length > 0 && (
                                <div className="mt-4">
                                    <h6 className="text-muted text-uppercase small mb-3">Uploaded Documents</h6>
                                    <div className="d-flex gap-3 flex-wrap">
                                        {searchedApplication.documents.map(doc => (
                                            <div
                                                key={doc.id}
                                                className="card p-2 text-decoration-none text-dark bg-white border shadow-sm cursor-pointer"
                                                style={{ width: '160px', height: '180px', cursor: 'pointer' }}
                                                onClick={() => openImageInNewTab(doc.document_url)}
                                                title="Click to view full image in new tab"
                                            >
                                                <div className="bg-light mb-2 d-flex align-items-center justify-content-center overflow-hidden border rounded" style={{ height: '120px' }}>
                                                    <img
                                                        src={doc.document_url}
                                                        alt={doc.document_type}
                                                        className="w-100 h-100"
                                                        style={{ objectFit: 'cover' }}
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                            e.target.parentNode.innerHTML = '<i class="bi bi-file-earmark-text fs-1 text-secondary"></i>';
                                                        }}
                                                    />
                                                </div>
                                                <div className="small fw-bold text-truncate" title={doc.document_type}>{doc.document_type}</div>
                                                <div className="small text-muted"><i className="bi bi-box-arrow-up-right me-1"></i> View Full</div>
                                            </div>
                                        ))}
                                        {searchedApplication.photo_url && !searchedApplication.documents.some(d => d.document_type === 'Photo') && (
                                            <div
                                                className="card p-2 text-decoration-none text-dark bg-white border shadow-sm cursor-pointer"
                                                style={{ width: '160px', height: '180px', cursor: 'pointer' }}
                                                onClick={() => openImageInNewTab(searchedApplication.photo_url)}
                                                title="Click to view full image in new tab"
                                            >
                                                <div className="bg-light mb-2 d-flex align-items-center justify-content-center overflow-hidden border rounded" style={{ height: '120px' }}>
                                                    <img
                                                        src={searchedApplication.photo_url}
                                                        alt="Photo"
                                                        className="w-100 h-100"
                                                        style={{ objectFit: 'cover' }}
                                                    />
                                                </div>
                                                <div className="small fw-bold">Photo</div>
                                                <div className="small text-muted"><i className="bi bi-box-arrow-up-right me-1"></i> View Full</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="mt-4 border-top pt-3 d-flex justify-content-end gap-2">
                                {/* Verify Documents Button */}
                                {(() => {
                                    const adm = Array.isArray(searchedApplication.admission) ? searchedApplication.admission[0] : searchedApplication.admission
                                    if (adm && adm.document_verification_status !== 'VERIFIED') {
                                        return (
                                            <button
                                                className="btn btn-warning text-dark"
                                                onClick={handleVerifyDocuments}
                                            >
                                                <i className="bi bi-check-circle me-2"></i>Verify Documents
                                            </button>
                                        )
                                    }
                                    return null
                                })()}

                                {searchedApplication.status !== 'CONFIRMED' && (
                                    (() => {
                                        const adm = Array.isArray(searchedApplication.admission) ? searchedApplication.admission[0] : searchedApplication.admission
                                        const isFeePaid = adm?.admission_fee_paid

                                        if (!isFeePaid) {
                                            return (
                                                <button
                                                    className="btn btn-danger"
                                                    disabled
                                                    title="Admission fees must be paid before approval"
                                                >
                                                    Approve Admission (Fee Pending)
                                                </button>
                                            )
                                        }

                                        return (
                                            <button
                                                className="btn btn-success"
                                                onClick={approveApplication}
                                            >
                                                Approve Admission
                                            </button>
                                        )
                                    })()
                                )}
                            </div>
                        </div>
                    )}

                    {!searchedApplication && (
                        <div className="card card-soft p-4">
                            <h5 className="mb-3">Recent Applications</h5>
                            <div className="table-responsive">
                                <table className="table table-hover align-middle">
                                    <thead>
                                        <tr>
                                            <th>S.No</th>
                                            <th>Application No</th>
                                            <th>Name</th>
                                            <th>Year</th>
                                            <th>Group</th>
                                            <th>Course</th>
                                            <th>Status</th>
                                            <th>Submitted</th>
                                            <th>Doc Verification</th>
                                            <th>Fee Status</th>
                                            <th>Admission Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {applications.length === 0 ? (
                                            <tr>
                                                <td colSpan="11" className="text-center py-4 text-muted">
                                                    No pending applications found.
                                                </td>
                                            </tr>
                                        ) : (
                                            applications
                                                .filter(app => {
                                                    // Group Filter
                                                    if (filterGroup) {
                                                        const gId = String(app.group_id || '')
                                                        const fId = String(filterGroup)

                                                        // Direct match
                                                        let match = gId === fId

                                                        // Metadata match (robustness against ID/Name storage)
                                                        if (!match) {
                                                            const sGroup = meta.groups[filterGroup]
                                                            if (sGroup) {
                                                                if (gId === String(sGroup.group_name || '') || gId === String(sGroup.group_code || '')) match = true
                                                                if (app.group_name && app.group_name === sGroup.group_name) match = true
                                                            }
                                                        }

                                                        if (!match) return false
                                                    }

                                                    // Course Filter
                                                    if (filterCourse) {
                                                        const cId = String(app.course_id || '')
                                                        const fId = String(filterCourse)

                                                        let match = cId === fId

                                                        if (!match) {
                                                            const sCourse = meta.courses[filterCourse]
                                                            if (sCourse) {
                                                                if (cId === String(sCourse.course_name || '') || cId === String(sCourse.course_code || '')) match = true
                                                                if (app.course_name && app.course_name === sCourse.course_name) match = true
                                                            }
                                                        }

                                                        if (!match) return false
                                                    }
                                                    return true
                                                })
                                                .map((app, index) => {
                                                    const adm = Array.isArray(app.admission) ? app.admission[0] : app.admission
                                                    const docStatus = adm?.document_verification_status || 'Pending'
                                                    const feeStatus = adm?.admission_fee_paid ? 'Paid' : 'Pending'
                                                    const admissionStatus = adm?.admission_status || 'Pending'

                                                    return (
                                                        <tr
                                                            key={app.id}
                                                            style={{ cursor: 'pointer' }}
                                                            onClick={() => {
                                                                setSearchQuery(app.application_no);
                                                                handleSearch(null, app.application_no);
                                                            }}
                                                        >
                                                            <td>{index + 1}</td>
                                                            <td className="fw-bold text-primary">{app.application_no}</td>
                                                            <td>{app.full_name}</td>
                                                            <td>{app.admission_year}</td>
                                                            <td>{(() => {
                                                                const g = meta.groups[app.group_id]
                                                                return g ? (g.name || g.group_name || g.code) : (app.group_id || '-')
                                                            })()}</td>
                                                            <td>{(() => {
                                                                const c = meta.courses[app.course_id]
                                                                return c ? (c.name || c.course_name || c.code) : (app.course_id || '-')
                                                            })()}</td>
                                                            <td><span className="badge bg-secondary">{app.status}</span></td>
                                                            <td>{new Date(app.created_at).toLocaleDateString()}</td>
                                                            <td>
                                                                <span className={`badge ${docStatus === 'VERIFIED' ? 'bg-success' : 'bg-warning text-dark'}`}>
                                                                    {docStatus}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <span className={`badge ${feeStatus === 'Paid' ? 'bg-success' : 'bg-danger'}`}>
                                                                    {feeStatus}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <span className={`badge ${admissionStatus === 'APPROVED' ? 'bg-success' : 'bg-secondary'}`}>
                                                                    {admissionStatus}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    )
                                                })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <ConfirmationModal
                    isOpen={showConfirmModal}
                    onClose={() => setShowConfirmModal(false)}
                    onConfirm={handleConfirmApproval}
                    title="Approve Admission"
                    message={`Are you sure you want to approve admission for ${searchedApplication?.full_name}? This will create a student record and confirm the application.`}
                    confirmText="Approve Admission"
                    confirmButtonClass="btn-success"
                    isLoading={loading}
                />

                <ConfirmationModal
                    isOpen={showVerifyModal}
                    onClose={() => setShowVerifyModal(false)}
                    onConfirm={confirmVerifyDocuments}
                    title="Verify Documents"
                    message={`Are you sure you want to verify the documents for ${searchedApplication?.full_name}?`}
                    confirmText="Verify Documents"
                    confirmButtonClass="btn-warning text-dark"
                    isLoading={loading}
                />

                {/* Image Viewer Modal removed in favor of direct tab opening */}
            </div>
        </AdmissionShell>
    )
}
