import { useEffect, useMemo, useState, useCallback } from 'react'
import AdShellAdmin from '../../components/AdShellAdmin'
import { supabase } from '../../../supabaseClient'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { useNavigate, useLocation } from 'react-router-dom'
import './Setup.css'
import './AdminContent.css'

// ============================================
// UTILITY FUNCTIONS
// ============================================

const FIXED_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

const LEVEL_RANGES = {
  Primary: { min: 1, max: 5 },
  Middle: { min: 6, max: 9 },
  Secondary: { min: 10, max: 12 },
}

const SLOT_TEMPLATE_6 = [
  { key: 'p1', label: 'PERIOD 1', start: '10:00:00', end: '10:40:00', periodNumber: 1 },
  { key: 'p2', label: 'PERIOD 2', start: '10:40:00', end: '11:20:00', periodNumber: 2 },
  { key: 'b1', label: 'BREAK', start: '11:20:00', end: '11:25:00', periodNumber: null },
  { key: 'p3', label: 'PERIOD 3', start: '11:25:00', end: '12:05:00', periodNumber: 3 },
  { key: 'p4', label: 'PERIOD 4', start: '12:05:00', end: '12:45:00', periodNumber: 4 },
  { key: 'l1', label: 'LUNCH', start: '12:45:00', end: '13:10:00', periodNumber: null },
  { key: 'p5', label: 'PERIOD 5', start: '13:10:00', end: '13:50:00', periodNumber: 5 },
  { key: 'p6', label: 'PERIOD 6', start: '13:50:00', end: '14:30:00', periodNumber: 6 },
]

const SLOT_TEMPLATE_8 = [
  { key: 'p1', label: 'PERIOD 1', start: '10:00:00', end: '10:40:00', periodNumber: 1 },
  { key: 'p2', label: 'PERIOD 2', start: '10:40:00', end: '11:20:00', periodNumber: 2 },
  { key: 'b1', label: 'BREAK', start: '11:20:00', end: '11:25:00', periodNumber: null },
  { key: 'p3', label: 'PERIOD 3', start: '11:25:00', end: '12:05:00', periodNumber: 3 },
  { key: 'p4', label: 'PERIOD 4', start: '12:05:00', end: '12:45:00', periodNumber: 4 },
  { key: 'l1', label: 'LUNCH', start: '12:45:00', end: '13:10:00', periodNumber: null },
  { key: 'p5', label: 'PERIOD 5', start: '13:10:00', end: '13:50:00', periodNumber: 5 },
  { key: 'p6', label: 'PERIOD 6', start: '13:50:00', end: '14:30:00', periodNumber: 6 },
  { key: 'b2', label: 'BREAK', start: '14:30:00', end: '14:35:00', periodNumber: null },
  { key: 'p7', label: 'PERIOD 7', start: '14:35:00', end: '15:15:00', periodNumber: 7 },
  { key: 'p8', label: 'PERIOD 8', start: '15:15:00', end: '15:55:00', periodNumber: 8 },
]

const formatTime = (timeStr) => {
  if (!timeStr) return ''
  const parts = timeStr.split(':')
  let hours = parseInt(parts[0], 10)
  const minutes = parts[1]
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  hours = hours ? hours : 12
  return `${hours}:${minutes} ${ampm}`
}

const getSlotTemplate = (classNumber) => {
  if (!classNumber) return SLOT_TEMPLATE_8
  return classNumber <= 9 ? SLOT_TEMPLATE_8 : SLOT_TEMPLATE_6
}

// ============================================
// VALIDATION HELPERS
// ============================================

const isValidUUID = (value) => {
  if (!value) return false
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(String(value))
}

const nullIfEmpty = (value) => {
  if (!value || value === '' || value === 'undefined' || value === 'NaN') return null
  return value
}

const createGridEntry = (subjectId, staffId) => ({
  subject_id: nullIfEmpty(subjectId),
  staff_id: nullIfEmpty(staffId),
})

// ============================================
// MAIN COMPONENT
// ============================================

