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
  const [sections, setSections] = useState([])
  const [staffList, setStaffList] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState(EMPTY_FORM)

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

  // Load all initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const [ayRes, clsRes, grpRes, staffRes] = await Promise.all([
          supabase.from('academic_years').select('id, year_name').order('year_name'),
          supabase.from('classes').select('id, class_name, class_number, school_level').order('class_number'),
          supabase.from('groups').select('id, group_name, class_id').order('group_name'),
          supabase.from('staff').select('id, full_name').order('full_name')
        ])

        setAcademicYears(ayRes.data || [])
        setClasses(clsRes.data || [])
        setGroups(grpRes.data || [])
        setStaffList(staffRes.data || [])
      } catch (err) {
        console.error('Load error:', err)
        showToast('Failed to load data', { type: 'danger' })
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Load sections when class/group changes (EXACT spec)
  useEffect(() => {
    // Safety check: return early if no class selected
    if (!formData.class_id) {
      setSections([])
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
            sections!class_sections_section_id_fkey (
              id,
              section_name
            )
          `)
          .eq('class_id', formData.class_id)

        // For Class 11/12: filter by group_id if selected
        // For classes below 11: filter by group_id = null
        if (isHigherSec && formData.group_id) {
          query = query.eq('group_id', formData.group_id)
        } else {
          query = query.is('group_id', null)
        }

        const { data, error } = await query
        if (error) throw error
        
        // Sort in frontend after fetching
        const sortedData = (data || []).sort((a, b) => 
          (a.sections?.section_name || '').localeCompare(b.sections?.section_name || '')
        )
        
        setSections(sortedData.map(row => ({
          id: row.id,
          section_id: row.section_id,
          section_name: row.sections?.section_name || 'Unknown'
        })))
        setFormData(prev => ({ ...prev, section_id: '' }))
      } catch (err) {
        console.error('Sections load error:', err)
        showToast('Failed to load sections', { type: 'warning' })
        setSections([])
      }
    }

    loadSections()
  }, [formData.class_id, formData.group_id, isHigherSec])

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
  }

  const handleClassChange = (classId) => {
    setFormData({
      ...formData,
      class_id: classId,
      group_id: '',
      section_id: '',
      term: ''
    })
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

  // Check for duplicates BEFORE insert
  const checkDuplicate = async () => {
    const { academic_year_id, section_id, term } = formData
    const query = supabase
      .from('class_teacher_mapping')
      .select('id', { count: 'exact', head: true })
      .eq('academic_year_id', academic_year_id)
      .eq('class_section_id', section_id)
    
    if (term && term !== 'Full Year') {
      query.eq('term', term)
    }

    const { count, error } = await query
    if (error) throw error
    return (count || 0) === 0
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
      // 1. Check duplicate
      const isUnique = await checkDuplicate()
      if (!isUnique) {
        showToast('Class teacher already assigned for this section', { type: 'danger' })
        return
      }

      // 2. Prepare payload (exact spec)
      const payload = {
        academic_year_id: formData.academic_year_id,
        class_section_id: formData.section_id,
        group_id: isHigherSec ? formData.group_id : null,
        term: isSecondary ? null : formData.term,
        staff_id: formData.staff_id
      }

      const { error } = await supabase
        .from('class_teacher_mapping')
        .insert([payload])

      if (error) {
        // Handle unique constraint
        if (error.code === '23505') {
          showToast('Duplicate mapping exists', { type: 'danger' })
        } else {
          console.error('Insert error:', error)
          showToast(error.message || 'Failed to save', { type: 'danger' })
        }
        return
      }

      showToast('Class teacher mapping saved successfully!', { type: 'success' })
      
      // Reset form
      setFormData(EMPTY_FORM)
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
                    onChange={e => setFormData({...formData, group_id: e.target.value})}
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
                  onChange={e => setFormData({...formData, section_id: e.target.value})}
                  disabled={!formData.class_id || (isHigherSec && !formData.group_id)}
                >
                  <option value="">Select Section</option>
                  {sections.map((sec, index) => (
                    <option key={sec.id} value={sec.section_id}>{"A" + (index + 1)}</option>
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
                  {staffList.map(staff => (
                    <option key={staff.id} value={staff.id}>{staff.full_name}</option>
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
                      const selectedSec = sections.find(s => s.section_id === formData.section_id)
                      const secIndex = sections.findIndex(s => s.section_id === formData.section_id)
                      return selectedSec && (
                        <span className="badge bg-warning bg-opacity-20 text-warning px-3 py-2">{"A" + (secIndex + 1)}</span>
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
                    'Assign Class Teacher'
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </AdShellAdmin>
  )
}
