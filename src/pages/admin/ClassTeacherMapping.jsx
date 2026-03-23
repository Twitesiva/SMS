import { useEffect, useState, useMemo } from 'react'
import AdShellAdmin from '../../components/AdShellAdmin'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../store/ui'
import './AdminContent.css'

// Level to class number ranges (exact match task spec)
const LEVEL_RANGES = {
  Primary: { min: 1, max: 5 },
  Middle: { min: 6, max: 9 },
  Secondary: { min: 10, max: 12 }
}

const TERMS = ['Term 1', 'Term 2', 'Term 3']

const EMPTY_FORM = {
  academic_year_id: '',
  school_level: '',
  class_id: '',
  group_id: '',
  section_id: '',
  term: '',
  staff_id: ''
}

export default function ClassTeacherMapping() {
  const [academicYears, setAcademicYears] = useState([])
  const [classes, setClasses] = useState([])
  const [groups, setGroups] = useState([])
  const [classSections, setClassSections] = useState([])
  const [staffList, setStaffList] = useState([])
  const [classTeachers, setClassTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [mappings, setMappings] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [sectionLabelMap, setSectionLabelMap] = useState({})

  const loadMappings = async () => {
    try {
      const { data, error } = await supabase
        .from('class_teacher_mapping')
        .select(`
          id,
          academic_year_id,
          class_section_id,
          staff_id,
          group_id,
          term,
          academic_years (year_name),
          class_sections (
            id,
            class_id,
            section_id,
            created_at,
            sections (
              section_name
            ),
            classes (
              class_name,
              school_level
            )
          ),
          staff (
            id,
            full_name
          )
        `)
        .order('id', { ascending: false })

      if (error) throw error
      setMappings(data || [])
      const labelGroups = {}
      const computedLabels = {}
      ;(data || []).forEach(mapping => {
        const section = mapping.class_sections
        if (!section?.id) return
        const key = `${mapping.academic_year_id}-${section.class_id}`
        if (!labelGroups[key]) labelGroups[key] = []
        if (!labelGroups[key].some(item => item.id === section.id)) {
          labelGroups[key].push({ id: section.id, created_at: section.created_at })
        }
      })
      Object.values(labelGroups).forEach(group => {
        group.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
        group.forEach((sec, index) => {
          computedLabels[sec.id] = `A${index + 1}`
        })
      })
      setSectionLabelMap(computedLabels)
    } catch (err) {
      console.error('Mappings load error:', err)
    }
  }

  // Derived state
  const selectedClass = useMemo(() => 
    classes.find(c => String(c.id) === String(formData.class_id)), [classes, formData.class_id]
  )
  const classNumber = selectedClass ? Number(selectedClass.class_number || 0) : 0
  const isSecondary = formData.school_level === 'Secondary'
  const isHigherSec = classNumber === 11 || classNumber === 12
  const isTermBased = formData.school_level === 'Primary' || formData.school_level === 'Middle'

  // Filtered data
  const filteredClasses = useMemo(() => {
    if (!formData.school_level) return []
    const range = LEVEL_RANGES[formData.school_level]
    return classes.filter(c => {
      const num = Number(c.class_number || 0)
      return range && num >= range.min && num <= range.max
    })
  }, [classes, formData.school_level])

  const filteredGroups = useMemo(() => 
    groups.filter(g => String(g.class_id) === String(formData.class_id)),
  [groups, formData.class_id])

  const availableStaffList = useMemo(() => staffList, [staffList])

  // Load all initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const [ayRes, clsRes, grpRes, staffRes] = await Promise.all([
          supabase.from('academic_years').select('id, year_name').order('year_name'),
          supabase.from('classes').select('id, class_name, class_number, school_level').order('class_number'),
          supabase.from('groups').select('id, group_name, class_id').order('group_name'),
          supabase.from('staff').select('id, full_name, staff_id').order('full_name')
        ])

        setAcademicYears(ayRes.data || [])
        setClasses(clsRes.data || [])
        setGroups(grpRes.data || [])
        setStaffList(staffRes.data || [])
        await loadMappings()
      } catch (err) {
        console.error('Load error:', err)
        showToast('Failed to load data', { type: 'danger' })
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const fetchClassTeachers = async () => {
    try {
      const { data, error } = await supabase
        .from('class_teacher_mapping')
        .select(`
          id,
          staff_id,
          class_section_id,
          academic_year_id,
          staff (full_name),
          class_sections (
            id,
            class_id,
            section_id,
            sections (section_name),
            classes (class_name)
          )
        `)
      if (error) throw error
      setClassTeachers(data || [])
      console.log('classTeachers:', data || [])
    } catch (err) {
      console.error('Failed to fetch class teachers', err)
    }
  }

  useEffect(() => {
    fetchClassTeachers()
  }, [])

  // Load sections when class/group changes (EXACT spec)
  useEffect(() => {
    // Safety check: return early if no class selected
    if (!formData.class_id) {
      setClassSections([])
      setFormData(prev => ({ ...prev, section_id: '' }))
      return
    }

    const loadSections = async () => {
      try {
        let query = supabase
          .from('class_sections')
          .select(`
            id,
            class_id,
            section_id,
            created_at
          `)
          .eq('class_id', formData.class_id)
          .eq('academic_year_id', formData.academic_year_id)

        // For Class 11/12: filter by group_id if selected
        // For classes below 11: filter by group_id = null
        if (isHigherSec && formData.group_id) {
          query = query.eq('group_id', formData.group_id)
        } else {
          query = query.is('group_id', null)
        }

        const { data, error } = await query.order('created_at')
        if (error) throw error
        
        const normalizedSections = (data || []).map(row => ({
          id: row.id,
          section_id: row.section_id
        }))
        setClassSections(normalizedSections)
        setFormData(prev => {
          const keepSection = normalizedSections.some(s => s.id === prev.section_id)
          return { ...prev, section_id: keepSection ? prev.section_id : '' }
        })
      } catch (err) {
        console.error('Sections load error:', err)
        showToast('Failed to load sections', { type: 'warning' })
      setClassSections([])
      }
    }

    loadSections()
  }, [formData.class_id, formData.group_id, formData.academic_year_id, isHigherSec])

  // Reset dependent fields
  const handleSchoolLevelChange = (level) => {
    setFormData({
      ...formData,
      school_level: level,
      class_id: '',
      group_id: '',
      section_id: '',
      term: ''
    })
    setClassSections([])
  }

  const handleClassChange = (classId) => {
    setFormData({
      ...formData,
      class_id: classId,
      group_id: '',
      section_id: '',
      term: ''
    })
    setClassSections([])
  }

  const handleGroupChange = (groupId) => {
    setFormData(prev => ({
      ...prev,
      group_id: groupId,
      section_id: ''
    }))
    setClassSections([])
  }

  const handleSectionChange = (value) => {
    const idx = classSections.findIndex(sec => sec.id === value)
    console.log('Selected section label', `A${idx + 1}`, 'class_section_id', value)
    setFormData(prev => ({ ...prev, section_id: value }))
  }

  // Form validation
  const validateForm = () => {
    const { academic_year_id, school_level, class_id, section_id, staff_id } = formData
    
    if (!academic_year_id) return 'Select Academic Year'
    if (!school_level) return 'Select School Level'
    if (!class_id) return 'Select Class'
    if (!section_id) return 'Select Section'
    if (!staff_id) return 'Select Class Teacher'
    if (isTermBased && !formData.term) return 'Select Term (required for Primary/Middle)'
    if (isHigherSec && !formData.group_id) return 'Select Group (required for Class 11/12)'
    
    return null
  }

  const resetForm = () => {
    setFormData(EMPTY_FORM)
    setEditingId(null)
  }

  const findTeacherMapping = async () => {
    const { staff_id, academic_year_id, section_id } = formData
    if (!staff_id || !academic_year_id || !section_id) return []
    if (isTermBased && !formData.term) return []

    const termValue = isSecondary ? null : formData.term
    let query = supabase
      .from('class_teacher_mapping')
      .select('id')
      .eq('academic_year_id', academic_year_id)
      .eq('class_section_id', section_id)
      .eq('staff_id', staff_id)

    query = termValue === null ? query.is('term', null) : query.eq('term', termValue)

    const { data, error } = await query

    if (error) throw error
    return data || []
  }

  const getTeacherCountForSection = async () => {
    if (!formData.academic_year_id || !formData.section_id) return 0
    if (isTermBased && !formData.term) return 0

    const termValue = isSecondary ? null : formData.term
    let query = supabase
      .from('class_teacher_mapping')
      .select('id')
      .eq('academic_year_id', formData.academic_year_id)
      .eq('class_section_id', formData.section_id)

    query = termValue === null ? query.is('term', null) : query.eq('term', termValue)

    const { data, error } = await query
    if (error) throw error
    return (data || []).length
  }

  const handleEditMapping = (mapping) => {
    const classInfo = mapping.class_sections?.classes
    const derivedLevel = classInfo?.school_level || ''
    setEditingId(mapping.id)
    setFormData({
      academic_year_id: mapping.academic_year_id || '',
      school_level: derivedLevel,
      class_id: mapping.class_sections?.class_id || '',
      group_id: mapping.group_id || '',
      section_id: mapping.class_section_id || '',
      term: mapping.term || '',
      staff_id: mapping.staff_id || ''
    })
  }

  const handleDeleteMapping = async (id) => {
    if (!id) return
    try {
      const { error } = await supabase.from('class_teacher_mapping').delete().eq('id', id)
      if (error) throw error
      showToast('Assignment deleted', { type: 'success' })
      await loadMappings()
      if (editingId === id) resetForm()
    } catch (err) {
      console.error('Delete mapping error:', err)
      showToast('Failed to delete mapping', { type: 'danger' })
    }
  }

  // Save handler
  const handleSubmit = async () => {
    const validationError = validateForm()
    if (validationError) {
      showToast(validationError, { type: 'warning' })
      return
    }

    setSaving(true)
    try {
      const currentCount = await getTeacherCountForSection()
      if (!editingId && currentCount >= 2) {
        showToast('Maximum 2 class teachers allowed for this class in this term', { type: 'danger' })
        return
      }

      const duplicateTeacher = await findTeacherMapping()
      if (duplicateTeacher.length && (!editingId || duplicateTeacher[0].id !== editingId)) {
        showToast('Teacher already assigned for this class in this term', { type: 'danger' })
        return
      }

      const payload = {
        academic_year_id: formData.academic_year_id,
        class_section_id: formData.section_id,
        group_id: isHigherSec ? formData.group_id : null,
        term: isSecondary ? null : formData.term,
        staff_id: formData.staff_id
      }

      let resultError = null
      if (editingId) {
        const { error } = await supabase
          .from('class_teacher_mapping')
          .update(payload)
          .eq('id', editingId)
        resultError = error
      } else {
        const { error } = await supabase
          .from('class_teacher_mapping')
          .insert([payload])
        resultError = error
      }

      if (resultError) {
        if (resultError.code === '23505') {
          showToast('Duplicate mapping exists', { type: 'danger' })
        } else {
          console.error('Save error:', resultError)
          showToast(resultError.message || 'Failed to save', { type: 'danger' })
        }
        return
      }

      const successMessage = editingId
        ? 'Class teacher mapping updated successfully!'
        : 'Class teacher mapping saved successfully!'
      showToast(successMessage, { type: 'success' })

      resetForm()
      await loadMappings()
    } catch (err) {
      console.error('Submit error:', err)
      showToast('An error occurred', { type: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdShellAdmin brandTitle="CLASS TEACHER MAPPING">
      <div className="desktop-container admin-content" style={{ overflowX: 'hidden' }}>
        <h4 className="mb-4">Class Teacher Mapping</h4>
        
        {loading ? (
          <div className="text-center p-5">
            <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }} />
            <p className="text-muted">Loading school data...</p>
          </div>
        ) : (
          <div className="card card-soft p-4">
            <div className="students-section-shell-header mb-4">
              <h5 className="section-title mb-1" style={{ fontSize: '1.1rem' }}>
                Assign Class Teachers
              </h5>
              <p className="students-section-copy mb-0">
                Map staff to specific class-sections for the academic year. Prevents duplicate assignments.
              </p>
            </div>

            <form className="row g-3">
              {/* Academic Year */}
              <div className="col-md-4">
                <label className="form-label fw-bold mb-1">Academic Year <span className="text-danger">*</span></label>
                <select 
                  className="form-select" 
                  value={formData.academic_year_id}
                  onChange={e => setFormData({...formData, academic_year_id: e.target.value})}
                >
                  <option value="">Select Academic Year</option>
                  {academicYears.map(year => (
                    <option key={year.id} value={year.id}>{year.year_name}</option>
                  ))}
                </select>
              </div>

              {/* School Level */}
              <div className="col-md-3">
                <label className="form-label fw-bold mb-1">School Level <span className="text-danger">*</span></label>
                <select 
                  className="form-select"
                  value={formData.school_level}
                  onChange={e => handleSchoolLevelChange(e.target.value)}
                  disabled={!formData.academic_year_id}
                >
                  <option value="">Select Level</option>
                  <option value="Primary">Primary (Classes 1-5)</option>
                  <option value="Middle">Middle (Classes 6-9)</option>
                  <option value="Secondary">Secondary (Classes 10-12)</option>
                </select>
              </div>

              {/* Class */}
              <div className="col-md-3">
                <label className="form-label fw-bold mb-1">Class <span className="text-danger">*</span></label>
                <select 
                  className="form-select"
                  value={formData.class_id}
                  onChange={e => handleClassChange(e.target.value)}
                  disabled={!formData.school_level}
                >
                  <option value="">Select Class</option>
                  {filteredClasses.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.class_name}</option>
                  ))}
                </select>
              </div>

              {/* Group (only Class 11/12) */}
              {isHigherSec && (
                <div className="col-md-2">
                  <label className="form-label fw-bold mb-1">Group <span className="text-danger">*</span></label>
                  <select 
                    className="form-select"
                    value={formData.group_id}
                    onChange={e => handleGroupChange(e.target.value)}
                    disabled={!formData.class_id}
                  >
                    <option value="">Select Group</option>
                    {filteredGroups.map(group => (
                      <option key={group.id} value={group.id}>{group.group_name}</option>
                    ))}
                  </select>
                  <div className="text-muted small mt-1">For Class 11/12</div>
                </div>
              )}

              {/* Section */}
              <div className={`col-md-${isHigherSec ? '3' : '4'}`}>
                <label className="form-label fw-bold mb-1">Section <span className="text-danger">*</span></label>
                <select 
                  className="form-select"
                  value={formData.section_id}
                  onChange={e => handleSectionChange(e.target.value)}
                  disabled={!formData.class_id || (isHigherSec && !formData.group_id)}
                >
                  <option value="">Select Section</option>
                  {classSections.map((sec, index) => (
                    <option key={sec.id} value={sec.id}>{`A${index + 1}`}</option>
                  ))}
                </select>
              </div>

              {/* Term (Primary/Middle only) */}
              {isTermBased && formData.class_id && (
                <div className="col-md-3">
                  <label className="form-label fw-bold mb-1">Term <span className="text-danger">*</span></label>
                  <select 
                    className="form-select"
                    value={formData.term}
                    onChange={e => setFormData({...formData, term: e.target.value})}
                  >
                    <option value="">Select Term</option>
                    {TERMS.map(term => (
                      <option key={term} value={term}>{term}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Secondary: No Term */}
              {isSecondary && formData.class_id && (
                <div className="col-md-3">
                  <label className="form-label fw-bold mb-1">Term</label>
                  <div className="form-control bg-light text-muted fw-semibold text-center">Full Year</div>
                </div>
              )}

              {/* Staff */}
              <div className="col-md-4">
                <label className="form-label fw-bold mb-1">Class Teacher <span className="text-danger">*</span></label>
                <select 
                  className="form-select"
                  value={formData.staff_id}
                  onChange={e => setFormData({...formData, staff_id: e.target.value})}
                  disabled={!formData.section_id}
                >
                  <option value="">Select Class Teacher</option>
                  {availableStaffList
                      .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
                      .map(staff => (
                        <option key={staff.id} value={staff.id}>
                          {staff.full_name} ({staff.staff_id || 'N/A'})
                        </option>
                      ))}
                </select>
              </div>

              {/* Summary badges */}
              {(formData.school_level || formData.class_id || formData.section_id) && (
                <div className="col-12">
                  <div className="d-flex flex-wrap gap-2 mb-3">
                    {formData.academic_year_id && (
                      <span className="badge bg-primary bg-opacity-20 text-primary px-3 py-2">{
                        academicYears.find(y => y.id === formData.academic_year_id)?.year_name
                      }</span>
                    )}
                    {formData.school_level && (
                      <span className="badge bg-secondary bg-opacity-20 text-secondary px-3 py-2">
                        {formData.school_level}
                      </span>
                    )}
                    {selectedClass && (
                      <span className="badge bg-success bg-opacity-20 text-success px-3 py-2">
                        {selectedClass.class_name}
                      </span>
                    )}
                    {formData.group_id && (
                      <span className="badge bg-info bg-opacity-20 text-info px-3 py-2">{
                        groups.find(g => g.id === formData.group_id)?.group_name
                      }</span>
                    )}
                    {(() => {
                      const secIndex = classSections.findIndex(s => s.id === formData.section_id)
                      return secIndex >= 0 && (
                        <span className="badge bg-warning bg-opacity-20 text-warning px-3 py-2">{`A${secIndex + 1}`}</span>
                      )
                    })()}
                    {formData.term && (
                      <span className="badge bg-dark bg-opacity-20 text-light px-3 py-2">
                        {formData.term}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Submit */}
              <div className="col-12">
                <button 
                  type="button" 
                  className="btn btn-primary students-button px-5 fw-bold" 
                  onClick={handleSubmit}
                  disabled={saving || !formData.staff_id}
                >
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Saving...
                    </>
                  ) : (
                    editingId ? 'Update Class Teacher' : 'Assign Class Teacher'
                  )}
                </button>
                {editingId && (
                  <button
                    type="button"
                    className="btn btn-link text-decoration-none ms-3"
                    onClick={resetForm}
                    disabled={saving}
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {!loading && (
          <div className="card card-soft p-4 mt-4">
            <div className="students-section-shell-header mb-4">
              <h5 className="section-title mb-1" style={{ fontSize: '1.1rem' }}>
                Assigned Class Teachers
              </h5>
              <p className="students-section-copy mb-0">
                Review existing mappings. Edit to update or delete obsolete assignments.
              </p>
            </div>
            {classTeachers.length === 0 && (
              <p className="text-muted small mb-3">No class teachers assigned yet.</p>
            )}

            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr className="text-uppercase text-secondary" style={{ fontSize: '0.75rem' }}>
                    <th>Academic Year</th>
                    <th>Term</th>
                    <th>Class</th>
                    <th>Section</th>
                    <th>Class Teacher</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-4">
                        No class teacher assignments yet.
                      </td>
                    </tr>
                  ) : (
                    mappings.map(mapping => {
                      const className = mapping.class_sections?.classes?.class_name || 'Unknown Class'
                      const sectionName = mapping.class_sections?.sections?.section_name || 'Unknown'
                      const yearName = mapping.academic_years?.year_name || 'N/A'
                      const staffName = mapping.staff?.full_name || 'Staff'

                        return (
                        <tr key={mapping.id}>
                          <td>{yearName}</td>
                          <td>
                            <span className="term-badge">
                              {mapping.term || 'Full Year'}
                            </span>
                          </td>
                          <td>{className}</td>
                          <td>{sectionLabelMap[mapping.class_section_id] || sectionName}</td>
                          <td>{staffName}</td>
                          <td className="text-end">
                            <div className="d-flex justify-content-end gap-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary rounded-pill px-3"
                                onClick={() => handleEditMapping(mapping)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger rounded-pill px-3"
                                onClick={() => handleDeleteMapping(mapping.id)}
                              >
                                Delete
                              </button>
                            </div>
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
    </AdShellAdmin>
  )
}
