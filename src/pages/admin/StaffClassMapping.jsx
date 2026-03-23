import { useEffect, useState } from 'react'
import AdShellAdmin from '../../components/AdShellAdmin'
import { supabase } from '../../../supabaseClient'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

export default function StaffClassMapping() {
  const [staffList, setStaffList] = useState([])
  const [classes, setClasses] = useState([])
  const [selectedStaff, setSelectedStaff] = useState('')
  const [selectedClasses, setSelectedClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [smartFilterEnabled, setSmartFilterEnabled] = useState(false)

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        // Fetch staff
        const { data: staffData } = await supabase
          .from('staff')
          .select('id, full_name, staff_id')
          .order('full_name')
        setStaffList(staffData || [])

        // Fetch classes
        const { data: classesData } = await supabase
          .from('classes')
          .select('id, class_name, class_number, school_level')
          .order('class_number')
        setClasses(classesData || [])

        // Check if smart filter is enabled (stored in localStorage for now)
        const stored = localStorage.getItem('smartStaffFilterEnabled')
        setSmartFilterEnabled(stored === 'true')
      } catch (err) {
        console.error('Error loading data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Load permissions when staff is selected
  useEffect(() => {
    const loadPermissions = async () => {
      if (!selectedStaff) {
        setSelectedClasses([])
        return
      }

      try {
        const { data, error } = await supabase
          .from('staff_class_permissions')
          .select('class_id')
          .eq('staff_id', selectedStaff)

        if (error) throw error

        setSelectedClasses(data?.map(p => p.class_id) || [])
      } catch (err) {
        console.error('Error loading permissions:', err)
      }
    }

    loadPermissions()
  }, [selectedStaff])

  // Toggle class selection
  const toggleClass = (classId) => {
    setSelectedClasses(prev => 
      prev.includes(classId)
        ? prev.filter(id => id !== classId)
        : [...prev, classId]
    )
  }

  // Save permissions
  const handleSave = async () => {
    if (!selectedStaff) {
      toast.warning('Please select a staff member')
      return
    }

    setSaving(true)
    try {
      // Delete existing permissions
      await supabase
        .from('staff_class_permissions')
        .delete()
        .eq('staff_id', selectedStaff)

      // Insert new permissions
      if (selectedClasses.length > 0) {
        const inserts = selectedClasses.map(classId => ({
          staff_id: selectedStaff,
          class_id: classId
        }))

        const { error } = await supabase
          .from('staff_class_permissions')
          .insert(inserts)

        if (error) throw error
      }

      toast.success('Staff class permissions saved successfully')
    } catch (err) {
      console.error('Error saving permissions:', err)
      toast.error('Failed to save permissions')
    } finally {
      setSaving(false)
    }
  }

  // Toggle smart filter
  const toggleSmartFilter = async () => {
    const newValue = !smartFilterEnabled
    setSmartFilterEnabled(newValue)
    localStorage.setItem('smartStaffFilterEnabled', newValue.toString())
    toast.success(newValue ? 'Smart Staff Filtering enabled' : 'Smart Staff Filtering disabled')
  }

  // Group classes by school level
  const groupedClasses = classes.reduce((acc, cls) => {
    const level = cls.school_level || 'Other'
    if (!acc[level]) acc[level] = []
    acc[level].push(cls)
    return acc
  }, {})

  if (loading) {
    return (
      <AdShellAdmin>
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </AdShellAdmin>
    )
  }

  return (
    <AdShellAdmin>
      <div className="container-fluid py-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h4 className="mb-0">Staff Class Mapping</h4>
          
          {/* Smart Filter Toggle */}
          <div className="form-check form-switch">
            <input
              className="form-check-input"
              type="checkbox"
              id="smartFilterToggle"
              checked={smartFilterEnabled}
              onChange={toggleSmartFilter}
            />
            <label className="form-check-label" htmlFor="smartFilterToggle">
              Enable Smart Staff Filtering
            </label>
          </div>
        </div>

        <div className="row">
          <div className="col-md-4">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">Select Staff</h5>
              </div>
              <div className="card-body">
                <select
                  className="form-select"
                  value={selectedStaff}
                  onChange={(e) => setSelectedStaff(e.target.value)}
                >
                  <option value="">Choose a staff member...</option>
                  {staffList.map(staff => (
                    <option key={staff.id} value={staff.id}>
                      {staff.full_name} ({staff.staff_id || 'N/A'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Save Button */}
            {selectedStaff && (
              <div className="mt-3">
                <button
                  className="btn btn-primary w-100"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Permissions'}
                </button>
              </div>
            )}
          </div>

          <div className="col-md-8">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">Select Allowed Classes</h5>
                {selectedStaff && (
                  <span className="text-muted small">
                    {selectedClasses.length} class(es) selected
                  </span>
                )}
              </div>
              <div className="card-body">
                {!selectedStaff ? (
                  <p className="text-muted text-center py-4">
                    Please select a staff member to assign classes
                  </p>
                ) : Object.keys(groupedClasses).length === 0 ? (
                  <p className="text-muted text-center py-4">
                    No classes found
                  </p>
                ) : (
                  Object.entries(groupedClasses).map(([level, levelClasses]) => (
                    <div key={level} className="mb-4">
                      <h6 className="border-bottom pb-2 mb-2">
                        <span className="badge bg-secondary me-2">{level}</span>
                      </h6>
                      <div className="row g-2">
                        {levelClasses.map(cls => (
                          <div key={cls.id} className="col-6 col-md-4">
                            <div className="form-check">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id={`class-${cls.id}`}
                                checked={selectedClasses.includes(cls.id)}
                                onChange={() => toggleClass(cls.id)}
                              />
                              <label
                                className="form-check-label"
                                htmlFor={`class-${cls.id}`}
                              >
                                {cls.class_name}
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <ToastContainer position="top-right" autoClose={3000} />
      </div>
    </AdShellAdmin>
  )
}
