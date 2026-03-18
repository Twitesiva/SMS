import { useEffect, useMemo, useState } from 'react'
import AdShellAdmin from '../../components/AdShellAdmin'
import { supabase } from '../../../supabaseClient'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { useAuth } from '../../store/auth'
import './Setup.css'
import './AdminContent.css'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

const LEVEL_RANGES = {
  Primary: { min: 1, max: 5 },
  Middle: { min: 6, max: 9 },
  Secondary: { min: 10, max: 12 },
}

const SLOT_TEMPLATE_6 = [
  { key: 'p1', label: 'PERIOD 1', start: '10:00:00', end: '10:40:00', periodNumber: 1, periodType: 'class' },
  { key: 'p2', label: 'PERIOD 2', start: '10:40:00', end: '11:20:00', periodNumber: 2, periodType: 'class' },
  { key: 'b1', label: 'BREAK', start: '11:20:00', end: '11:25:00', periodNumber: null, periodType: 'break' },
  { key: 'p3', label: 'PERIOD 3', start: '11:25:00', end: '12:05:00', periodNumber: 3, periodType: 'class' },
  { key: 'p4', label: 'PERIOD 4', start: '12:05:00', end: '12:45:00', periodNumber: 4, periodType: 'class' },
  { key: 'l1', label: 'LUNCH', start: '12:45:00', end: '13:10:00', periodNumber: null, periodType: 'lunch' },
  { key: 'p5', label: 'PERIOD 5', start: '13:10:00', end: '13:50:00', periodNumber: 5, periodType: 'class' },
  { key: 'p6', label: 'PERIOD 6', start: '13:50:00', end: '14:30:00', periodNumber: 6, periodType: 'class' },
]

const SLOT_TEMPLATE_8 = [
  { key: 'p1', label: 'PERIOD 1', start: '10:00:00', end: '10:40:00', periodNumber: 1, periodType: 'class' },
  { key: 'p2', label: 'PERIOD 2', start: '10:40:00', end: '11:20:00', periodNumber: 2, periodType: 'class' },
  { key: 'b1', label: 'BREAK', start: '11:20:00', end: '11:25:00', periodNumber: null, periodType: 'break' },
  { key: 'p3', label: 'PERIOD 3', start: '11:25:00', end: '12:05:00', periodNumber: 3, periodType: 'class' },
  { key: 'p4', label: 'PERIOD 4', start: '12:05:00', end: '12:45:00', periodNumber: 4, periodType: 'class' },
  { key: 'l1', label: 'LUNCH', start: '12:45:00', end: '13:10:00', periodNumber: null, periodType: 'lunch' },
  { key: 'p5', label: 'PERIOD 5', start: '13:10:00', end: '13:50:00', periodNumber: 5, periodType: 'class' },
  { key: 'p6', label: 'PERIOD 6', start: '13:50:00', end: '14:30:00', periodNumber: 6, periodType: 'class' },
  { key: 'b2', label: 'BREAK', start: '14:30:00', end: '14:35:00', periodNumber: null, periodType: 'break' },
  { key: 'p7', label: 'PERIOD 7', start: '14:35:00', end: '15:15:00', periodNumber: 7, periodType: 'class' },
  { key: 'p8', label: 'PERIOD 8', start: '15:15:00', end: '15:55:00', periodNumber: 8, periodType: 'class' },
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
  if (!classNumber) return SLOT_TEMPLATE_8 // Default to 8
  return classNumber <= 9 ? SLOT_TEMPLATE_8 : SLOT_TEMPLATE_6
}

const applyClassTeacherSubjectToGrid = (baseGrid, defaultEntry) => {
  const nextGrid = {}
  DAYS.forEach(day => {
    const currentDay = { ...(baseGrid[day] || {}) }
    if (defaultEntry && defaultEntry.staff_id) {
      if (!currentDay.p1?.subject_id) {
        currentDay.p1 = { ...defaultEntry }
      }
    } else if (!defaultEntry && currentDay.p1) {
      delete currentDay.p1
    }
    nextGrid[day] = currentDay
  })
  return nextGrid
}

