import { useState } from 'react'
import AdShellAdmin from '../../components/AdShellAdmin'
import { supabase } from '../../../supabaseClient'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'



export default function ProfileCreation() {
  const [formData, setFormData] = useState({
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
    joining_date: '',
    status: ''
  })

  // Track validation errors and duplicate checks
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [checkingId, setCheckingId] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target

    // Validation for specific fields
    if (name === 'phone') {
      // Allow only numbers and max 10 chars
      if (!/^\d*$/.test(value)) return
      if (value.length > 10) return
    }

    if (name === 'aadhar') {
      // Allow only numbers and max 12 chars
      if (!/^\d*$/.test(value)) return
      if (value.length > 12) return
    }

    setFormData(prev => ({ ...prev, [name]: value }))

    // Clear specific errors when user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }))
    }
  }

  // Check for duplicate Staff ID
  const checkStaffId = async (id) => {
    if (!id) return
    setCheckingId(true)
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('staff_id')
        .eq('staff_id', id)
        .maybeSingle()

      if (error) throw error

      if (data) {
        setErrors(prev => ({ ...prev, staff_id: 'Staff ID already exists' }))
      } else {
        setErrors(prev => ({ ...prev, staff_id: null }))
      }
    } catch (err) {
      console.error('Error checking staff ID:', err)
    } finally {
      setCheckingId(false)
    }
  }

  // Derive form validity
  const isFormValid = () => {
    const requiredFields = [
      'staff_id', 'full_name', 'gender', 'dob', 'phone',
      'aadhar', 'email', 'address', 'designation',
      'qualification', 'experience', 'joining_date', 'status'
    ]

    // Check all required fields are filled
    const allFilled = requiredFields.every(field => formData[field] && formData[field].toString().trim() !== '')

    // Check specific length requirements
    const phoneValid = formData.phone.length === 10
    const aadharValid = formData.aadhar.length === 12

    // Check no errors exist
    const noErrors = !Object.values(errors).some(err => err !== null)

    return allFilled && phoneValid && aadharValid && noErrors && !checkingId
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isFormValid()) return

    setLoading(true)

    try {
      const { error } = await supabase
        .from('teachers')
        .insert([
          {
            staff_id: formData.staff_id,
            full_name: formData.full_name,
            gender: formData.gender,
            date_of_birth: formData.dob,
            aadhar_number: formData.aadhar,
            phone_number: formData.phone,
            email: formData.email,
            address: formData.address,
            designation: formData.designation,
            qualification: formData.qualification,
            experience_years: parseInt(formData.experience) || 0,
            joining_date: formData.joining_date,
            status: formData.status
          }
        ])

      if (error) throw error

      toast.success('Successfully created staff profile!')
      // Reset form
      setFormData({
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
        joining_date: '',
        status: ''
      })
      setErrors({})
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
                    <p className="students-section-copy mb-0">Create new staff profiles with academic, contact, and employment details.</p>
                  </div>
                  <button type="button" className="btn btn-outline-light btn-sm" onClick={() => {
                    setFormData({
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
                      joining_date: '',
                      status: ''
                    })
                    setErrors({})
                  }}>Reset</button>
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
                  <input
                    className="form-control"
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    placeholder="Enter full name"
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Gender <span className="text-danger">*</span></label>
                  <select
                    className="form-select"
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    required
                  >
                    <option value="" disabled>Select gender</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">DOB <span className="text-danger">*</span></label>
                  <input
                    className="form-control"
                    type="date"
                    name="dob"
                    value={formData.dob}
                    onChange={handleChange}
                    onClick={(e) => e.target.showPicker()}
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Phone <span className="text-danger">*</span></label>
                  <input
                    className="form-control"
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="Enter phone number (10 digits)"
                    required
                  />
                  {formData.phone && formData.phone.length !== 10 && (
                    <div className="form-text text-danger">Must be 10 digits</div>
                  )}
                </div>
                <div className="col-md-6">
                  <label className="form-label">Aadhar no <span className="text-danger">*</span></label>
                  <input
                    className="form-control"
                    type="text"
                    name="aadhar"
                    value={formData.aadhar}
                    onChange={handleChange}
                    placeholder="Enter Aadhar number (12 digits)"
                    required
                  />
                  {formData.aadhar && formData.aadhar.length !== 12 && (
                    <div className="form-text text-danger">Must be 12 digits</div>
                  )}
                </div>
                <div className="col-md-6">
                  <label className="form-label">Email <span className="text-danger">*</span></label>
                  <input
                    className="form-control"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="name@vijayam.in"
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Address <span className="text-danger">*</span></label>
                  <input
                    className="form-control"
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="Enter address"
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Designation <span className="text-danger">*</span></label>
                  <select
                    className="form-select"
                    name="designation"
                    value={formData.designation}
                    onChange={handleChange}
                    required
                  >
                    <option value="" disabled>Select designation</option>
                    <option value="PROFESSOR">Professor</option>
                    <option value="ASSISTANT_PROFESSOR">Assistant Professor</option>
                    <option value="HOD">HOD</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Qualification <span className="text-danger">*</span></label>
                  <input
                    className="form-control"
                    type="text"
                    name="qualification"
                    value={formData.qualification}
                    onChange={handleChange}
                    placeholder="Enter qualification"
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Experience <span className="text-danger">*</span></label>
                  <input
                    className="form-control"
                    type="text"
                    name="experience"
                    value={formData.experience}
                    onChange={handleChange}
                    placeholder="Enter experience"
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Joining Date <span className="text-danger">*</span></label>
                  <input
                    className="form-control"
                    type="date"
                    name="joining_date"
                    value={formData.joining_date}
                    onChange={handleChange}
                    onClick={(e) => e.target.showPicker()}
                    required
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Status <span className="text-danger">*</span></label>
                  <select
                    className="form-select"
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    required
                  >
                    <option value="" disabled>Select status</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
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




