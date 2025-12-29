import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/mockApi'
import { validateRequiredFields } from '../../lib/validation'
import { showToast } from '../../store/ui'
import crestPrimary from '../../assets/media/images.png'

export default function PublicApply() {
  // dropdown option masters (can be moved to Setup later)
  const GENDERS = ['Male','Female','Other']
  const CASTES = ['General','OBC','SC','ST','Others']
  const RELIGIONS = ['Hindu','Muslim','Christian','Sikh','Buddhist','Jain','Others']
  const STATES = ['Tamil Nadu','Andhra Pradesh','Karnataka','Kerala','Telangana','Maharashtra','Other']

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
    nationality: '',
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
    twelth_percentage: ''
  })
  const [photo, setPhoto] = useState(null)
  const [cert, setCert] = useState(null)
  const [tenthMarksheet, setTenthMarksheet] = useState(null)
  const [twelthMarksheet, setTwelthMarksheet] = useState(null)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [loading, setLoading] = useState(false)
  const [courses, setCourses] = useState([])
  const [groups, setGroups] = useState([])
  const handle = (k,v)=> setForm(p=>({...p,[k]:v}))
  const selectClass = (val) => (val ? 'form-select public-apply-select is-filled' : 'form-select public-apply-select')

  useEffect(()=>{ (async()=>{
    try {
      const [cs, gs] = await Promise.all([
        api.listCourses(),
        api.listGroups?.() || []
      ])
      setCourses(cs||[]); setGroups(gs||[])
    } catch { setCourses([]); setGroups([]) }
  })() }, [])

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
      nationality: '',
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
      twelth_percentage: ''
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

  const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    if (!file) { resolve(null); return }
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Unable to read file'))
    reader.readAsDataURL(file)
  })

  const submit = async (e) => {
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

    try {
      const uploads = {}
      const photoUrl = photo ? await fileToDataUrl(photo) : null
      const certUrl = cert ? await fileToDataUrl(cert) : null
      const tenthMarksheetUrl = tenthMarksheet ? await fileToDataUrl(tenthMarksheet) : null
      const twelthMarksheetUrl = twelthMarksheet ? await fileToDataUrl(twelthMarksheet) : null
      if (photoUrl) uploads.photo_url = photoUrl
      if (certUrl) uploads.cert_url = certUrl
      if (tenthMarksheetUrl) uploads.tenth_marksheet_url = tenthMarksheetUrl
      if (twelthMarksheetUrl) uploads.twelth_marksheet_url = twelthMarksheetUrl
      await api.submitApplication({
        ...form,
        admission_year: Number(form.admission_year),
        group_id: form.group_id ? Number(form.group_id) : null,
        course_id: form.course_id ? Number(form.course_id) : null,
        tenth_percentage: form.tenth_percentage === '' ? null : Number(form.tenth_percentage),
        twelth_percentage: form.twelth_percentage === '' ? null : Number(form.twelth_percentage),
        ...uploads
      })
      showToast('Application submitted! Admin/Principal will contact you after approval.', { type: 'success', title: 'Submitted' })
      resetAll()
    } catch (err) {
      showToast(err.message || 'Error submitting form', { type: 'danger', title: 'Submission failed' })
    }
    finally { setLoading(false) }
  }

  return (
    <div className="public-apply-page">
      <div className="container py-5">
        <div className="d-flex justify-content-end mb-3">
          <Link to="/admission" className="btn btn-outline-secondary">
            <i className="bi bi-arrow-left me-2"></i>Back
          </Link>
        </div>
        <div className="public-apply-hero mb-4">
          <div className="public-apply-hero-brand">
            <img src={crestPrimary} className="brand-logo public-apply-logo" alt="Vijayam crest" />
            <div>
              <div className="public-apply-eyebrow">Admissions {form.admission_year}</div>
              <h2 className="public-apply-title">Vijayam College of Arts & Science</h2>
              <div className="public-apply-subtitle">Chittor</div>
            </div>
          </div>
        </div>

        <div className="public-apply-intro mb-4">
          <div className="public-apply-intro-grid">
            <div>
              <div className="public-apply-intro-eyebrow">YOUR ONLINE APPLICATION</div>
              <h4 className="public-apply-intro-title">Follow these steps to complete your admission</h4>
              <ul className="public-apply-intro-list">
                <li>Register by filling the above details</li>
                <li>Fill the application form online.</li>
                <li>Upload required documents.</li>
                <li>Submit your application.</li>
              </ul>
              <div className="public-apply-note">
                <div className="public-apply-note-title">NOTE</div>
                <ul className="public-apply-note-list">
                  <li>Upload clear photo in jpg or png format. Suggested size 135px x 175px (max 200KB).</li>
                  <li>Upload transfer certificate and marksheets in jpg or png format (max 200KB each).</li>
                </ul>
              </div>
            </div>
            <div className="public-apply-steps">
              <div className="public-apply-steps-title">STEPS TO FOLLOW</div>
              <div className="public-apply-steps-grid">
                <div className="public-apply-step"><span className="public-apply-step-num">01</span><span className="public-apply-step-text">Register Yourself</span></div>
                <div className="public-apply-step"><span className="public-apply-step-num">02</span><span className="public-apply-step-text">Fill Application Form Online</span></div>
                <div className="public-apply-step"><span className="public-apply-step-num">03</span><span className="public-apply-step-text">Upload Required Documents</span></div>
                <div className="public-apply-step"><span className="public-apply-step-num">04</span><span className="public-apply-step-text">Submit Application</span></div>
              </div>
            </div>
          </div>
        </div>

        <div className="row g-4 justify-content-center">
          <div className="col-lg-10">
            <div className="card card-soft public-apply-form">
              <div className="public-apply-form-header">
                <div>
                  <h5 className="mb-1">Apply for Admission</h5>
                  <p className="public-apply-form-copy">Fill in the details below to complete your application.</p>
                </div>
                <span className="public-apply-form-badge">Application Form</span>
              </div>
              <form onSubmit={submit} className="public-apply-form-body" noValidate>
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
                      <select className={selectClass(form.admission_year)} value={form.admission_year} onChange={e=>handle('admission_year',e.target.value)} required>
                        {Array.from({ length: 5 }, (_, i) => {
                          const year = new Date().getFullYear() - 2 + i
                          return <option key={year} value={year}>{year}</option>
                        })}
                      </select>
                    </div>

                    <div className="col-md-3">
                      <label className="form-label"><i className="bi bi-diagram-3"></i>Group</label>
                      <select className={selectClass(form.group_id)} value={form.group_id} onChange={e=>handle('group_id',e.target.value)} required>
                        <option value="">Select Group</option>
                        {groups.map(g=> (
                          <option key={g.id} value={g.id}>{g.name || g.group_name || g.code}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label"><i className="bi bi-journal-bookmark"></i>Course</label>
                      <select className={selectClass(form.course_id)} value={form.course_id} onChange={e=>handle('course_id',e.target.value)} required>
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
                          .map(c=> (
                            <option key={c.id} value={c.id}>{c.code ? `${c.code} - ` : ''}{c.name}</option>
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
                    <div className="col-md-6"><label className="form-label">Full Name</label><input className="form-control" value={form.full_name} onChange={e=>handle('full_name',e.target.value)} required /></div>
                    <div className="col-md-3"><label className="form-label"><i className="bi bi-gender-ambiguous"></i>Gender</label><select className={selectClass(form.gender)} value={form.gender} onChange={e=>handle('gender',e.target.value)} required><option value="">Select</option>{GENDERS.map(g=> <option key={g} value={g}>{g}</option>)}</select></div>
                    <div className="col-md-3"><label className="form-label">Date of Birth</label><input type="date" className="form-control" value={form.date_of_birth} onChange={e=>handle('date_of_birth',e.target.value)} required /></div>
                    <div className="col-md-6"><label className="form-label">Father's Name</label><input className="form-control" value={form.father_name} onChange={e=>handle('father_name',e.target.value)} /></div>
                    <div className="col-md-6"><label className="form-label">Mother's Name</label><input className="form-control" value={form.mother_name} onChange={e=>handle('mother_name',e.target.value)} /></div>
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
                    <div className="col-md-3"><label className="form-label">Mobile</label><input className="form-control" inputMode="tel" maxLength="10" pattern="\\d{10}" value={form.phone_number} onChange={onNumericChange('phone_number',10)} required /></div>
                    <div className="col-md-3"><label className="form-label">Parent Mobile</label><input className="form-control" inputMode="tel" maxLength="10" pattern="\\d{10}" value={form.parent_no} onChange={onNumericChange('parent_no',10)} required /></div>
                    <div className="col-md-3"><label className="form-label">Nationality</label><input className="form-control" value={form.nationality} onChange={e=>handle('nationality',e.target.value)} /></div>
                    <div className="col-md-3"><label className="form-label"><i className="bi bi-geo-alt"></i>State</label><select className={selectClass(form.state)} value={form.state} onChange={e=>handle('state',e.target.value)}><option value="">Select</option>{STATES.map(s=> <option key={s} value={s}>{s}</option>)}</select></div>
                    <div className="col-md-4"><label className="form-label">Aadhar No</label><input className="form-control" inputMode="numeric" maxLength="12" pattern="\\d{12}" placeholder="12 digits" value={form.aadhar_number} onChange={onNumericChange('aadhar_number',12)} /></div>
                    <div className="col-md-4"><label className="form-label">Postal Code (PIN)</label><input className="form-control" inputMode="numeric" maxLength="6" pattern="\\d{6}" placeholder="6 digits" value={form.pincode} onChange={onNumericChange('pincode',6)} required /></div>
                    <div className="col-md-4"><label className="form-label"><i className="bi bi-book"></i>Religion</label><select className={selectClass(form.religion)} value={form.religion} onChange={e=>handle('religion',e.target.value)}><option value="">Select</option>{RELIGIONS.map(r=> <option key={r} value={r}>{r}</option>)}</select></div>
                    <div className="col-md-4"><label className="form-label"><i className="bi bi-people"></i>Caste</label><select className={selectClass(form.caste)} value={form.caste} onChange={e=>handle('caste',e.target.value)}><option value="">Select</option>{CASTES.map(c=> <option key={c} value={c}>{c}</option>)}</select></div>
                    <div className="col-12"><label className="form-label">Address</label><textarea className="form-control" rows="2" value={form.address} onChange={e=>handle('address',e.target.value)} required></textarea></div>
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
                    <div className="col-md-4"><label className="form-label">10TH REGISTER NO</label><input className="form-control" value={form.tenth_register_no} onChange={e=>handle('tenth_register_no',e.target.value)} /></div>
                    <div className="col-md-2"><label className="form-label">10TH %</label><input className="form-control" inputMode="decimal" value={form.tenth_percentage} onChange={onDecimalChange('tenth_percentage',100)} placeholder="0 - 100" /></div>
                    <div className="col-md-4"><label className="form-label">12TH REGISTER NO</label><input className="form-control" value={form.twelth_register_no} onChange={e=>handle('twelth_register_no',e.target.value)} /></div>
                    <div className="col-md-2"><label className="form-label">12TH %</label><input className="form-control" inputMode="decimal" value={form.twelth_percentage} onChange={onDecimalChange('twelth_percentage',100)} placeholder="0 - 100" /></div>
                  </div>
                  <div className="row g-3 mt-1">
                    <div className="col-md-6">
                      <label className="form-label">Upload 10TH Marksheet</label>
                      <div className="public-apply-upload">
                        <input key={`tenth-${fileInputKey}`} type="file" accept="image/*" className="form-control" onChange={e=>setTenthMarksheet(e.target.files?.[0]||null)} />
                        <small className="public-apply-upload-hint text-muted">Image only</small>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Upload 12TH Marksheet</label>
                      <div className="public-apply-upload">
                        <input key={`twelth-${fileInputKey}`} type="file" accept="image/*" className="form-control" onChange={e=>setTwelthMarksheet(e.target.files?.[0]||null)} />
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
                        <input key={`photo-${fileInputKey}`} type="file" accept="image/*" className="form-control" onChange={e=>setPhoto(e.target.files?.[0]||null)} />
                        <small className="public-apply-upload-hint text-muted">Image only</small>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Upload Transfer Certificate</label>
                      <div className="public-apply-upload">
                        <input key={`cert-${fileInputKey}`} type="file" accept="image/*" className="form-control" onChange={e=>setCert(e.target.files?.[0]||null)} />
                        <small className="public-apply-upload-hint text-muted">Image only</small>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="public-apply-actions">
                  <button type="button" className="btn btn-outline-secondary" onClick={resetAll}>Clear</button>
                  <button className="btn btn-brand" disabled={loading}>{loading?'Submitting...':'Submit'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