export default function ClassTimeTable() {
  const { user } = useAuth()
  const isAdmin = String(user?.role || '').toUpperCase() === 'ADMIN'

  // ─── Base data ────────────────────────────────────────────────────────
  const [academicYears, setAcademicYears] = useState([])
  const [allClasses, setAllClasses] = useState([])
  const [allGroups, setAllGroups] = useState([])
  const [classSections, setClassSections] = useState([])
  const [subjects, setSubjects] = useState([])
  const [subjectStaffMap, setSubjectStaffMap] = useState({})
  const [staffList, setStaffList] = useState([])
  const [classTeachers, setClassTeachers] = useState([])
  const [classTeacherSubjectMap, setClassTeacherSubjectMap] = useState({})

  // ─── Selection state ──────────────────────────────────────────────────
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState('')
  const [selectedSchoolLevel, setSelectedSchoolLevel] = useState('')
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [selectedSectionId, setSelectedSectionId] = useState('')
  const [selectedTerm, setSelectedTerm] = useState('')

  // ─── Grid & UI state ──────────────────────────────────────────────────
  const [grid, setGrid] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // ─── Derived values ───────────────────────────────────────────────────
  const selectedClassObj = useMemo(
    () => allClasses.find(c => String(c.id) === String(selectedClassId)),
    [allClasses, selectedClassId]
  )
  const selectedClassNumber = selectedClassObj
    ? Number(selectedClassObj.class_number || 0)
    : 0

  const isSecondary = selectedSchoolLevel === 'Secondary'
  const isHigherSec = selectedClassNumber === 11 || selectedClassNumber === 12
  const showGroupDropdown = isHigherSec
  const showTermDropdown = !isSecondary && selectedSchoolLevel !== ''

  const filteredClasses = useMemo(() => {
    if (!selectedSchoolLevel) return []
    const range = LEVEL_RANGES[selectedSchoolLevel]
    if (!range) return allClasses
    return allClasses.filter(c => {
      const num = Number(c.class_number || 0)
      return num >= range.min && num <= range.max
    })
  }, [allClasses, selectedSchoolLevel])

  const filteredGroups = useMemo(
    () => allGroups.filter(g => String(g.class_id) === String(selectedClassId)),
    [allGroups, selectedClassId]
  )

  const slots = useMemo(() => getSlotTemplate(selectedClassNumber), [selectedClassNumber])
  const classSlots = useMemo(() => slots.filter(s => s.periodType === 'class'), [slots])

  // Determine if all required fields are selected
  const selectionComplete = useMemo(() => {
    if (!selectedAcademicYearId || !selectedSchoolLevel || !selectedClassId || !selectedSectionId) return false
    if (isHigherSec && !selectedGroupId) return false
    if (showTermDropdown && !selectedTerm) return false
    return true
  }, [selectedAcademicYearId, selectedSchoolLevel, selectedClassId, selectedSectionId, selectedGroupId, selectedTerm, isHigherSec, showTermDropdown])


  // ─── Load initial data ────────────────────────────────────────────────
  useEffect(() => {
    const loadInitial = async () => {
      try {
        setLoading(true)
        const [yearRes, classRes, groupRes, staffRes] = await Promise.all([
          supabase.from('academic_years').select('id, year_name').order('year_name'),
          supabase.from('classes').select('id, class_name, class_number, school_level, category_id').order('class_number', { ascending: true }),
          supabase.from('groups').select('id, group_name, class_id').order('group_name'),
          supabase.from('staff').select('id, full_name'),
        ])

        if (yearRes.error) throw yearRes.error
        if (classRes.error) throw classRes.error
        if (groupRes.error) throw groupRes.error
        if (staffRes.error) throw staffRes.error

        setAcademicYears(yearRes.data || [])
        setAllClasses(classRes.data || [])
        setAllGroups(groupRes.data || [])
        setStaffList(staffRes.data || [])
      } catch (error) {
        console.error('Error loading initial data:', error)
        toast.error('Failed to load initial data')
      } finally {
        setLoading(false)
      }
    }

    loadInitial()
  }, [])

  // ─── Load sections when class or group changes ──────────────────────────
  useEffect(() => {
    // Safety check: return early if no class selected
    if (!selectedClassId) {
      setClassSections([])
      setSelectedSectionId('')
      return
    }

    // For Class 11 & 12, wait for group selection to avoid duplicate sections
    if (isHigherSec && !selectedGroupId) {
      setClassSections([])
      setSelectedSectionId('')
      return
    }

    const loadSections = async () => {
      try {
        // Validate selectedClassId before querying
        if (!selectedClassId || selectedClassId === 'NaN' || selectedClassId === 'undefined') {
          setClassSections([])
          return
        }

        let query = supabase
          .from('class_sections')
          .select('id, class_id, section_id, sections(id, section_name, group_id)')
          .eq('class_id', selectedClassId)

        // For Class 11/12: filter by group_id if selected
        // For classes below 11: filter by group_id = null
        if (isHigherSec && selectedGroupId) {
          query = query.eq('group_id', selectedGroupId)
        } else {
          // For classes below 11, group_id should be null
          query = query.is('group_id', null)
        }

        const { data, error } = await query.order('id')

        if (error) throw error

        setClassSections((data || []).map(row => ({
          id: row.id,
          class_id: row.class_id,
          section_id: row.section_id,
          section_name: row.sections?.section_name || '',
          group_id: row.sections?.group_id || null,
        })))
      } catch (error) {
        console.error('Error loading sections:', error)
        toast.error('Failed to load sections')
      }
    }

    loadSections()
  }, [selectedClassId, selectedGroupId, isHigherSec])

  // ─── Load subjects + staff map + existing grid when selection is complete ──
  useEffect(() => {
    if (!selectionComplete) {
      setSubjects([])
      setSubjectStaffMap({})
      setGrid({})
      setClassTeachers([])
      setClassTeacherSubjectMap({})
      return
    }

    const loadSubjectsAndGrid = async () => {
      try {
        setLoading(true)

        let classSubjectsQuery = supabase
          .from('class_subjects')
          .select('subject_id, subjects (id, subject_title, subject_code, subject_categories!subjects_category_id_fkey(category_name))')
          .eq('class_id', selectedClassId)

        if (isHigherSec) {
          if (selectedGroupId) classSubjectsQuery = classSubjectsQuery.eq('group_id', selectedGroupId)
          else classSubjectsQuery = classSubjectsQuery.is('group_id', null)
        } else {
          classSubjectsQuery = classSubjectsQuery.is('group_id', null)
        }

        const [{ data: classSubjectRows, error: classSubjectError }, { data: mappingRows, error: mappingError }] = await Promise.all([
          classSubjectsQuery,
          supabase.from('staff_subjects').select('subject_id, staff_id'),
        ])

        if (classSubjectError) throw classSubjectError
        if (mappingError) throw mappingError

        const nextSubjects = (classSubjectRows || [])
          .map((row) => {
            const s = row.subjects
            if (!s?.id) return null
            return {
              subject_id: s.id,
              subject_name: s.subject_title,
              subject_code: s.subject_code,
              subject_type: s.subject_categories?.category_name || '',
            }
          })
          .filter(Boolean)
          .sort((a, b) => String(a.subject_name || '').localeCompare(String(b.subject_name || '')))

        setSubjects(nextSubjects)

        // Build subject → staff mapping
        const nextStaffMap = {}
          ; (mappingRows || []).forEach(row => {
            if (row.subject_id && row.staff_id) {
              nextStaffMap[row.subject_id] = row.staff_id
            }
          })
        setSubjectStaffMap(nextStaffMap)

        const { data: classTeacherRows, error: classTeacherError } = await supabase
          .from('class_teacher_mapping')
          .select('staff_id, staff (full_name)')
          .eq('class_section_id', selectedSectionId)
          .eq('academic_year_id', selectedAcademicYearId)

        if (classTeacherError) throw classTeacherError

        const normalizedTeachers = (classTeacherRows || []).map(row => ({
          staff_id: row.staff_id,
          staff_name: row.staff?.full_name || `Teacher ${row.staff_id}`
        }))

        setClassTeachers(normalizedTeachers)

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

        const defaultTeacher = normalizedTeachers[0]
        const defaultEntry = defaultTeacher ? {
          staff_id: defaultTeacher.staff_id,
          subject_id: nextTeacherMap[String(defaultTeacher.staff_id)]?.[0]?.subject_id || ''
        } : null

        // Load existing timetable data
        const termValue = isSecondary ? 0 : Number(String(selectedTerm).replace('Term ', ''))

        if (!selectedAcademicYearId) return

        const { data: sessionRows } = await supabase
          .from('timetable_sessions')
          .select('id')
          .eq('academic_year_id', selectedAcademicYearId)
          .eq('term', isSecondary ? 1 : termValue)
          .limit(1)

        const sessionId = sessionRows?.[0]?.id
        if (sessionId) {
          const { data: existingRows, error: existingError } = await supabase
            .from('timetable_session_classes')
            .select('day_of_week, period_number, subject_id, period_type')
            .eq('session_id', sessionId)
            .eq('class_id', selectedClassId)
            .eq('section_id', selectedSectionId)

          if (existingError) throw existingError

          const nextGrid = {}
          DAYS.forEach(day => { nextGrid[day] = {} })

            ; (existingRows || []).forEach(row => {
              if (String(row.period_type || '').toLowerCase() !== 'class') return
              const key = `p${row.period_number}`
              if (!nextGrid[row.day_of_week]) nextGrid[row.day_of_week] = {}
              if (key === 'p1') {
                const matchingTeacher = normalizedTeachers.find(t => {
                  const subjectsForTeacher = nextTeacherMap[String(t.staff_id)] || []
                  return subjectsForTeacher.some(s => String(s.subject_id) === String(row.subject_id))
                })
                const fallbackTeacher = normalizedTeachers[0]
                nextGrid[row.day_of_week][key] = {
                  staff_id: matchingTeacher?.staff_id || fallbackTeacher?.staff_id || '',
                  subject_id: row.subject_id
                }
              } else {
                nextGrid[row.day_of_week][key] = row.subject_id
              }
            })

          setGrid(applyClassTeacherSubjectToGrid(nextGrid, defaultEntry))
        } else {
          const emptyGrid = {}
          DAYS.forEach(day => { emptyGrid[day] = {} })
          setGrid(applyClassTeacherSubjectToGrid(emptyGrid, defaultEntry))
        }
      } catch (error) {
        console.error('Error loading subjects and grid:', error)
        toast.error('Failed to load timetable details')
      } finally {
        setLoading(false)
      }
    }

    loadSubjectsAndGrid()
  }, [selectionComplete, selectedClassId, selectedSectionId, selectedGroupId, selectedTerm, selectedAcademicYearId, isSecondary, isHigherSec])

  // Reset grid when slots change (e.g. switching between 6 and 8 period classes)
  useEffect(() => {
    if (selectionComplete) {
      const emptyGrid = {}
      DAYS.forEach(day => { emptyGrid[day] = {} })
      setGrid(emptyGrid)
    }
  }, [slots, selectionComplete])

  // ─── Handlers ─────────────────────────────────────────────────────────

  const handleSchoolLevelChange = (level) => {
    setSelectedSchoolLevel(level)
    setSelectedClassId('')
    setSelectedGroupId('')
    setSelectedSectionId('')
    setSelectedTerm('')
  }

  const handleClassChange = (classId) => {
    setSelectedClassId(classId)
    setSelectedGroupId('')
    setSelectedSectionId('')
  }

  const handleGroupChange = (groupId) => {
    setSelectedGroupId(groupId)
    setSelectedSectionId('')
  }

  const handleCellChange = (day, key, subjectId) => {
    if (key === 'p1') return
    setGrid(prev => ({
      ...prev,
      [day]: {
        ...(prev[day] || {}),
        [key]: subjectId,
      }
    }))
  }

  const handlePeriod1TeacherChange = (day, teacherId) => {
    setGrid(prev => {
      const dayGrid = { ...(prev[day] || {}) }
      if (!teacherId) {
        dayGrid.p1 = {}
      } else {
        const subjects = classTeacherSubjectMap[String(teacherId)] || []
        dayGrid.p1 = {
          staff_id: teacherId,
          subject_id: subjects?.[0]?.subject_id || ''
        }
      }
      return { ...prev, [day]: dayGrid }
    })
  }

  const handlePeriod1SubjectChange = (day, teacherId, subjectId) => {
    if (!teacherId) return
    setGrid(prev => ({
      ...prev,
      [day]: {
        ...(prev[day] || {}),
        p1: {
          staff_id: teacherId,
          subject_id: subjectId
        }
      }
    }))
  }

  const getStaffForSubject = (subjectId) => {
    const staffId = subjectStaffMap[subjectId]
    if (!staffId) return null
    const staff = staffList.find(s => String(s.id) === String(staffId))
    return staff ? staff.full_name : `Staff ${staffId}`
  }

  // ─── Grid completeness ────────────────────────────────────────────────
  const isGridComplete = useMemo(() => {
    if (!selectionComplete) return false
    for (const day of DAYS) {
      for (const slot of classSlots) {
        if (slot.key === 'p1') {
          const entry = grid[day]?.p1
          if (!entry?.staff_id || !entry?.subject_id) return false
        } else if (!grid[day]?.[slot.key]) {
          return false
        }
      }
    }
    return true
  }, [selectionComplete, classSlots, grid])

  // ─── Save ─────────────────────────────────────────────────────────────
  const saveTimetable = async () => {
    if (!isAdmin) {
      toast.error('Only Admin users can create or modify timetables.')
      return
    }

    if (!selectionComplete) {
      toast.warning('Complete all required selections first.')
      return
    }

    setSaving(true)
    try {
      const termValue = isSecondary ? 0 : Number(String(selectedTerm).replace('Term ', ''))

      // Validate all cells
      const subjectById = subjects.reduce((acc, s) => { acc[s.subject_id] = s; return acc }, {})
      const entries = []

      for (const day of DAYS) {
        for (const slot of classSlots) {
          let subjectId = ''
          let staffId = ''
          if (slot.key === 'p1') {
            const entry = grid[day]?.p1
            if (!entry?.staff_id || !entry?.subject_id) {
              toast.error('Period 1 must be handled by assigned class teacher only')
              return
            }
            const teacherKey = String(entry.staff_id)
            if (!classTeachers.some(t => String(t.staff_id) === teacherKey)) {
              toast.error('Period 1 must be handled by assigned class teacher only')
              return
            }
            const subjectsForTeacher = classTeacherSubjectMap[teacherKey] || []
            if (!subjectsForTeacher.some(s => String(s.subject_id) === String(entry.subject_id))) {
              toast.error('Period 1 must be handled by assigned class teacher only')
              return
            }
            subjectId = entry.subject_id
            staffId = entry.staff_id
          } else {
            subjectId = grid[day]?.[slot.key]
            if (!subjectId) {
              throw new Error('All class periods must have a subject assigned before saving.')
            }
            staffId = subjectStaffMap[subjectId]
            if (!staffId) {
              const subjectName = subjectById[subjectId]?.subject_name || 'Selected subject'
              throw new Error(`${subjectName} has no staff mapping. Please assign staff in Subject Mapping for Staff.`)
            }
          }

          entries.push({ day, periodNumber: slot.periodNumber, subjectId, staffId })
        }
      }

      let sessionId
      const { data: existingSessions } = await supabase
        .from('timetable_sessions')
        .select('id')
        .eq('academic_year_id', selectedAcademicYearId)
        .eq('term', termValue)
        .limit(1)

      if (existingSessions?.length) {
        sessionId = existingSessions[0].id
      } else {
        // Auto-create a session
        const selectedYear = academicYears.find(y => String(y.id) === String(selectedAcademicYearId))
        const yearName = selectedYear?.year_name || ''
        const sessionName = `${yearName} - ${isSecondary ? 'Full Year' : selectedTerm}`
        const { data: newSession, error: createErr } = await supabase
          .from('timetable_sessions')
          .insert([{ session_name: sessionName, academic_year_id: selectedAcademicYearId, term: termValue, is_active: true }])
          .select('id')
          .single()

        if (createErr) throw createErr
        sessionId = newSession.id
      }

      // Delete existing entries for this class/section
      const { error: deleteError } = await supabase
        .from('timetable_session_classes')
        .delete()
        .eq('session_id', sessionId)
        .eq('class_id', selectedClassId)
        .eq('section_id', selectedSectionId)
        .eq('term', termValue)

      if (deleteError) throw deleteError

      // Build rows
      const rows = []
      for (const day of DAYS) {
        for (const slot of slots) {
          const row = {
            session_id: sessionId,
            class_id: selectedClassId,
            section_id: selectedSectionId,
            term: termValue,
            day_of_week: day,
            period_number: slot.periodNumber,
            period_type: slot.periodType,
            start_time: slot.start,
            end_time: slot.end,
            subject_id: null,
            staff_id: null,
          }

          if (slot.periodType === 'class') {
            const subjectId = grid[day]?.[slot.key]
            row.subject_id = subjectId
            row.staff_id = subjectStaffMap[subjectId] || null
          }

          rows.push(row)
        }
      }

      const { error: insertError } = await supabase
        .from('timetable_session_classes')
        .insert(rows)

      if (insertError) throw insertError

      toast.success('Timetable saved successfully')
    } catch (error) {
      console.error('Error saving timetable:', error)
      toast.error(error.message || 'Failed to save timetable')
    } finally {
      setSaving(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <AdShellAdmin
      brandTitle="ADMIN PORTAL"
      footerTitle="Admin Management Studio"
      footerSubtitle="Crafted for Jazz Public School"
    >
      <div className="desktop-container" style={{ overflowX: 'hidden' }}>
        <h4 className="mb-4">Class Time Table</h4>

        {!isAdmin && (
          <div className="alert alert-danger mb-3">Only Admin users can create and modify timetables.</div>
        )}

        {/* ─── SELECTION PANEL ─── */}
        <div className="card card-soft p-4 mb-4">
          <h5 className="mb-3 fw-semibold">Select Timetable Parameters</h5>

          <div className="row g-3">
            {/* Academic Year */}
            <div className="col-md-3">
              <label className="form-label fw-semibold">Academic Year <span className="text-danger">*</span></label>
              <select
                className="form-select"
                value={selectedAcademicYearId}
                onChange={e => setSelectedAcademicYearId(e.target.value)}
              >
                <option value="">Select Academic Year</option>
                {academicYears.map(y => (
                  <option key={y.id} value={y.id}>{y.year_name}</option>
                ))}
              </select>
            </div>

            {/* School Level */}
            <div className="col-md-3">
              <label className="form-label fw-semibold">School Level <span className="text-danger">*</span></label>
              <select
                className="form-select"
                value={selectedSchoolLevel}
                onChange={e => handleSchoolLevelChange(e.target.value)}
                disabled={!selectedAcademicYearId}
              >
                <option value="">Select Level</option>
                <option value="Primary">Primary (Class 1–5)</option>
                <option value="Middle">Middle (Class 6–9)</option>
                <option value="Secondary">Secondary (Class 10–12)</option>
              </select>
            </div>

            {/* Class */}
            <div className="col-md-3">
              <label className="form-label fw-semibold">Class <span className="text-danger">*</span></label>
              <select
                className="form-select"
                value={selectedClassId}
                onChange={e => handleClassChange(e.target.value)}
                disabled={!selectedSchoolLevel}
              >
                <option value="">Select Class</option>
                {filteredClasses.map(c => (
                  <option key={c.id} value={c.id}>{c.class_name}</option>
                ))}
              </select>
            </div>

            {/* Group – only for Class 11 & 12 */}
            {showGroupDropdown && (
              <div className="col-md-3">
                <label className="form-label fw-semibold">Group <span className="text-danger">*</span></label>
                <select
                  className="form-select"
                  value={selectedGroupId}
                  onChange={e => handleGroupChange(e.target.value)}
                  disabled={!selectedClassId}
                >
                  <option value="">Select Group</option>
                  {filteredGroups.map(g => (
                    <option key={g.id} value={g.id}>{g.group_name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Section */}
            <div className="col-md-3">
              <label className="form-label fw-semibold">Section <span className="text-danger">*</span></label>
              <select
                className="form-select"
                value={selectedSectionId}
                onChange={e => setSelectedSectionId(e.target.value)}
                disabled={!selectedClassId || (showGroupDropdown && !selectedGroupId)}
              >
                <option value="">Select Section</option>
                {classSections.map((s, index) => (
                  <option key={s.id} value={s.section_id}>{"A" + (index + 1)}</option>
                ))}
              </select>
            </div>

            {/* Term – only for Primary & Middle */}
            {showTermDropdown && selectedClassId && (
              <div className="col-md-3">
                <label className="form-label fw-semibold">Term <span className="text-danger">*</span></label>
                <select
                  className="form-select"
                  value={selectedTerm}
                  onChange={e => setSelectedTerm(e.target.value)}
                >
                  <option value="">Select Term</option>
                  <option value="Term 1">Term 1</option>
                  <option value="Term 2">Term 2</option>
                  <option value="Term 3">Term 3</option>
                </select>
              </div>
            )}

            {/* Secondary: Full Year badge */}
            {isSecondary && selectedClassId && (
              <div className="col-md-3">
                <label className="form-label fw-semibold">Term</label>
                <div className="form-control bg-light text-muted fw-semibold">Full Year</div>
              </div>
            )}
          </div>

          {/* Selection summary */}
          {selectionComplete && (
            <div className="mt-3 d-flex align-items-center gap-2 flex-wrap">
              <span className="badge bg-primary bg-opacity-10 text-primary px-3 py-2 fs-6">
                {academicYears.find(y => String(y.id) === String(selectedAcademicYearId))?.year_name}
              </span>
              <span className="badge bg-secondary bg-opacity-10 text-secondary px-3 py-2 fs-6">
                {selectedSchoolLevel}
              </span>
              <span className="badge bg-success bg-opacity-10 text-success px-3 py-2 fs-6">
                {selectedClassObj?.class_name}
              </span>
              {showGroupDropdown && selectedGroupId && (
                <span className="badge bg-info bg-opacity-10 text-info px-3 py-2 fs-6">
                  {filteredGroups.find(g => String(g.id) === String(selectedGroupId))?.group_name}
                </span>
              )}
              <span className="badge bg-warning bg-opacity-10 text-warning px-3 py-2 fs-6">
                Section {(() => {
                  const secIndex = classSections.findIndex(s => String(s.section_id) === String(selectedSectionId))
                  return "A" + (secIndex + 1)
                })()}
              </span>
              {showTermDropdown && (
                <span className="badge bg-dark bg-opacity-10 text-dark px-3 py-2 fs-6">
                  {selectedTerm}
                </span>
              )}
              {isSecondary && (
                <span className="badge bg-dark bg-opacity-10 text-dark px-3 py-2 fs-6">
                  Full Year
                </span>
              )}
            </div>
          )}
        </div>

        {/* ─── TIMETABLE GRID ─── */}
        {selectionComplete ? (
          <div className="card card-soft p-4 mb-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h5 className="mb-1">
                  Timetable Grid
                  <span className="text-muted fw-normal fs-6 ms-2">
                    ({selectedClassNumber >= 10 ? '6 periods/day' : '8 periods/day'})
                  </span>
                </h5>
                {subjects.length === 0 && (
                  <p className="text-warning mb-0 small fw-semibold">
                    <i className="bi bi-exclamation-triangle me-1"></i>
                    No subjects found for this selection. Create subjects first.
                  </p>
                )}
              </div>
              <button
                className="btn btn-primary px-4"
                onClick={saveTimetable}
                disabled={!isAdmin || saving || loading || !isGridComplete}
              >
                {saving ? 'Saving...' : 'Save Timetable'}
              </button>
            </div>

            {loading ? (
              <div className="text-center p-5 text-muted">Loading timetable data...</div>
            ) : (
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
                    {DAYS.map(day => (
                      <tr key={day}>
                        <td className="day-name">{day}</td>
                        {slots.map(slot => {
                          if (slot.periodType === 'class') {
                            const isPeriodOne = slot.key === 'p1'
                            const period1Entry = grid[day]?.p1 || {}
                            const selectedTeacherId = period1Entry.staff_id || (classTeachers[0]?.staff_id || '')
                            const selectedSubjectId = isPeriodOne ? (period1Entry.subject_id || '') : (grid[day]?.[slot.key] || '')
                            const teacherSubjects = selectedTeacherId ? classTeacherSubjectMap[String(selectedTeacherId)] || [] : []
                            const selectedTeacher = classTeachers.find(t => String(t.staff_id) === String(selectedTeacherId))
                            const staffName = isPeriodOne ? selectedTeacher?.staff_name : (selectedSubjectId ? getStaffForSubject(selectedSubjectId) : null)
                            return (
                              <td key={`${day}-${slot.key}`} className="slot-cell">
                                {isPeriodOne ? (
                                  <>
                                    <select
                                      className="form-select form-select-sm mb-1"
                                      value={selectedTeacherId}
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
                                      value={selectedSubjectId}
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
                                      value={selectedSubjectId}
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
                                  </>
                                )}
                                {staffName && (
                                  <div className="staff-info">
                                    <i className="bi bi-person-fill me-1"></i>{staffName}
                                  </div>
                                )}
                                {isPeriodOne && !teacherSubjects.length && selectedTeacherId && (
                                  <div className="text-danger small" style={{ fontSize: '0.65rem' }}>
                                    <i className="bi bi-exclamation-circle me-1"></i>Assign a subject to this teacher first
                                  </div>
                                )}
                              </td>
                            )
                          }

                          return (
                            <td
                              key={`${day}-${slot.key}`}
                              className={slot.periodType === 'break' ? 'break-cell' : 'lunch-cell'}
                            >
                              {(() => {
                                const dayIndex = DAYS.indexOf(day)
                                const word = slot.periodType === 'break' ? 'BREAK' : 'LUNCH'
                                return word[dayIndex]
                              })()}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>

                <style dangerouslySetInnerHTML={{ __html: `
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
            )}
          </div>
        ) : (
          <div className="card card-soft p-5 text-center text-muted mb-4">
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📅</div>
            <h5 className="fw-semibold">Select all required fields to load the timetable grid</h5>
            <p className="mb-0">
              {!selectedAcademicYearId ? 'Start by selecting an Academic Year.'
                : !selectedSchoolLevel ? 'Select a School Level to continue.'
                  : !selectedClassId ? 'Select a Class.'
                    : (showGroupDropdown && !selectedGroupId) ? 'Select a Group for Class 11/12.'
                      : !selectedSectionId ? 'Select a Section.'
                        : (showTermDropdown && !selectedTerm) ? 'Select a Term.'
                          : 'All fields required.'}
            </p>
          </div>
        )}
      </div>
      <ToastContainer position="top-right" autoClose={3000} />
    </AdShellAdmin>
  )
}