export default function EditTimetable() {
  const navigate = useNavigate()
  const location = useLocation()

  // Get timetable data from navigation state
  const timetableState = location.state || {}
  const {
    academicYearId: initialAcademicYearId,
    classSectionId: initialClassSectionId,
    term: initialTerm,
    yearName: initialYearName,
    className: initialClassName,
    sectionName: initialSectionName,
    classNumber: initialClassNumber
  } = timetableState

  // If no state, go back to list
  useEffect(() => {
    if (!initialAcademicYearId || !initialClassSectionId) {
      toast.error('Invalid timetable data')
      navigate('/admin/timetable/list')
    }
  }, [initialAcademicYearId, initialClassSectionId, navigate])

  // ---------- Base data ----------
  const [subjects, setSubjects] = useState([])
  const [subjectStaffMap, setSubjectStaffMap] = useState({})
  const [staffList, setStaffList] = useState([])
  const [classTeachers, setClassTeachers] = useState([])
  const [classTeacherSubjectMap, setClassTeacherSubjectMap] = useState({})
  const [periodIdBySlot, setPeriodIdBySlot] = useState({})

  // ---------- Grid & UI state ----------
  const [grid, setGrid] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // ---------- Derived values ----------
  const selectedClassNumber = Number(initialClassNumber || 0)
  const classBand = selectedClassNumber >= 10 ? '10-12' : '1-9'
  const isSecondary = selectedClassNumber >= 10
  const termNumber = initialTerm

  const slots = useMemo(() => getSlotTemplate(selectedClassNumber), [selectedClassNumber])
  const classSlots = useMemo(() => slots.filter(s => s.periodNumber !== null), [slots])

  const selectionComplete = useMemo(() => {
    return isValidUUID(initialAcademicYearId) && 
           isValidUUID(initialClassSectionId) && 
           termNumber !== undefined
  }, [initialAcademicYearId, initialClassSectionId, termNumber])

  // ============================================
  // LOAD DATA
  // ============================================
  useEffect(() => {
    if (!selectionComplete) return

    const loadData = async () => {
      try {
        setLoading(true)

        // Load subjects for this class
        const { data: classSubjectRows, error: classSubjectError } = await supabase
          .from('class_subjects')
          .select('subject_id, subjects (id, subject_title, subject_code)')
          .eq('class_id', timetableState.classId || null)

        if (classSubjectError) throw classSubjectError

        const nextSubjects = (classSubjectRows || [])
          .map((row) => {
            const s = row.subjects
            if (!s?.id) return null
            return {
              subject_id: s.id,
              subject_name: s.subject_title,
              subject_code: s.subject_code,
            }
          })
          .filter(Boolean)
          .sort((a, b) => String(a.subject_name || '').localeCompare(String(b.subject_name || '')))

        setSubjects(nextSubjects)

        // Load staff-subject mapping
        const { data: mappingRows, error: mappingError } = await supabase
          .from('staff_subjects')
          .select('subject_id, staff_id')

        if (mappingError) throw mappingError

        const nextStaffMap = {}
        ;(mappingRows || []).forEach(row => {
          if (row.subject_id && row.staff_id) {
            const list = nextStaffMap[row.subject_id] || []
            list.push(row.staff_id)
            nextStaffMap[row.subject_id] = list
          }
        })
        setSubjectStaffMap(nextStaffMap)

        // Load staff list
        const { data: staffRows, error: staffError } = await supabase
          .from('staff')
          .select('id, full_name')

        if (staffError) throw staffError
        setStaffList(staffRows || [])

        // Load class teachers
        const { data: classTeacherRows, error: classTeacherError } = await supabase
          .from('class_teacher_mapping')
          .select('staff_id, staff (full_name)')
          .eq('class_section_id', initialClassSectionId)
          .eq('academic_year_id', initialAcademicYearId)

        if (classTeacherError) throw classTeacherError

        const normalizedTeachers = (classTeacherRows || []).map(row => ({
          staff_id: row.staff_id,
          staff_name: row.staff?.full_name || 'Teacher ' + row.staff_id
        }))
        setClassTeachers(normalizedTeachers)

        // Load teacher subjects
        const teacherIds = normalizedTeachers.map(t => t.staff_id).filter(Boolean)
        let teacherSubjectsData = []
        
        if (teacherIds.length) {
          const { data: teacherSubjects, error: teacherSubjectsError } = await supabase
            .from('staff_subjects')
            .select('staff_id, subject_id, subjects (subject_title, subject_code)')
            .in('staff_id', teacherIds)

          if (teacherSubjectsError) throw teacherSubjectsError
          teacherSubjectsData = teacherSubjects || []
        }

        const nextTeacherMap = {}
        teacherSubjectsData.forEach(item => {
          const key = String(item.staff_id)
          const list = nextTeacherMap[key] || []
          list.push({
            subject_id: item.subject_id,
            subject_title: item.subjects?.subject_title || '',
            subject_code: item.subjects?.subject_code || ''
          })
          nextTeacherMap[key] = list
        })

        normalizedTeachers.forEach(row => {
          const key = String(row.staff_id)
          if (!nextTeacherMap[key]) nextTeacherMap[key] = []
        })

        setClassTeacherSubjectMap(nextTeacherMap)

        // Load periods with class_band filter
        const { data: periodRows, error: periodError } = await supabase
          .from('periods')
          .select('id, period_number')
          .eq('class_band', classBand)
          .order('period_number', { ascending: true })

        if (periodError) {
          console.warn('Periods query error:', periodError)
        }

        const slotToPeriodId = {}
        const periodIdToSlot = {}

        if (periodRows && periodRows.length > 0) {
          (periodRows || []).forEach(period => {
            if (!period?.id || !period.period_number) return
            const slotKey = 'p' + period.period_number
            slotToPeriodId[slotKey] = period.id
            periodIdToSlot[String(period.id)] = slotKey
          })
        }

        setPeriodIdBySlot(slotToPeriodId)

        // Load existing timetable
        const { data: existingRows, error: existingError } = await supabase
          .from('timetable_sessions')
          .select('day_of_week, period_id, subject_id, staff_id')
          .eq('academic_year_id', initialAcademicYearId)
          .eq('class_section_id', initialClassSectionId)
          .eq('term', termNumber)

        if (existingError) throw existingError

        // Build grid with existing data
        const nextGrid = {}
        FIXED_DAYS.forEach(day => { nextGrid[day] = {} })

        ;(existingRows || []).forEach(row => {
          const slotKey = periodIdToSlot[String(row.period_id)]
          if (!row.day_of_week || !slotKey) return
          if (!nextGrid[row.day_of_week]) nextGrid[row.day_of_week] = {}
          nextGrid[row.day_of_week][slotKey] = createGridEntry(row.subject_id, row.staff_id)
        })

        // Apply default class teacher to period 1 if no data exists
        const defaultTeacher = normalizedTeachers[0]
        if (defaultTeacher) {
          const defaultSubjects = nextTeacherMap[String(defaultTeacher.staff_id)] || []
          FIXED_DAYS.forEach(day => {
            if (!nextGrid[day].p1) {
              nextGrid[day] = {
                ...nextGrid[day],
                p1: createGridEntry(
                  defaultSubjects[0]?.subject_id || null,
                  defaultTeacher.staff_id
                )
              }
            }
          })
        }

        setGrid(nextGrid)
      } catch (error) {
        console.error('Error loading data:', error)
        toast.error('Failed to load timetable data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [selectionComplete, classBand, termNumber, initialAcademicYearId, initialClassSectionId, timetableState.classId])

  // ============================================
  // EVENT HANDLERS
  // ============================================

  const handleCellChange = useCallback((day, key, subjectId) => {
    if (key === 'p1') return
    setGrid(prev => {
      const dayGrid = { ...(prev[day] || {}) }
      dayGrid[key] = createGridEntry(subjectId, dayGrid[key]?.staff_id || null)
      return { ...prev, [day]: dayGrid }
    })
  }, [])

  const handleCellStaffChange = useCallback((day, key, staffId) => {
    setGrid(prev => {
      const dayGrid = { ...(prev[day] || {}) }
      const current = dayGrid[key] || {}
      if (!current.subject_id) return prev
      dayGrid[key] = createGridEntry(current.subject_id, staffId)
      return { ...prev, [day]: dayGrid }
    })
  }, [])

  const handlePeriod1TeacherChange = useCallback((day, teacherId) => {
    const teacherIdValue = nullIfEmpty(teacherId)
    setGrid(prev => {
      const dayGrid = { ...(prev[day] || {}) }
      if (!teacherIdValue) {
        dayGrid.p1 = createGridEntry(null, null)
      } else {
        const subjects = classTeacherSubjectMap[String(teacherIdValue)] || []
        dayGrid.p1 = createGridEntry(
          subjects[0]?.subject_id || null,
          teacherIdValue
        )
      }
      return { ...prev, [day]: dayGrid }
    })
  }, [classTeacherSubjectMap])

  const handlePeriod1SubjectChange = useCallback((day, teacherId, subjectId) => {
    const teacherIdValue = nullIfEmpty(teacherId)
    const subjectIdValue = nullIfEmpty(subjectId)
    if (!teacherIdValue) return
    setGrid(prev => ({
      ...prev,
      [day]: {
        ...(prev[day] || {}),
        p1: createGridEntry(subjectIdValue, teacherIdValue)
      }
    }))
  }, [])

  const getStaffName = (staffId) => {
    if (!staffId) return null
    const staff = staffList.find(s => String(s.id) === String(staffId))
    return staff ? staff.full_name : `Staff ${staffId}`
  }

  // ============================================
  // GRID COMPLETENESS CHECK
  // ============================================
  const isGridComplete = useMemo(() => {
    if (!selectionComplete) return false
    for (const day of FIXED_DAYS) {
      for (const slot of classSlots) {
        const entry = grid[day]?.[slot.key]
        if (slot.key !== 'p1') {
          if (!entry?.subject_id || !entry?.staff_id) return false
        }
      }
    }
    return true
  }, [selectionComplete, classSlots, grid])

  // ============================================
  // UPDATE TIMETABLE
  // ============================================
  const updateTimetable = async () => {
    if (!selectionComplete) {
      toast.warning('Invalid timetable data')
      return
    }

    setSaving(true)
    try {
      const subjectById = subjects.reduce((acc, s) => { acc[s.subject_id] = s; return acc }, {})
      const timetableData = []

      for (const day of FIXED_DAYS) {
        for (const slot of classSlots) {
          const entry = grid[day]?.[slot.key] || {}
          let subjectId = nullIfEmpty(entry.subject_id)
          let staffId = nullIfEmpty(entry.staff_id)

          if (slot.key !== 'p1') {
            if (!subjectId) {
              throw new Error('All class periods must have a subject assigned before saving.')
            }
            if (!staffId) {
              const subjectName = subjectById[subjectId]?.subject_name || 'Selected subject'
              throw new Error(`${subjectName} must have a staff member selected.`)
            }
          }

          const periodId = periodIdBySlot[slot.key]
          if (!periodId) {
            throw new Error(`Missing period identifier for ${slot.label}.`)
          }

          if (subjectId && staffId) {
            timetableData.push({
              day,
              subject_id: subjectId,
              staff_id: staffId,
              period_id: periodId
            })
          }
        }
      }

      // Create payload
      const payload = timetableData
        .map(item => ({
          academic_year_id: initialAcademicYearId,
          class_section_id: initialClassSectionId,
          subject_id: nullIfEmpty(item.subject_id),
          staff_id: nullIfEmpty(item.staff_id),
          period_id: nullIfEmpty(item.period_id),
          day_of_week: item.day,
          term: Number(termNumber),
        }))
        .filter(row => 
          isValidUUID(row.subject_id) && 
          isValidUUID(row.staff_id) && 
          isValidUUID(row.period_id)
        )

      if (!payload.length) {
        toast.warning('No valid timetable entries to save.')
        return
      }

      console.log('FINAL PAYLOAD', payload)

      // Delete existing
      const { error: deleteError } = await supabase
        .from('timetable_sessions')
        .delete()
        .eq('academic_year_id', initialAcademicYearId)
        .eq('class_section_id', initialClassSectionId)
        .eq('term', termNumber)

      if (deleteError) throw deleteError

      // Insert new
      const { data: inserted, error: insertError } = await supabase
        .from('timetable_sessions')
        .insert(payload)

      if (insertError) {
        console.error('Insert error:', insertError)
        throw insertError
      }

      console.log('Timetable updated successfully', inserted)
      toast.success('Timetable updated successfully')
      
      // Navigate back to list
      setTimeout(() => {
        navigate('/admin/timetable/list')
      }, 1500)
    } catch (error) {
      console.error('Error updating timetable:', error)
      toast.error(error.message || 'Failed to update timetable')
    } finally {
      setSaving(false)
    }
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <AdShellAdmin
      brandTitle="ADMIN PORTAL"
      footerTitle="Admin Management Studio"
      footerSubtitle="Crafted for Jazz Public School"
    >
      <div className="desktop-container" style={{ overflowX: 'hidden' }}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h4 className="mb-1">Edit Timetable</h4>
            <p className="text-muted mb-0">
              {initialClassName} - {initialSectionName} ({initialYearName})
              {isSecondary ? ' - Full Year' : ` - Term ${termNumber}`}
            </p>
          </div>
          <div>
            <button 
              className="btn btn-secondary me-2"
              onClick={() => navigate('/admin/timetable/list')}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary px-4"
              onClick={updateTimetable}
              disabled={saving || loading || !isGridComplete}
            >
              {saving ? 'Updating...' : 'Update Timetable'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="card card-soft p-5 text-center">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3">Loading timetable data...</p>
          </div>
        ) : (
          <div className="card card-soft p-4">
            <div className="table-responsive">
              <table className="timetable-table">
                <thead>
                  <tr>
                    <th style={{ width: '120px' }}>DAY</th>
                    {slots.map(slot => (
                      <th key={slot.key}>
                        <div className="fw-bold">{slot.label}</div>
                        <div className="text-muted small" style={{ fontWeight: 'normal', fontSize: '0.7rem' }}>
                          {formatTime(slot.start)} – {formatTime(slot.end)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FIXED_DAYS.map(day => (
                    <tr key={day}>
                      <td className="day-name">{day}</td>
                      {slots.map(slot => {
                        const isPeriodOne = slot.key === 'p1'
                        const isClassSlot = slot.periodNumber !== null
                        
                        if (isClassSlot) {
                          const period1Entry = grid[day]?.p1 || {}
                          const cellEntry = isPeriodOne
                            ? period1Entry
                            : (grid[day]?.[slot.key] || {})
                          
                          const selectedTeacherId = period1Entry.staff_id || (classTeachers[0]?.staff_id || null)
                          const selectedSubjectId = cellEntry.subject_id || null
                          const selectedStaffId = cellEntry.staff_id || null
                          const teacherSubjects = selectedTeacherId ? classTeacherSubjectMap[String(selectedTeacherId)] || [] : []
                          const selectedTeacher = classTeachers.find(t => String(t.staff_id) === String(selectedTeacherId))
                          const staffName = isPeriodOne
                            ? selectedTeacher?.staff_name
                            : (selectedStaffId ? getStaffName(selectedStaffId) : null)
                          
                          return (
                            <td key={`${day}-${slot.key}`} className="slot-cell">
                              {isPeriodOne ? (
                                <>
                                  <select
                                    className="form-select form-select-sm mb-1"
                                    value={selectedTeacherId || ''}
                                    onChange={e => handlePeriod1TeacherChange(day, e.target.value)}
                                    style={{ fontSize: '0.78rem' }}
                                    disabled={!classTeachers.length}
                                  >
                                    <option value="">{classTeachers.length ? '-- Select Teacher --' : 'No class teacher assigned'}</option>
                                    {classTeachers.map(teacher => (
                                      <option key={teacher.staff_id} value={teacher.staff_id}>
                                        {teacher.staff_name}
                                      </option>
                                    ))}
                                  </select>
                                  <select
                                    className="form-select form-select-sm mb-1"
                                    value={selectedSubjectId || ''}
                                    onChange={e => handlePeriod1SubjectChange(day, selectedTeacherId, e.target.value)}
                                    style={{ fontSize: '0.78rem' }}
                                    disabled={!selectedTeacherId || !teacherSubjects.length}
                                  >
                                    <option value="">
                                      {teacherSubjects.length ? '-- Select Subject --' : 'No subjects mapped yet'}
                                    </option>
                                    {teacherSubjects.map(sub => (
                                      <option key={`${selectedTeacherId}-${sub.subject_id}`} value={sub.subject_id}>
                                        {sub.subject_code ? `${sub.subject_code} – ` : ''}{sub.subject_title}
                                      </option>
                                    ))}
                                  </select>
                                  <div className="text-warning small">
                                    🔒 Period 1 reserved for class teachers
                                  </div>
                                </>
                              ) : (
                                <>
                                  <select
                                    className="form-select form-select-sm mb-1"
                                    value={selectedSubjectId || ''}
                                    onChange={e => handleCellChange(day, slot.key, e.target.value)}
                                    style={{ fontSize: '0.78rem' }}
                                  >
                                    <option value="">-- Subject --</option>
                                    {subjects.map(s => (
                                      <option key={s.subject_id} value={s.subject_id}>
                                        {s.subject_code ? `${s.subject_code} – ` : ''}{s.subject_name}
                                      </option>
                                    ))}
                                  </select>
                                  <select
                                    className="form-select form-select-sm mb-1"
                                    value={selectedStaffId || ''}
                                    onChange={e => handleCellStaffChange(day, slot.key, e.target.value)}
                                    style={{ fontSize: '0.78rem' }}
                                    disabled={!selectedSubjectId}
                                  >
                                    <option value="">-- Staff --</option>
                                    {(subjectStaffMap[selectedSubjectId] || []).map(staffId => {
                                      const staff = staffList.find(s => String(s.id) === String(staffId))
                                      const label = staff ? staff.full_name : `Staff ${staffId}`
                                      return (
                                        <option key={`${slot.key}-${staffId}`} value={staffId}>
                                          {label}
                                        </option>
                                      )
                                    })}
                                  </select>
                                  {!selectedSubjectId && (
                                    <div className="text-muted small" style={{ fontSize: '0.65rem' }}>
                                      Select a subject
                                    </div>
                                  )}
                                </>
                              )}
                              {staffName && (
                                <div className="staff-info">
                                  <i className="bi bi-person-fill me-1"></i>{staffName}
                                </div>
                              )}
                            </td>
                          )
                        }

                        return (
                          <td
                            key={`${day}-${slot.key}`}
                            className={slot.key.startsWith('b') ? 'break-cell' : 'lunch-cell'}
                          >
                            {(() => {
                              const dayIndex = FIXED_DAYS.indexOf(day)
                              const word = slot.key.startsWith('b') ? 'BREAK' : 'LUNCH'
                              return word[dayIndex]
                            })()}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              <style dangerouslySetInnerHTML={{
                __html: `
                .timetable-table {
                  width: 100%;
                  border-collapse: collapse;
                  border: 1px solid #ccc;
                  text-align: center;
                }
                .timetable-table th, .timetable-table td {
                  border: 1px solid #ccc;
                  padding: 8px;
                  vertical-align: middle;
                }
                .timetable-table thead th {
                  background-color: #f2f2f2;
                  text-transform: uppercase;
                  font-size: 0.85rem;
                }
                .day-name {
                  font-weight: bold;
                  background-color: #f9f9f9;
                }
                .slot-cell {
                  min-width: 140px;
                }
                .break-cell {
                  background-color: #fffde7;
                  font-weight: bold;
                  color: #f57f17;
                }
                .lunch-cell {
                  background-color: #e3f2fd;
                  font-weight: bold;
                  color: #1976d2;
                }
                .staff-info {
                  font-size: 0.68rem;
                  color: #555;
                  line-height: 1.2;
                }
              `}} />
            </div>
          </div>
        )}
      </div>
      <ToastContainer position="top-right" autoClose={3000} />
    </AdShellAdmin>
  )
}
