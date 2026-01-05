import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../supabaseClient'
import crestPrimary from '../../assets/media/images.png'

import { showToast } from '../../store/ui'

export default function ApplicationTracker() {
    const [application, setApplication] = useState(null)
    const [admission, setAdmission] = useState(null)
    const [loading, setLoading] = useState(true)
    const [groupName, setGroupName] = useState('')
    const [courseName, setCourseName] = useState('')
    const navigate = useNavigate()

    useEffect(() => {
        const fetchDetails = async () => {
            const session = localStorage.getItem('studentAppSession')
            if (!session) {
                navigate('/admission/login')
                return
            }

            const { id } = JSON.parse(session)

            try {
                // Fetch Application + Admission + Lookup data manually because of joins
                // Actually we can fetch metadata separately or try joins if relationships exist.
                // We know relationships exist for admission.

                const { data: appData, error: appError } = await supabase
                    .from('applications')
                    .select('*, admission:admissions(*)')
                    .eq('id', id)
                    .single()

                if (appError || !appData) {
                    console.error('Error fetching application')
                    navigate('/admission/login')
                    return
                }

                setApplication(appData)
                setAdmission(Array.isArray(appData.admission) ? appData.admission[0] : appData.admission)

                // Fetch group and course names
                if (appData.group_id) {
                    const { data: g } = await supabase.from('groups').select('group_name').eq('group_id', appData.group_id).single()
                    setGroupName(g?.group_name || '')
                }
                if (appData.course_id) {
                    const { data: c } = await supabase.from('courses').select('course_name').eq('course_id', appData.course_id).single()
                    setCourseName(c?.course_name || '')
                }

            } catch (err) {
                console.error(err)
            } finally {
                setLoading(false)
            }
        }

        fetchDetails()
    }, [navigate])

    const handleLogout = () => {
        localStorage.removeItem('studentAppSession')
        navigate('/admission/login')
    }

    const loadRazorpay = () => {
        return new Promise((resolve) => {
            const script = document.createElement('script')
            script.src = 'https://checkout.razorpay.com/v1/checkout.js'
            script.onload = () => resolve(true)
            script.onerror = () => resolve(false)
            document.body.appendChild(script)
        })
    }

    const handlePayment = async () => {
        const res = await loadRazorpay()

        if (!res) {
            showToast('Razorpay SDK failed to load. Are you online?', { type: 'error' })
            return
        }

        const options = {
            key: 'rzp_test_1DP5mmOlF5G5ag', // Demo Test Key
            amount: 500000, // 5000 INR
            currency: 'INR',
            name: 'Vijayam College',
            description: 'Admission Fee Transaction',
            image: crestPrimary,
            handler: async function (response) {
                // Payment Success
                try {
                    setLoading(true)
                    const { error } = await supabase
                        .from('admissions')
                        .update({
                            admission_fee_paid: true,

                        })
                        .eq('id', admission.id)

                    if (error) throw error

                    setAdmission(prev => ({ ...prev, admission_fee_paid: true }))
                    showToast(`Payment Successful! Payment ID: ${response.razorpay_payment_id}`, { type: 'success' })

                } catch (err) {
                    showToast("Payment verification failed: " + err.message, { type: 'error' })
                } finally {
                    setLoading(false)
                }
            },
            prefill: {
                name: application.full_name,
                email: application.email || 'student@vijayam.edu',
                contact: application.phone_number
            },
            notes: {
                address: 'Vijayam College Campus'
            },
            theme: {
                color: '#3399cc'
            }
        };

        const paymentObject = new window.Razorpay(options);
        paymentObject.open();
    }

    if (loading) {
        return <div className="d-flex justify-content-center align-items-center vh-100">Loading...</div>
    }

    if (!application) return null

    // Determine Status Steps
    const isSubmitted = true
    // Assume approved status implies documents verified for now, or check explicit flag
    const isVerified = admission?.document_verification_status === 'VERIFIED'
    const isFeePaid = admission?.admission_fee_paid
    // Final approval depends on Admin Action (Database Status)
    const isApproved = admission?.admission_status === 'APPROVED' || admission?.admission_status === 'CONFIRMED'

    return (
        <div className="admission-portal" style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
            <style>{`
                .step-container {
                    position: relative;
                    padding-left: 3rem;
                    padding-bottom: 2rem;
                }
                .step-container:last-child {
                    padding-bottom: 0;
                }
                .step-line {
                    position: absolute;
                    left: 15px;
                    top: 35px;
                    bottom: -5px;
                    width: 2px;
                    background-color: #e9ecef;
                    z-index: 1;
                }
                .step-container:last-child .step-line {
                    display: none;
                }
                .step-icon {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 2;
                    transition: all 0.3s ease;
                }
                .step-content {
                    position: relative;
                }
            `}</style>
            <div className="admission-portal__header admission-portal__hero public-apply-hero">
                <div className="public-apply-hero-brand">
                    <img src={crestPrimary} className="brand-logo public-apply-logo" alt="Vijayam crest" />
                    <div>
                        <div className="public-apply-eyebrow">ADMISSIONS {application.admission_year}</div>
                        <h2 className="public-apply-title">Vijayam College of Arts & Science</h2>
                        <div className="public-apply-subtitle">Additional Applicant Services</div>
                    </div>
                </div>
                <button onClick={handleLogout} className="btn btn-outline-light btn-sm ms-auto d-block d-md-inline-block mt-3 mt-md-0">
                    <i className="bi bi-box-arrow-right me-1"></i> Logout
                </button>
            </div>

            <div className="container py-5">
                <div className="row g-4">
                    {/* Status Card */}
                    <div className="col-lg-4">
                        <div className="card border-0 shadow-sm h-100">
                            <div className="card-body p-4">
                                <h5 className="card-title fw-bold text-primary mb-4">Application Status</h5>

                                <div className="timeline-wrapper">
                                    {/* Step 1: Application Submitted */}
                                    <div className="step-container">
                                        <div className="step-line" style={{ backgroundColor: '#198754' }}></div>
                                        <div className="step-icon bg-success text-white">
                                            <i className="bi bi-check-lg"></i>
                                        </div>
                                        <div className="step-content">
                                            <h6 className="fw-bold mb-1 text-success">Application Submitted</h6>
                                            <small className="text-muted d-block">{new Date(application.created_at).toLocaleDateString()}</small>
                                        </div>
                                    </div>

                                    {/* Step 2: Documents Verified */}
                                    <div className="step-container">
                                        <div className="step-line" style={{ backgroundColor: isVerified ? '#198754' : '#ffca2c' }}></div>
                                        <div className={`step-icon ${isVerified ? 'bg-success text-white' : 'bg-warning text-dark'}`}>
                                            {isVerified ? <i className="bi bi-check-lg"></i> : <i className="bi bi-hourglass-split"></i>}
                                        </div>
                                        <div className="step-content">
                                            <h6 className={`fw-bold mb-1 ${isVerified ? 'text-success' : 'text-warning'}`}>
                                                {isVerified ? 'Documents Verified' : 'Documents Verification'}
                                            </h6>
                                            <small className={`${isVerified ? 'text-muted' : 'text-warning'} d-block`}>
                                                {isVerified ? 'Verification Complete' : 'In Progress (Ongoing)'}
                                            </small>
                                        </div>
                                    </div>

                                    {/* Step 3: Fee Payment */}
                                    <div className="step-container">
                                        <div className="step-line" style={{ backgroundColor: isFeePaid ? '#198754' : isVerified ? '#ffca2c' : '#dc3545' }}></div>
                                        <div className={`step-icon ${isFeePaid ? 'bg-success text-white' : isVerified ? 'bg-warning text-dark' : 'bg-danger text-white'}`}>
                                            {isFeePaid ? <i className="bi bi-check-lg"></i> : isVerified ? <i className="bi bi-credit-card"></i> : <i className="bi bi-lock-fill"></i>}
                                        </div>
                                        <div className="step-content">
                                            <h6 className={`fw-bold mb-1 ${isFeePaid ? 'text-success' : isVerified ? 'text-warning' : 'text-danger'}`}>
                                                Fee Payment
                                            </h6>
                                            <small className={`${isFeePaid ? 'text-muted' : isVerified ? 'text-warning' : 'text-danger'} d-block`}>
                                                {isFeePaid ? 'Payment Received' : isVerified ? 'Action Required' : 'Locked'}
                                            </small>
                                        </div>
                                    </div>

                                    {/* Step 4: Admission Approved */}
                                    <div className="step-container">
                                        <div className={`step-icon ${isApproved ? 'bg-success text-white' : isFeePaid ? 'bg-warning text-dark' : 'bg-danger text-white'}`}>
                                            {isApproved ? <i className="bi bi-check-lg"></i> : isFeePaid ? <i className="bi bi-hourglass-split"></i> : <i className="bi bi-lock-fill"></i>}
                                        </div>
                                        <div className="step-content">
                                            <h6 className={`fw-bold mb-1 ${isApproved ? 'text-success' : isFeePaid ? 'text-warning' : 'text-danger'}`}>
                                                Admission Approved
                                            </h6>
                                            <small className={`${isApproved ? 'text-muted' : isFeePaid ? 'text-warning' : 'text-danger'} d-block`}>
                                                {isApproved ? 'Admission Secured' : isFeePaid ? 'Finalizing...' : 'Locked'}
                                            </small>
                                        </div>
                                    </div>
                                </div>

                                {isVerified && !isFeePaid && (
                                    <div className="mt-4 p-3 bg-light border rounded text-center">
                                        <p className="small mb-3 text-dark fw-bold">Please pay the admission fee to secure your seat.</p>
                                        <button className="btn btn-success w-100 fw-bold shadow-sm" onClick={handlePayment}>
                                            <i className="bi bi-credit-card me-2"></i> Pay Admission Fee
                                        </button>
                                    </div>
                                )}

                                {isApproved && (
                                    <div className="mt-4 alert alert-success d-flex align-items-center border-0 shadow-sm">
                                        <div className="fs-1 me-3"><i className="bi bi-check-circle-fill"></i></div>
                                        <div>
                                            <strong>Admission Secured!</strong>
                                            <div className="small">Welcome to Vijayam College.</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Details Card */}
                    <div className="col-lg-8">
                        <div className="card border-0 shadow-sm h-100">
                            <div className="card-header bg-white border-bottom py-3">
                                <div className="d-flex justify-content-between align-items-center">
                                    <h5 className="mb-0 fw-bold">Applicant Details</h5>
                                    <span className="badge bg-light text-dark border">{application.application_no}</span>
                                </div>
                            </div>
                            <div className="card-body p-4">
                                {/* Profile Header - Centered and Clean */}
                                <div className="text-center mb-5">
                                    {application.photo_url ? (
                                        <img src={application.photo_url} alt="Profile" className="rounded-circle border p-1 shadow-sm mb-3 object-fit-cover" style={{ width: '120px', height: '120px' }} />
                                    ) : (
                                        <div className="rounded-circle border p-1 bg-light d-inline-flex align-items-center justify-content-center text-muted shadow-sm mb-3" style={{ width: '120px', height: '120px' }}>
                                            <i className="bi bi-person fs-1"></i>
                                        </div>
                                    )}
                                    <h3 className="fw-bold mb-1 text-primary">{application.full_name}</h3>
                                    <div className="text-muted fw-bold mb-2">Application Number : {application.application_no}</div>
                                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-2 rounded-pill">
                                        {courseName} {groupName && `• ${groupName}`}
                                    </span>
                                </div>

                                {/* Personal Details Section - List View */}
                                <h6 className="text-uppercase text-muted fw-bold mb-3 border-bottom pb-2">Personal Details</h6>
                                <div className="row g-0 mb-4">
                                    <div className="col-12 d-flex py-2 border-bottom">
                                        <span className="text-muted fw-semibold" style={{ width: '160px', flexShrink: 0 }}>Date of Birth</span>
                                        <span className="fw-bold text-dark">: {new Date(application.date_of_birth).toLocaleDateString()}</span>
                                    </div>
                                    <div className="col-12 d-flex py-2 border-bottom">
                                        <span className="text-muted fw-semibold" style={{ width: '160px', flexShrink: 0 }}>Gender</span>
                                        <span className="fw-bold text-dark">: {application.gender}</span>
                                    </div>
                                    <div className="col-12 d-flex py-2 border-bottom">
                                        <span className="text-muted fw-semibold" style={{ width: '160px', flexShrink: 0 }}>Nationality</span>
                                        <span className="fw-bold text-dark">: {application.nationality}</span>
                                    </div>
                                    <div className="col-12 d-flex py-2 border-bottom">
                                        <span className="text-muted fw-semibold" style={{ width: '160px', flexShrink: 0 }}>Religion</span>
                                        <span className="fw-bold text-dark">: {application.religion}</span>
                                    </div>
                                    <div className="col-12 d-flex py-2 border-bottom">
                                        <span className="text-muted fw-semibold" style={{ width: '160px', flexShrink: 0 }}>Caste</span>
                                        <span className="fw-bold text-dark">: {application.caste}</span>
                                    </div>
                                    <div className="col-12 d-flex py-2 border-bottom">
                                        <span className="text-muted fw-semibold" style={{ width: '160px', flexShrink: 0 }}>Aadhar Number</span>
                                        <span className="fw-bold text-dark font-monospace">: {application.aadhar_number}</span>
                                    </div>
                                    <div className="col-12 d-flex py-2 border-bottom">
                                        <span className="text-muted fw-semibold" style={{ width: '160px', flexShrink: 0 }}>Father's Name</span>
                                        <span className="fw-bold text-dark">: {application.father_name}</span>
                                    </div>
                                    <div className="col-12 d-flex py-2 border-bottom">
                                        <span className="text-muted fw-semibold" style={{ width: '160px', flexShrink: 0 }}>Mother's Name</span>
                                        <span className="fw-bold text-dark">: {application.mother_name}</span>
                                    </div>
                                </div>

                                {/* Contact Information Section - List View */}
                                <h6 className="text-uppercase text-muted fw-bold mb-3 border-bottom pb-2">Contact Information</h6>
                                <div className="row g-0">
                                    <div className="col-12 d-flex py-2 border-bottom">
                                        <span className="text-muted fw-semibold" style={{ width: '160px', flexShrink: 0 }}>Applicant Mobile</span>
                                        <span className="fw-bold text-dark font-monospace">: {application.phone_number}</span>
                                    </div>
                                    <div className="col-12 d-flex py-2 border-bottom">
                                        <span className="text-muted fw-semibold" style={{ width: '160px', flexShrink: 0 }}>Parent Mobile</span>
                                        <span className="fw-bold text-dark font-monospace">: {application.parent_no || 'N/A'}</span>
                                    </div>
                                    <div className="col-12 d-flex py-2 border-bottom align-items-start">
                                        <span className="text-muted fw-semibold" style={{ width: '160px', flexShrink: 0 }}>Permanent Address</span>
                                        <span className="fw-bold text-dark text-break">
                                            : {application.address}, {application.state} - <span className="font-monospace">{application.pincode}</span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
