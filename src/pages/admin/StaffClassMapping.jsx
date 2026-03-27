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
  const [allMappings, setAllMappings] = useState([])

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

        // Fetch all permissions for grouping
        const { data: mappingsData } = await supabase
          .from('staff_class_permissions')
          .select('staff_id, class_id')
        setAllMappings(mappingsData || [])
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

      // Refresh all mappings
      const { data: updatedMappings } = await supabase
        .from('staff_class_permissions')
        .select('staff_id, class_id')
      setAllMappings(updatedMappings || [])
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

  const handleSelectAll = (level, checked) => {
    const levelClasses = groupedClasses[level] || []
    
    if (checked) {
      setSelectedClasses(prev => {
        const newSelected = [...prev]
        levelClasses.forEach(c => {
          if (!newSelected.includes(c.id)) newSelected.push(c.id)
        })
        return newSelected
      })
    } else {
      setSelectedClasses(prev =>
        prev.filter(id => !levelClasses.some(c => c.id === id))
      )
    }
  }

  const handleEditMapping = (staffId, classIds) => {
    setSelectedStaff(staffId)
    setSelectedClasses(classIds)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleRemoveSingleMapping = async (staffId, classId) => {
    try {
      const { error } = await supabase
        .from('staff_class_permissions')
        .delete()
        .eq('staff_id', staffId)
        .eq('class_id', classId)

      if (error) throw error
      
      toast.success('Class removed successfully')
      
      setAllMappings(prev => prev.filter(m => !(m.staff_id === staffId && m.class_id === classId)))
      
      if (selectedStaff === staffId) {
        setSelectedClasses(prev => prev.filter(id => id !== classId))
      }
    } catch (err) {
      console.error('Error removing class:', err)
      toast.error('Failed to remove class')
    }
  }

  // Group classes by school level
  const groupedClasses = classes.reduce((acc, cls) => {
    const level = cls.school_level || 'Other'
    if (!acc[level]) acc[level] = []
    acc[level].push(cls)
    return acc
  }, {})

  // Group mappings for UI display
  const groupedMappings = Object.entries(
    allMappings.reduce((acc, mapping) => {
      if (!acc[mapping.staff_id]) acc[mapping.staff_id] = []
      acc[mapping.staff_id].push(mapping.class_id)
      return acc
    }, {})
  )

  // Debug Logs
  useEffect(() => {
    console.log("Selected Classes:", selectedClasses);
    console.log("All Mappings:", allMappings);
    console.log("Grouped Mappings:", groupedMappings);
    console.log("Smart Filter Enabled:", smartFilterEnabled);
  }, [selectedClasses, allMappings, groupedMappings, smartFilterEnabled]);

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
                  disabled={saving || selectedClasses.length === 0}
                >
                  {saving ? 'Saving...' : 'Save / Update Permissions'}
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
                  Object.entries(groupedClasses).map(([level, levelClasses]) => {
                    const selectedCount = levelClasses.filter(c => selectedClasses.includes(c.id)).length;
                    const isAllSelected = selectedCount === levelClasses.length && levelClasses.length > 0;
                    
                    return (
                    <div key={level} className="mb-4">
                      <h6 className="border-bottom pb-2 mb-2 d-flex justify-content-between align-items-center">
                        <div>
                          <span className="badge bg-secondary badge-text-white me-2">{level}</span>
                          {selectedCount > 0 && <span className="text-muted small">({selectedCount} selected)</span>}
                        </div>
                        <div className="form-check m-0">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={isAllSelected}
                            onChange={(e) => handleSelectAll(level, e.target.checked)}
                            id={`selectAll-${level}`}
                          />
                          <label className="form-check-label small" htmlFor={`selectAll-${level}`} style={{cursor: 'pointer'}}>
                            Select All
                          </label>
                        </div>
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
                  )})
                )}

                {/* FEATURE 1: SHOW SELECTED CLASSES */}
                <div className="mt-4 border-top pt-3">
                  <h6 className="fw-bold mb-3">Selected Classes</h6>
                  {selectedClasses.length === 0 ? (
                    <p className="text-muted small">No classes selected</p>
                  ) : (
                    <div className="d-flex flex-wrap gap-2">
                      {selectedClasses.map(id => {
                        const cls = classes.find(c => String(c.id) === String(id))
                        return (
                      <span key={id} className="badge bg-primary badge-text-white px-3 py-2">
                            {cls ? cls.class_name : id}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FEATURE 2: ASSIGNED STAFF CLASS MAPPINGS */}
        <div className="card mt-4">
          <div className="card-header bg-white">
            <h5 className="mb-0 fw-bold">Assigned Staff Class Mappings</h5>
          </div>
          <div className="card-body bg-light">
            {groupedMappings.length === 0 ? (
              <p className="text-muted mb-0 text-center py-3">No mappings created yet</p>
            ) : (
              <div className="row g-3">
                {groupedMappings.map(([staffId, classIds]) => {
                  const staff = staffList.find(s => String(s.id) === String(staffId))
                  if (!staff) return null;
                  
                  return (
                    <div key={staffId} className="col-md-4">
                      <div className="p-3 border rounded shadow-sm bg-white h-100 position-relative">
                        <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                          <h6 className="fw-bold text-dark mb-0">
                            {staff.full_name} <span className="text-muted small fw-normal">({staff.staff_id || 'N/A'})</span>
                          </h6>
                          <button 
                            className="btn btn-sm btn-outline-primary py-0 px-2" 
                            style={{ fontSize: '0.8rem' }}
                            onClick={() => handleEditMapping(staffId, classIds)}
                          >
                            <i className="bi bi-pencil-fill me-1"></i>Edit
                          </button>
                        </div>
                        <div className="d-flex flex-wrap gap-2">
                          {classIds.map(cid => {
                            const cls = classes.find(c => String(c.id) === String(cid))
                            return (
                              <span key={cid} className="badge bg-secondary badge-text-white d-flex align-items-center gap-1 pe-2">
                                {cls ? cls.class_name : cid}
                                <i 
                                  className="bi bi-x-circle-fill ms-1" 
                                  style={{cursor: 'pointer', fontSize: '0.9rem'}} 
                                  onClick={() => handleRemoveSingleMapping(staffId, cid)}
                                  title="Remove mapping"
                                ></i>
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <ToastContainer position="top-right" autoClose={3000} />
      </div>
    </AdShellAdmin>
  )
}
