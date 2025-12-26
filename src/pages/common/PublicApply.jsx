import { useEffect, useState } from 'react'
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
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [courses, setCourses] = useState([])
  const [groups, setGroups] = useState([])
  const handle = (k,v)=> setForm(p=>({...p,[k]:v}))

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
    setPhoto(null); setCert(null)
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

  const submit = async (e) => {
    e.preventDefault(); setMsg(''); setLoading(true)
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
      if (photo) uploads.photo_url = URL.createObjectURL(photo)
      if (cert) uploads.cert_url = URL.createObjectURL(cert)
      await api.submitApplication({
        ...form,
        admission_year: Number(form.admission_year),
        group_id: form.group_id ? Number(form.group_id) : null,
        course_id: form.course_id ? Number(form.course_id) : null,
        tenth_percentage: form.tenth_percentage === '' ? null : Number(form.tenth_percentage),
        twelth_percentage: form.twelth_percentage === '' ? null : Number(form.twelth_percentage),
        ...uploads
      })
      setMsg('Application submitted! Admin/Principal will contact you after approval.')
      resetAll()
    } catch (err) { setMsg(err.message || 'Error submitting form') }
    finally { setLoading(false) }
  }

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-10">
          <div className="card card-soft p-4">
            <div className="d-flex align-items-center gap-2 mb-2">
              <img src={crestPrimary} className="brand-logo" alt="Vijayam crest" />
              <div><h3 className="fw-bold mb-0">Vijayam College of Arts & Science</h3><div className="text-muted">Chennai</div></div>
            </div>
            <h5 className="mt-3">Apply for Admission</h5>
            <form onSubmit={submit}>
              <div className="row g-3">
                <div className="col-12"><h6 className="fw-bold mb-1">Application Details</h6><hr className="hr-soft" /></div>
                <div className="col-md-4"><label className="form-label">Application No</label><input className="form-control" value={form.application_no} readOnly /></div>
                <div className="col-md-4">
                  <label className="form-label">Admission Year</label>
                  <select className="form-select" value={form.admission_year} onChange={e=>handle('admission_year',e.target.value)} required>
                    {Array.from({ length: 5 }, (_, i) => {
                      const year = new Date().getFullYear() - 2 + i
                      return <option key={year} value={year}>{year}</option>
                    })}
                  </select>
                </div>

                <div className="col-md-3">
                  <label className="form-label">Group</label>
                  <select className="form-select" value={form.group_id} onChange={e=>handle('group_id',e.target.value)} required>
                    <option value="">Select Group</option>
                    {groups.map(g=> (
                      <option key={g.id} value={g.id}>{g.name || g.group_name || g.code}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Course</label>
                  <select className="form-select" value={form.course_id} onChange={e=>handle('course_id',e.target.value)} required>
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

                <div className="col-12"><h6 className="fw-bold mb-1">Personal Details</h6><hr className="hr-soft" /></div>
                <div className="col-md-6"><label className="form-label">Full Name</label><input className="form-control" value={form.full_name} onChange={e=>handle('full_name',e.target.value)} required /></div>
                <div className="col-md-3"><label className="form-label">Gender</label><select className="form-select" value={form.gender} onChange={e=>handle('gender',e.target.value)} required><option value="">Select</option>{GENDERS.map(g=> <option key={g} value={g}>{g}</option>)}</select></div>
                <div className="col-md-3"><label className="form-label">Date of Birth</label><input type="date" className="form-control" value={form.date_of_birth} onChange={e=>handle('date_of_birth',e.target.value)} required /></div>
                <div className="col-md-6"><label className="form-label">Father's Name</label><input className="form-control" value={form.father_name} onChange={e=>handle('father_name',e.target.value)} /></div>
                <div className="col-md-6"><label className="form-label">Mother's Name</label><input className="form-control" value={form.mother_name} onChange={e=>handle('mother_name',e.target.value)} /></div>

                <div className="col-12"><h6 className="fw-bold mb-1">Contact & Address</h6><hr className="hr-soft" /></div>
                <div className="col-md-3"><label className="form-label">Mobile</label><input className="form-control" inputMode="tel" maxLength="10" pattern="\\d{10}" value={form.phone_number} onChange={onNumericChange('phone_number',10)} required /></div>
                <div className="col-md-3"><label className="form-label">Parent Mobile</label><input className="form-control" inputMode="tel" maxLength="10" pattern="\\d{10}" value={form.parent_no} onChange={onNumericChange('parent_no',10)} required /></div>
                <div className="col-md-3"><label className="form-label">Nationality</label><input className="form-control" value={form.nationality} onChange={e=>handle('nationality',e.target.value)} /></div>
                <div className="col-md-3"><label className="form-label">State</label><select className="form-select" value={form.state} onChange={e=>handle('state',e.target.value)}><option value="">Select</option>{STATES.map(s=> <option key={s} value={s}>{s}</option>)}</select></div>
                <div className="col-md-4"><label className="form-label">Aadhar No</label><input className="form-control" inputMode="numeric" maxLength="12" pattern="\\d{12}" placeholder="12 digits" value={form.aadhar_number} onChange={onNumericChange('aadhar_number',12)} /></div>
                <div className="col-md-4"><label className="form-label">Postal Code (PIN)</label><input className="form-control" inputMode="numeric" maxLength="6" pattern="\\d{6}" placeholder="6 digits" value={form.pincode} onChange={onNumericChange('pincode',6)} required /></div>
                <div className="col-md-4"><label className="form-label">Religion</label><select className="form-select" value={form.religion} onChange={e=>handle('religion',e.target.value)}><option value="">Select</option>{RELIGIONS.map(r=> <option key={r} value={r}>{r}</option>)}</select></div>
                <div className="col-md-4"><label className="form-label">Caste</label><select className="form-select" value={form.caste} onChange={e=>handle('caste',e.target.value)}><option value="">Select</option>{CASTES.map(c=> <option key={c} value={c}>{c}</option>)}</select></div>
                <div className="col-12"><label className="form-label">Address</label><textarea className="form-control" rows="2" value={form.address} onChange={e=>handle('address',e.target.value)} required></textarea></div>

                <div className="col-12"><h6 className="fw-bold mb-1">Academic Records</h6><hr className="hr-soft" /></div>
                <div className="col-md-4"><label className="form-label">10th Register No</label><input className="form-control" value={form.tenth_register_no} onChange={e=>handle('tenth_register_no',e.target.value)} /></div>
                <div className="col-md-2"><label className="form-label">10th %</label><input className="form-control" inputMode="decimal" value={form.tenth_percentage} onChange={onDecimalChange('tenth_percentage',100)} placeholder="0 - 100" /></div>
                <div className="col-md-4"><label className="form-label">12th Register No</label><input className="form-control" value={form.twelth_register_no} onChange={e=>handle('twelth_register_no',e.target.value)} /></div>
                <div className="col-md-2"><label className="form-label">12th %</label><input className="form-control" inputMode="decimal" value={form.twelth_percentage} onChange={onDecimalChange('twelth_percentage',100)} placeholder="0 - 100" /></div>

                <div className="col-12"><h6 className="fw-bold mb-1">Uploads</h6><hr className="hr-soft" /></div>
                <div className="col-md-6"><label className="form-label">Upload Photo</label><input type="file" accept="image/*" className="form-control" onChange={e=>setPhoto(e.target.files?.[0]||null)} /></div>

                <div className="col-12 d-flex justify-content-end gap-2 mt-2">
                  <button type="button" className="btn btn-outline-secondary" onClick={resetAll}>Clear</button>
              <button className="btn btn-brand" disabled={loading}>{loading?'Submitting...':'Submit'}</button>
                </div>
              </div>
            </form>
            {msg && <div className="alert alert-info mt-3 mb-0">{msg}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
