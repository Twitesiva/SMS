import { useEffect, useMemo, useState } from 'react'
import AdShellAdmin from '../../components/AdShellAdmin'
import { supabase } from '../../../supabaseClient'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

const SUBJECT_TYPES = ['core', 'activity', 'language', 'skill']

const buildDefaultForm = () => ({
  staff_id: '',
  full_name: '',
  gender: '',
  dob: '',
  phone: '',
  aadhar: '',
  email: '',
  address: '',
  designation: '',
  qualification: '',
  experience: '',
  joining_date: ''
})

export default function ProfileCreation() {
  const [formData, setFormData] = useState(buildDefaultForm)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [checkingId, setCheckingId] = useState(false)
  const [photo, setPhoto] = useState(null)

  const [subjects, setSubjects] = useState([])
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([])
  const [subjectSearch, setSubjectSearch] = useState('')

  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const { data, error } = await supabase
          .from('subjects')
          .select('id, subject_title, subject_code')
          .order('subject_title', { ascending: true })
        if (error) throw error
        setSubjects(data || [])
      } catch (error) {
        console.error('Failed to load subjects', error)
        toast.error('Unable to load subjects list from Supabase')
      }
    }

    loadSubjects()
  }, [])

  const filteredSubjects = useMemo(() => {
    const term = subjectSearch.trim().toLowerCase()
    if (!term) return subjects
    return subjects.filter((subject) => {
      const name = String(subject.subject_title || '').toLowerCase()
      const code = String(subject.subject_code || '').toLowerCase()
      return name.includes(term) || code.includes(term)
    })
  }, [subjectSearch, subjects])

  const handleChange = (e) => {
    const { name, value } = e.target

    if (name === 'phone') {
      if (!/^\d*$/.test(value)) return
      if (value.length > 10) return
    }

    if (name === 'aadhar') {
      if (!/^\d*$/.test(value)) return
      if (value.length > 12) return
    }

    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }))
  }

  const checkStaffId = async (id) => {
    if (!id) return
    setCheckingId(true)
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('staff_id')
        .eq('staff_id', id)
        .maybeSingle()

      if (error) throw error
      if (data) {
        setErrors((prev) => ({ ...prev, staff_id: 'Staff ID already exists' }))
      } else {
        setErrors((prev) => ({ ...prev, staff_id: null }))
      }
    } catch (err) {
      console.error('Error checking staff ID:', err)
    } finally {
      setCheckingId(false)
    }
  }

  const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    if (!file) { resolve(null); return }
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Unable to read file'))
    reader.readAsDataURL(file)
  })

  const uploadFile = async (file) => {
    if (!file) return null
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`
      const { error } = await supabase.storage.from('staff_photos').upload(fileName, file)
      if (error) throw error
      const { data: publicData } = supabase.storage.from('staff_photos').getPublicUrl(fileName)
      return publicData.publicUrl
    } catch (err) {
      console.warn('Upload failed, using Base64 fallback:', err)
      return fileToDataUrl(file)
    }
  }

  const isFormValid = () => {
    const requiredFields = [
      'staff_id', 'full_name', 'gender', 'dob', 'phone',
      'aadhar', 'email', 'address', 'designation',
      'qualification', 'experience', 'joining_date'
    ]

    const allFilled = requiredFields.every((field) => String(formData[field] || '').trim() !== '')
    const phoneValid = formData.phone.length === 10
    const aadharValid = formData.aadhar.length === 12
    const noErrors = !Object.values(errors).some((err) => err !== null)

    return allFilled && phoneValid && aadharValid && noErrors && !checkingId
  }

  const toggleSubject = (subjectId) => {
    setSelectedSubjectIds((prev) => {
      const exists = prev.includes(subjectId)
      if (exists) return prev.filter((id) => id !== subjectId)
      return [...prev, subjectId]
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isFormValid()) return

    setLoading(true)
    try {
      const photoUrl = photo ? await uploadFile(photo) : null

      const payload = {
        staff_id: formData.staff_id,
        full_name: formData.full_name,
        gender: formData.gender,
        dob: formData.dob,
        aadhar_number: formData.aadhar,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        designation: formData.designation,
        qualification: formData.qualification,
        experience: parseInt(formData.experience, 10) || 0,
        joining_date: formData.joining_date,
        profile_photo: photoUrl,
        status: 'ACTIVE'
      }

      const { data: insertedStaff, error: staffError } = await supabase
        .from('staff')
        .insert([payload])
        .select('id')
        .single()

      if (staffError) throw staffError

      if (selectedSubjectIds.length > 0) {
        const rows = selectedSubjectIds.map((subjectId) => ({
          staff_id: insertedStaff.id,
          subject_id: subjectId
        }))
        const { error: mappingError } = await supabase
          .from('staff_subjects')
          .insert(rows)
        if (mappingError) throw mappingError
      }

      toast.success('Successfully created staff profile')
      setFormData(buildDefaultForm())
      setPhoto(null)
      setErrors({})
      setSelectedSubjectIds([])
      setSubjectSearch('')
    } catch (err) {
      console.error('Error creating profile:', err)
      toast.error(err.message || 'Failed to create profile.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdShellAdmin
      brandTitle="ADMIN PORTAL"
      footerTitle="Admin Management Studio"
      footerSubtitle="Crafted for Vijayam College"
    >
      <div className="desktop-container" style={{ overflowX: 'hidden' }}>
        <h4 className="mb-4">Profile Creation</h4>

        <div className="row g-4 justify-content-center mx-0">
          <div className="col-12">
            <div className="students-section-shell card card-soft mb-4">
              <div className="students-section-shell-header mb-3">
                <div className="d-flex justify-content-between align-items-center w-100">
                  <div>
                    <h5 className="section-title mb-1" style={{ fontSize: '1.1rem' }}>Staff Profile Creation</h5>
                    <p className="students-section-copy mb-0">Create new staff profiles and assign subjects.</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline-light btn-sm"
                    onClick={() => {
                      setFormData(buildDefaultForm())
                      setErrors({})
                      setSelectedSubjectIds([])
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>

              <form className="row g-3" onSubmit={handleSubmit}>
                <div className="col-md-6">
                  <label className="form-label">Staff ID <span className="text-danger">*</span></label>
                  <input
                    className={`form-control ${errors.staff_id ? 'is-invalid' : ''}`}
                    type="text"
                    name="staff_id"
                    value={formData.staff_id}
                    onChange={handleChange}
                    onBlur={(e) => checkStaffId(e.target.value)}
                    placeholder="Enter staff ID"
                    required
                  />
                  {errors.staff_id && <div className="invalid-feedback">{errors.staff_id}</div>}
                  {checkingId && <div className="form-text text-muted">Checking ID availability...</div>}
                </div>
                <div className="col-md-6">
                  <label className="form-label">Full Name <span className="text-danger">*</span></label>
                  <input className="form-control" type="text" name="full_name" value={formData.full_name} onChange={handleChange} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Gender <span className="text-danger">*</span></label>
                  <select className="form-select" name="gender" value={formData.gender} onChange={handleChange} required>
                    <option value="" disabled>Select gender</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">DOB <span className="text-danger">*</span></label>
                  <input className="form-control" type="date" name="dob" value={formData.dob} onChange={handleChange} onClick={(e) => e.target.showPicker()} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Phone <span className="text-danger">*</span></label>
                  <input className="form-control" type="tel" name="phone" value={formData.phone} onChange={handleChange} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Aadhar no <span className="text-danger">*</span></label>
                  <input className="form-control" type="text" name="aadhar" value={formData.aadhar} onChange={handleChange} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Email <span className="text-danger">*</span></label>
                  <input className="form-control" type="email" name="email" value={formData.email} onChange={handleChange} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Address <span className="text-danger">*</span></label>
                  <input className="form-control" type="text" name="address" value={formData.address} onChange={handleChange} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Designation <span className="text-danger">*</span></label>
                  <input className="form-control" type="text" name="designation" value={formData.designation} onChange={handleChange} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Qualification <span className="text-danger">*</span></label>
                  <input className="form-control" type="text" name="qualification" value={formData.qualification} onChange={handleChange} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Experience <span className="text-danger">*</span></label>
                  <input className="form-control" type="text" name="experience" value={formData.experience} onChange={handleChange} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Joining Date <span className="text-danger">*</span></label>
                  <input className="form-control" type="date" name="joining_date" value={formData.joining_date} onChange={handleChange} onClick={(e) => e.target.showPicker()} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Profile Photo</label>
                  <input className="form-control" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
                  <div className="form-text">Max size 2MB. JPG/PNG only.</div>
                </div>

                <div className="col-12">
                  <label className="form-label">Subjects</label>
                  <input
                    type="text"
                    className="form-control mb-2"
                    placeholder="Search by subject name, code or type"
                    value={subjectSearch}
                    onChange={(e) => setSubjectSearch(e.target.value)}
                  />
                  <div className="border rounded p-2" style={{ maxHeight: 220, overflowY: 'auto', background: '#fff' }}>
                    {filteredSubjects.length === 0 ? (
                      <div className="text-muted small px-2 py-1">No subjects found.</div>
                    ) : (
                      filteredSubjects.map((subject) => (
                        <label key={subject.id} className="d-flex align-items-center gap-2 px-2 py-1">
                          <input
                            type="checkbox"
                            className="form-check-input me-2"
                            value={subject.id}
                            checked={selectedSubjectIds.includes(subject.id)}
                            onChange={() => toggleSubject(subject.id)}
                          />
                          {subject.subject_code ? `${subject.subject_code} - ` : ''}{subject.subject_title}
                        </label>
                      ))
                    )}
                  </div>
                  <div className="form-text">Selected: {selectedSubjectIds.length}</div>
                </div>

                <div className="col-12 d-flex justify-content-end gap-2">
                  <button type="submit" className="btn btn-primary" disabled={loading || !isFormValid()}>
                    {loading ? 'Creating...' : 'Create profile'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
      <ToastContainer position="top-right" autoClose={3000} />
    </AdShellAdmin>
  )
}
