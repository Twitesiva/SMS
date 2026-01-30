import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../../lib/mockApi'
import { validateRequiredFields } from '../../lib/validation'
import { showToast } from '../../store/ui'
import crestPrimary from '../../assets/media/images.png'
import { supabase } from '../../../supabaseClient'
import './PublicApply.css'

export default function PublicApply() {
  const location = useLocation()
  // dropdown option masters (can be moved to Setup later)
  const GENDERS = ['Male', 'Female', 'Other']
  const CASTES = ['General', 'OBC', 'SC', 'ST', 'Others']
  const RELIGIONS = ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain', 'Others']
  const STATES = ['Tamil Nadu', 'Andhra Pradesh', 'Karnataka', 'Kerala', 'Telangana', 'Maharashtra', 'Other']

  const buildApplicationNo = () => `APP${new Date().getFullYear()}${String(Date.now()).slice(-6)}`

  const [form, setForm] = useState({
    application_no: buildApplicationNo(),
    admission_year: new Date().getFullYear(),
    group_id: '',
    course_id: '',
    full_name: '',
    gender: '',
    date_of_birth: '',
    father_name: '',
    mother_name: '',
    nationality: 'Indian',
    state: '',
    religion: '',
    caste: '',
    aadhar_number: '',
    address: '',
    pincode: '',
    phone_number: '',
    parent_no: '',
    tenth_register_no: '',
    tenth_percentage: '',
    twelth_register_no: '',
    twelth_percentage: '',
    is_hostel: null,
    is_transport: null,
    hostel_ac: null
  })
  const [photo, setPhoto] = useState(null)
  const [cert, setCert] = useState(null)
  const [tenthMarksheet, setTenthMarksheet] = useState(null)
  const [twelthMarksheet, setTwelthMarksheet] = useState(null)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [loading, setLoading] = useState(false)
  const [courses, setCourses] = useState([])
  const [groups, setGroups] = useState([])
  const isCourseLocked = Boolean(location.state?.selectedCourse)
  const handle = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const selectClass = (val) => (val ? 'form-select public-apply-select is-filled' : 'form-select public-apply-select')

  useEffect(() => {
    (async () => {
      try {
        const [cs, gs] = await Promise.all([
          api.listCourses(),
          api.listGroups?.() || []
        ])
        setCourses(cs || []); setGroups(gs || [])

        // Auto-select course/group if passed from previous page
        if (location.state?.selectedCourse) {
          const pre = location.state.selectedCourse
          // Find the robust course object from the fresh list
          const matchedCourse = (cs || []).find(c => c.id === pre.id)
          if (matchedCourse) {
            let gid = matchedCourse.group_id || ''
            // If no direct group_id on course, try to find group by name/code
            if (!gid) {
              const gName = matchedCourse.group_name || pre.group_name
              const gCode = matchedCourse.group_code || pre.group_code
              const foundGroup = (gs || []).find(g =>
                (g.name && g.name === gName) ||
                (g.code && g.code === gCode) ||
                (g.group_name && g.group_name === gName)
              )
              if (foundGroup) gid = foundGroup.id
            }

            setForm(prev => ({
              ...prev,
              course_id: matchedCourse.id,
              group_id: gid || prev.group_id // set group if found, else keep empty (or existing)
            }))
          }
        }
      } catch { setCourses([]); setGroups([]) }
    })()
  }, [])

  const resetAll = () => {
    setForm({
      application_no: buildApplicationNo(),
      admission_year: new Date().getFullYear(),
      group_id: '',
      course_id: '',
      full_name: '',
      gender: '',
      date_of_birth: '',
      father_name: '',
      mother_name: '',
      nationality: 'Indian',
      state: '',
      religion: '',
      caste: '',
      aadhar_number: '',
      address: '',
      pincode: '',
      phone_number: '',
      parent_no: '',
      tenth_register_no: '',
      tenth_percentage: '',
      twelth_register_no: '',
      twelth_percentage: '',
      is_hostel: null,
      is_transport: null,
      hostel_ac: null
    })
    setPhoto(null); setCert(null); setTenthMarksheet(null); setTwelthMarksheet(null)
    setFileInputKey((k) => k + 1)
  }

  const isDigits = (val, len) => new RegExp(`^\\d{${len}}$`).test(val)
  const onNumericChange = (key, max) => (e) => {
    const v = (e.target.value || '').replace(/\D/g, '').slice(0, max)
    handle(key, v)
  }

  const onDecimalChange = (key, max) => (e) => {
    const raw = e.target.value || ''
    const cleaned = raw.replace(/[^0-9.]/g, '')
    const [intPart, decPart] = cleaned.split('.')
    const value = decPart === undefined ? intPart : `${intPart}.${decPart.slice(0, 2)}`
    const numeric = value === '' ? '' : Math.min(Number(value), max).toString()
    handle(key, numeric)
  }

  /* upload helper: tries to upload to 'documents' bucket, falls back to base64 if needed */
  const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    if (!file) { resolve(null); return }
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Unable to read file'))
    reader.readAsDataURL(file)
  })

  const uploadFile = async (file, folder) => {
    if (!file) return null
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
      const { data, error } = await supabase.storage
        .from('documents')
        .upload(fileName, file)

      if (error) throw error

      const { data: publicData } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName)

      return publicData.publicUrl
    } catch (err) {
      console.warn('Upload failed, falling back to Base64:', err)
      return await fileToDataUrl(file)
    }
  }

  const [showConfirm, setShowConfirm] = useState(false)

  const handlePreSubmit = async (e) => {
    e.preventDefault(); setLoading(true)
    const requiredFields = {
      'Application No': form.application_no,
      'Admission Year': form.admission_year,
      'Group': form.group_id,
      'Course': form.course_id,
      'Full Name': form.full_name,
      'Gender': form.gender,
      'Date of Birth': form.date_of_birth,
      'Mobile Number': form.phone_number,
      'Parent Mobile': form.parent_no,
      'Postal Code': form.pincode,
      'Address': form.address,
    }
    if (!validateRequiredFields(requiredFields, { title: 'Incomplete application' })) { setLoading(false); return }
    if (!isDigits(form.phone_number, 10)) {
      showToast('Enter a valid 10-digit mobile number.', { type: 'warning', title: 'Invalid mobile' })
      setLoading(false)
      return
    }
    if (!isDigits(form.parent_no, 10)) {
      showToast('Enter a valid 10-digit parent mobile number.', { type: 'warning', title: 'Invalid mobile' })
      setLoading(false)
      return
    }
    if (!isDigits(form.pincode, 6)) {
      showToast('Postal code must be 6 digits.', { type: 'warning', title: 'Invalid postal code' })
      setLoading(false)
      return
    }
    if (form.aadhar_number && !isDigits(form.aadhar_number, 12)) {
      showToast('Aadhar number must contain 12 digits.', { type: 'warning', title: 'Invalid Aadhar' })
      setLoading(false)
      return
    }
    if (form.tenth_percentage && Number(form.tenth_percentage) > 100) {
      showToast('10th percentage must be 100 or below.', { type: 'warning', title: 'Invalid percentage' })
      setLoading(false)
      return
    }
    if (form.twelth_percentage && Number(form.twelth_percentage) > 100) {
      showToast('12th percentage must be 100 or below.', { type: 'warning', title: 'Invalid percentage' })
      setLoading(false)
      return
    }
    if (form.is_hostel === true && form.hostel_ac === null) {
      showToast('Please select Hostel AC/Non-AC option.', { type: 'warning', title: 'Accommodation required' })
      setLoading(false)
      return
    }

    // Validation passed, show confirmation popup
    setShowConfirm(true)
    setLoading(false)
  }

  const confirmSubmit = async () => {
    setLoading(true)
    setShowConfirm(false)

    try {
      // 1. Upload files
      const photoUrl = photo ? await uploadFile(photo, 'photos') : null
      const certUrl = cert ? await uploadFile(cert, 'certificates') : null
      const tenthUrl = tenthMarksheet ? await uploadFile(tenthMarksheet, 'marksheets') : null
      const twelthUrl = twelthMarksheet ? await uploadFile(twelthMarksheet, 'marksheets') : null

      // 2. Insert into 'applications'
      const { data: appData, error: appError } = await supabase
        .from('applications')
        .insert([
          {
            application_no: form.application_no,
            admission_year: Number(form.admission_year),
            group_id: form.group_id ? Number(form.group_id) : null,
            course_id: form.course_id ? Number(form.course_id) : null,
            full_name: form.full_name,
            gender: form.gender,
            date_of_birth: form.date_of_birth || null,
            father_name: form.father_name,
            mother_name: form.mother_name,
            nationality: form.nationality,
            state: form.state,
            religion: form.religion,
            caste: form.caste,
            aadhar_number: form.aadhar_number,
            address: form.address,
            pincode: form.pincode,
            phone_number: form.phone_number,
            parent_no: form.parent_no,
            tenth_register_no: form.tenth_register_no,
            tenth_percentage: form.tenth_percentage ? Number(form.tenth_percentage) : null,
            twelth_register_no: form.twelth_register_no,
            twelth_percentage: form.twelth_percentage ? Number(form.twelth_percentage) : null,
            photo_url: photoUrl,
            cert_url: certUrl,
            status: 'SUBMITTED',
            application_status: 'SUBMITTED',
            is_hostel: form.is_hostel,
            is_transport: form.is_transport || false,
            hostel_ac: form.is_hostel ? form.hostel_ac : null
          }
        ])
        .select()
        .single()

      if (appError) throw appError
      if (!appData) throw new Error('Failed to create application record.')

      const applicationId = appData.id

      // 3. Insert into 'application_documents'
      const docsToInsert = []
      if (tenthUrl) {
        docsToInsert.push({
          application_id: applicationId,
          document_type: '10th Marksheet',
          document_url: tenthUrl
        })
      }
      if (twelthUrl) {
        docsToInsert.push({
          application_id: applicationId,
          document_type: '12th Marksheet',
          document_url: twelthUrl
        })
      }
      if (photoUrl) {
        docsToInsert.push({
          application_id: applicationId,
          document_type: 'Photo',
          document_url: photoUrl
        })
      }
      if (certUrl) {
        docsToInsert.push({
          application_id: applicationId,
          document_type: 'Transfer Certificate',
          document_url: certUrl
        })
      }

      if (docsToInsert.length > 0) {
        const { error: docError } = await supabase
          .from('application_documents')
          .insert(docsToInsert)
        if (docError) console.error('Error saving documents:', docError)
      }

      // 4. Insert into 'admissions'
      const { error: admError } = await supabase
        .from('admissions')
        .insert([
          {
            application_id: applicationId,
            admission_status: 'PENDING'
          }
        ])

      if (admError) throw admError

      showToast('Application submitted! Admin/Principal will contact you after approval.', { type: 'success', title: 'Submitted' })
      resetAll()
    } catch (err) {
      console.error(err)
      showToast(err.message || 'Error submitting form', { type: 'danger', title: 'Submission failed' })
    }
    finally { setLoading(false) }
  }

  return (
    <div className="public-apply-page">
      <div className="public-apply-layout">
        <div className="public-apply-hero">
          <div className="public-apply-hero__content">
            <div className="public-apply-hero__crest" aria-hidden="true">
              <img src={crestPrimary} alt="Vijayam crest" />
            </div>
            <div>
              <div className="public-apply-hero__eyebrow">ADMISSIONS {form.admission_year}</div>
              <h1 className="public-apply-hero__title">Vijayam College of Arts & Science</h1>
              <p className="public-apply-hero__location">CHITTOR</p>
              <p className="public-apply-hero__subtitle">
                Manage catalogues, lending, and returns with confidence. Explore programmes, registration steps,
                and real-time updates from the library control center while preparing your application.
              </p>
            </div>
          </div>
          <div className="public-apply-hero__actions">
            <Link to="/home" className="public-apply-hero__back">
              <i className="bi bi-arrow-left me-2"></i>
              Back to Home
            </Link>
          </div>
        </div>

        <div className="public-apply__steps mb-5" style={{ width: 'min(1500px, 100%)' }}>
          <div className="public-apply__steps-text">
            <p className="public-apply__steps-eyebrow">YOUR ONLINE APPLICATION</p>
            <h2 className="public-apply__steps-heading">
              Follow these steps to complete your admission
            </h2>
            <ul className="public-apply__steps-list">
              <li>Register by filling the above details.</li>
              <li>Fill the application form online.</li>
              <li>Upload required documents.</li>
              <li>Submit your application.</li>
            </ul>
            <div className="public-apply__note">
              <div className="public-apply__note-title">NOTE</div>
              <ul className="public-apply__note-list">
                <li>Upload clear photo in jpg or png format. Suggested size 135px x 175px (max 200KB).</li>
                <li>Upload transfer certificate and marksheets in jpg or png format (max 200KB each).</li>
              </ul>
            </div>
          </div>

          <div className="public-apply__steps-card">
            <div className="public-apply__steps-card-title">STEPS TO FOLLOW</div>
            <ol className="public-apply__steps-flow">
              <li className="public-apply__step public-apply__step--green">
                <span className="public-apply__step-badge">01</span>
                <span className="public-apply__step-icon">
                  <i className="bi bi-person-plus"></i>
                </span>
                <span className="public-apply__step-text">Register Yourself</span>
              </li>
              <li className="public-apply__step public-apply__step--coral">
                <span className="public-apply__step-badge">02</span>
                <span className="public-apply__step-icon">
                  <i className="bi bi-pencil-square"></i>
                </span>
                <span className="public-apply__step-text">Fill Application Form Online</span>
              </li>
              <li className="public-apply__step public-apply__step--blue">
                <span className="public-apply__step-badge">03</span>
                <span className="public-apply__step-icon">
                  <i className="bi bi-upload"></i>
                </span>
                <span className="public-apply__step-text">Upload Required Documents</span>
              </li>
              <li className="public-apply__step public-apply__step--teal">
                <span className="public-apply__step-badge">04</span>
                <span className="public-apply__step-icon">
                  <i className="bi bi-check2-circle"></i>
                </span>
                <span className="public-apply__step-text">Submit Application</span>
              </li>
            </ol>
          </div>
        </div>

        <div className="public-apply-content">
          <div className="public-apply-form-card" style={{ flex: '1 1 100%' }}>
            <div className="card card-soft public-apply-form">
              <div className="public-apply-form-header">
                <div>
                  <h5 className="mb-1">Apply for Admission</h5>
                  <p className="public-apply-form-copy">Fill in the details below to complete your application.</p>
                </div>
                <span className="public-apply-form-badge">Application Form</span>
              </div>
              <form onSubmit={handlePreSubmit} className="public-apply-form-body" noValidate>
                <div className="public-apply-section public-apply-reveal" style={{ '--delay': '0.05s' }}>
                  <div className="public-apply-section-header">
                    <div className="public-apply-section-index">01</div>
                    <div>
                      <h6 className="public-apply-section-title">Application Details</h6>
                      <p className="public-apply-section-copy">Choose your admission year, group, and course.</p>
                    </div>
                  </div>
                  <div className="row g-3">
                    <div className="col-md-4"><label className="form-label">Application No</label><input className="form-control" value={form.application_no} readOnly /></div>
                    <div className="col-md-4">
                      <label className="form-label"><i className="bi bi-calendar3"></i>Admission Year</label>
                      <select className={selectClass(form.admission_year)} value={form.admission_year} onChange={e => handle('admission_year', e.target.value)} required>
                        {Array.from({ length: 5 }, (_, i) => {
                          const year = new Date().getFullYear() - 2 + i
                          return <option key={year} value={year}>{year}</option>
                        })}
                      </select>
                    </div>

                    <div className="col-md-3">
                      <label className="form-label"><i className="bi bi-diagram-3"></i>Group</label>
                      <select className={selectClass(form.group_id)} value={form.group_id} onChange={e => handle('group_id', e.target.value)} required disabled={isCourseLocked}>
                        <option value="">Select Group</option>
                        {groups.map(g => (
                          <option key={g.id} value={g.id}>{g.name || g.group_name || g.code}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label"><i className="bi bi-journal-bookmark"></i>Course</label>
                      <select className={selectClass(form.course_id)} value={form.course_id} onChange={e => handle('course_id', e.target.value)} required disabled={isCourseLocked}>
                        <option value="">Select Course</option>
                        {courses
                          .filter((course) => {
                            if (!form.group_id) return true
                            const selectedGroup = groups.find(g => String(g.id) === String(form.group_id))
                            const groupName = selectedGroup?.name || selectedGroup?.group_name
                            const groupCode = selectedGroup?.code || selectedGroup?.group_code
                            return (
                              (groupName && course.group_name === groupName) ||
                              (groupCode && course.group_code === groupCode)
                            )
                          })
                          .map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="public-apply-section public-apply-reveal" style={{ '--delay': '0.1s' }}>
                  <div className="public-apply-section-header">
                    <div className="public-apply-section-index">02</div>
                    <div>
                      <h6 className="public-apply-section-title">Personal Details</h6>
                      <p className="public-apply-section-copy">Tell us about the applicant.</p>
                    </div>
                  </div>
                  <div className="row g-3">
                    <div className="col-md-6"><label className="form-label">Full Name</label><input className="form-control" value={form.full_name} onChange={e => handle('full_name', e.target.value)} required /></div>
                    <div className="col-md-3"><label className="form-label"><i className="bi bi-gender-ambiguous"></i>Gender</label><select className={selectClass(form.gender)} value={form.gender} onChange={e => handle('gender', e.target.value)} required><option value="">Select</option>{GENDERS.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
                    <div className="col-md-3"><label className="form-label">Date of Birth</label><input type="date" className="form-control" value={form.date_of_birth} onChange={e => handle('date_of_birth', e.target.value)} required /></div>
                    <div className="col-md-6"><label className="form-label">Father's Name</label><input className="form-control" value={form.father_name} onChange={e => handle('father_name', e.target.value)} /></div>
                    <div className="col-md-6"><label className="form-label">Mother's Name</label><input className="form-control" value={form.mother_name} onChange={e => handle('mother_name', e.target.value)} /></div>
                  </div>
                </div>

                <div className="public-apply-section public-apply-reveal" style={{ '--delay': '0.15s' }}>
                  <div className="public-apply-section-header">
                    <div className="public-apply-section-index">03</div>
                    <div>
                      <h6 className="public-apply-section-title">Contact & Address</h6>
                      <p className="public-apply-section-copy">Share how we can reach you.</p>
                    </div>
                  </div>
                  <div className="row g-3">
                    <div className="col-md-3"><label className="form-label">Mobile</label><input className="form-control" inputMode="tel" maxLength="10" pattern="\\d{10}" value={form.phone_number} onChange={onNumericChange('phone_number', 10)} required /></div>
                    <div className="col-md-3"><label className="form-label">Parent Mobile</label><input className="form-control" inputMode="tel" maxLength="10" pattern="\\d{10}" value={form.parent_no} onChange={onNumericChange('parent_no', 10)} required /></div>
                    <div className="col-md-3"><label className="form-label">Nationality</label><input className="form-control" value={form.nationality} onChange={e => handle('nationality', e.target.value)} /></div>
                    <div className="col-md-3"><label className="form-label"><i className="bi bi-geo-alt"></i>State</label><select className={selectClass(form.state)} value={form.state} onChange={e => handle('state', e.target.value)}><option value="">Select</option>{STATES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                    <div className="col-md-4"><label className="form-label">Aadhar No</label><input className="form-control" inputMode="numeric" maxLength="12" pattern="\\d{12}" placeholder="12 digits" value={form.aadhar_number} onChange={onNumericChange('aadhar_number', 12)} /></div>
                    <div className="col-md-4"><label className="form-label">Postal Code (PIN)</label><input className="form-control" inputMode="numeric" maxLength="6" pattern="\\d{6}" placeholder="6 digits" value={form.pincode} onChange={onNumericChange('pincode', 6)} required /></div>
                    <div className="col-md-4"><label className="form-label"><i className="bi bi-book"></i>Religion</label><select className={selectClass(form.religion)} value={form.religion} onChange={e => handle('religion', e.target.value)}><option value="">Select</option>{RELIGIONS.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                    <div className="col-md-4"><label className="form-label"><i className="bi bi-people"></i>Caste</label><select className={selectClass(form.caste)} value={form.caste} onChange={e => handle('caste', e.target.value)}><option value="">Select</option>{CASTES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                    <div className="col-12"><label className="form-label">Address</label><textarea className="form-control" rows="2" value={form.address} onChange={e => handle('address', e.target.value)} required></textarea></div>

                    <div className="col-12 mt-4">
                      <div className="d-inline-block bg-primary text-white border border-primary px-3 py-1 rounded-pill small fw-bold mb-4 shadow-sm">
                        <i className="bi bi-house-door-fill me-2"></i>ACCOMMODATION DETAILS
                      </div>
                      <div className="row g-4">
                        <div className="col-md-6">
                          <label className="form-label mb-2 fw-bold text-dark">Student Type <span className="text-danger">*</span></label>
                          <div className="accommodation-toggle-group">
                            <label className={`accommodation-checkbox ${form.is_hostel === true ? 'active' : ''}`}>
                              <input
                                type="radio"
                                name="studentType"
                                checked={form.is_hostel === true}
                                onChange={() => {
                                  handle('is_hostel', true)
                                  handle('is_transport', false)
                                }}
                              />
                              <i className="bi bi-building"></i>
                              <span>Hostel Accommodation</span>
                            </label>
                            <label className={`accommodation-checkbox ${form.is_hostel === false ? 'active' : ''}`}>
                              <input
                                type="radio"
                                name="studentType"
                                checked={form.is_hostel === false}
                                onChange={() => {
                                  handle('is_hostel', false)
                                  handle('is_transport', null)
                                  handle('hostel_ac', null)
                                }}
                              />
                              <i className="bi bi-house"></i>
                              <span>Day Scholar</span>
                            </label>
                          </div>
                        </div>

                        <div className="col-md-6">
                          <label className="form-label mb-2 fw-bold text-dark">College Transport (if Day Scholar)</label>
                          <div className="accommodation-toggle-group">
                            <label className={`accommodation-checkbox ${form.is_hostel !== false ? 'disabled' : ''} ${form.is_hostel === false && form.is_transport === true ? 'active' : ''}`}>
                              <input
                                type="radio"
                                name="transport"
                                disabled={form.is_hostel !== false}
                                checked={form.is_hostel === false && form.is_transport === true}
                                onChange={() => handle('is_transport', true)}
                              />
                              <i className="bi bi-bus-front"></i>
                              <span>Yes, Required</span>
                            </label>
                            <label className={`accommodation-checkbox ${form.is_hostel !== false ? 'disabled' : ''} ${form.is_hostel === false && form.is_transport === false ? 'active' : ''}`}>
                              <input
                                type="radio"
                                name="transport"
                                disabled={form.is_hostel !== false}
                                checked={form.is_hostel === false && form.is_transport === false}
                                onChange={() => handle('is_transport', false)}
                              />
                              <i className="bi bi-x-circle"></i>
                              <span>Not Required</span>
                            </label>
                          </div>
                        </div>

                        {form.is_hostel === true && (
                          <div className="col-md-6">
                            <label className="form-label mb-2 fw-bold text-dark">Hostel Accommodation Type</label>
                            <div className="accommodation-toggle-group">
                              <label className={`accommodation-checkbox ${form.hostel_ac === true ? 'active' : ''}`}>
                                <input
                                  type="radio"
                                  name="hostel_ac"
                                  checked={form.hostel_ac === true}
                                  onChange={() => handle('hostel_ac', true)}
                                />
                                <i className="bi bi-snow"></i>
                                <span>AC</span>
                              </label>
                              <label className={`accommodation-checkbox ${form.hostel_ac === false ? 'active' : ''}`}>
                                <input
                                  type="radio"
                                  name="hostel_ac"
                                  checked={form.hostel_ac === false}
                                  onChange={() => handle('hostel_ac', false)}
                                />
                                <i className="bi bi-wind"></i>
                                <span>Non AC</span>
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                </div>

                <div className="public-apply-section public-apply-reveal" style={{ '--delay': '0.2s' }}>
                  <div className="public-apply-section-header">
                    <div className="public-apply-section-index">04</div>
                    <div>
                      <h6 className="public-apply-section-title">Academic Records</h6>
                      <p className="public-apply-section-copy">Enter the latest exam details.</p>
                    </div>
                  </div>
                  <div className="row g-3">
                    <div className="col-md-4"><label className="form-label">10th Register No</label><input className="form-control" value={form.tenth_register_no} onChange={e => handle('tenth_register_no', e.target.value)} /></div>
                    <div className="col-md-2"><label className="form-label">10th Percentage</label><input className="form-control" inputMode="decimal" value={form.tenth_percentage} onChange={onDecimalChange('tenth_percentage', 100)} /></div>
                    <div className="col-md-4"><label className="form-label">12th Register No</label><input className="form-control" value={form.twelth_register_no} onChange={e => handle('twelth_register_no', e.target.value)} /></div>
                    <div className="col-md-2"><label className="form-label">12th Percentage</label><input className="form-control" inputMode="decimal" value={form.twelth_percentage} onChange={onDecimalChange('twelth_percentage', 100)} /></div>
                  </div>
                  <div className="row g-3 mt-1">
                    <div className="col-md-6">
                      <label className="form-label">Upload 10TH Marksheet</label>
                      <div className="public-apply-upload">
                        <input key={`tenth-${fileInputKey}`} type="file" accept="image/*" className="form-control" onChange={e => setTenthMarksheet(e.target.files?.[0] || null)} />
                        <small className="public-apply-upload-hint text-muted">Image only</small>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Upload 12TH Marksheet</label>
                      <div className="public-apply-upload">
                        <input key={`twelth-${fileInputKey}`} type="file" accept="image/*" className="form-control" onChange={e => setTwelthMarksheet(e.target.files?.[0] || null)} />
                        <small className="public-apply-upload-hint text-muted">Image only</small>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="public-apply-section public-apply-reveal" style={{ '--delay': '0.25s' }}>
                  <div className="public-apply-section-header">
                    <div className="public-apply-section-index">05</div>
                    <div>
                      <h6 className="public-apply-section-title">Uploads</h6>
                      <p className="public-apply-section-copy">Attach the required documents.</p>
                    </div>
                  </div>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Upload Photo</label>
                      <div className="public-apply-upload">
                        <input key={`photo-${fileInputKey}`} type="file" accept="image/*" className="form-control" onChange={e => setPhoto(e.target.files?.[0] || null)} />
                        <small className="public-apply-upload-hint text-muted">Image only</small>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label"><span className="fw-bold">Upload Transfer Certificate</span></label>
                      <div className="public-apply-upload">
                        <input key={`cert-${fileInputKey}`} type="file" accept="image/*" className="form-control" onChange={e => setCert(e.target.files?.[0] || null)} />
                        <small className="public-apply-upload-hint text-muted">Image only</small>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="public-apply-actions">
                  <button type="button" className="btn btn-outline-secondary px-5 rounded-pill" onClick={resetAll}>Clear</button>
                  <button className="btn btn-brand px-5 rounded-pill shadow-sm" disabled={loading} onClick={handlePreSubmit}>{loading ? 'Submitting...' : 'Submit Application'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {showConfirm && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 shadow-lg border-0">
              <div className="modal-body p-5 text-center">
                <div className="mb-4">
                  <div className="bg-primary bg-opacity-10 text-primary rounded-circle d-inline-flex align-items-center justify-content-center" style={{ width: '80px', height: '80px' }}>
                    <i className="bi bi-send-check-fill fs-1"></i>
                  </div>
                </div>
                <h3 className="fw-bold mb-3">Confirm Submission</h3>
                <p className="text-secondary mb-4">
                  Are you sure you want to submit your application? Please review your details carefully before confirming.
                </p>
                <div className="d-flex justify-content-center gap-3">
                  <button className="btn btn-outline-secondary rounded-pill px-4 py-2" onClick={() => setShowConfirm(false)}>Cancel</button>
                  <button className="btn btn-primary rounded-pill px-4 py-2" onClick={confirmSubmit}>Confirm & Apply</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
