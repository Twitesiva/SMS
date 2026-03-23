import { useEffect, useMemo, useState, useCallback } from 'react'
import AdShellAdmin from '../../components/AdShellAdmin'
import { supabase } from '../../../supabaseClient'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { useAuth } from '../../store/auth'
import './Setup.css'
import './AdminContent.css'

// ============================================
// UTILITY FUNCTIONS
// ============================================

const FIXED_DAYS_SOURCE = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const FIXED_DAYS = Object.freeze(FIXED_DAYS_SOURCE)

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

/**
 * Validates if a string is a valid UUID
 */
const isValidUUID = (value) => {
  if (!value) return false
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(String(value))
}

/**
 * Converts empty string to null, or returns the value if valid UUID
 */
const nullIfEmpty = (value) => {
  if (!value || value === '' || value === 'undefined' || value === 'NaN') return null
  return value
}

/**
 * Creates a clean grid entry with null values instead of empty strings
 */
const createGridEntry = (subjectId, staffId) => ({
  subject_id: nullIfEmpty(subjectId),
  staff_id: nullIfEmpty(staffId),
})

/**
 * Format term display based on class number
 */
const formatTerm = (classNumber, term) => {
  const num = Number(classNumber || 0)
  if (num >= 10 || term === 0) {
    return 'Full Year'
  }
  return `Term ${term}`
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function ClassTimeTable() {
  const { user } = useAuth()
  const isAdmin = String(user?.role || '').toUpperCase() === 'ADMIN'

  // ---------- Base data ----------
  const [academicYears, setAcademicYears] = useState([])
  const [allClasses, setAllClasses] = useState([])
  const [allGroups, setAllGroups] = useState([])
  const [classSections, setClassSections] = useState([])
  const [subjects, setSubjects] = useState([])
  const [subjectStaffMap, setSubjectStaffMap] = useState({})
  const [staffList, setStaffList] = useState([])
  const [classTeachers, setClassTeachers] = useState([])
  const [classTeacherSubjectMap, setClassTeacherSubjectMap] = useState({})
  const [periodIdBySlot, setPeriodIdBySlot] = useState({})
  const [busyStaffSlots, setBusyStaffSlots] = useState({})

  // ---------- Selection state ----------
  // Use null instead of empty string for UUID fields
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState(null)
  const [selectedSchoolLevel, setSelectedSchoolLevel] = useState('')
  const [selectedClassId, setSelectedClassId] = useState(null)
  const [selectedGroupId, setSelectedGroupId] = useState(null)
  const [classSectionId, setClassSectionId] = useState(null)
  const [selectedTerm, setSelectedTerm] = useState('')

  // ---------- Grid & UI state ----------
  const [grid, setGrid] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // ---------- Saved Timetables State ----------
  const [savedTimetables, setSavedTimetables] = useState([])
  const [savedLoading, setSavedLoading] = useState(true)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedTimetable, setSelectedTimetable] = useState(null)
  const [viewData, setViewData] = useState(null)
  const [editingTimetable, setEditingTimetable] = useState(null)

  // ---------- Derived values ----------
  const selectedClassObj = useMemo(
    () => allClasses.find(c => String(c.id) === String(selectedClassId)),
    [allClasses, selectedClassId]
  )

  const selectedClassNumber = selectedClassObj
    ? Number(selectedClassObj.class_number || 0)
    : 0

  // Class band for period filtering: "1-9" for classes 1-9, "10-12" for classes 10-12
  const classBand = selectedClassNumber >= 10 ? '10-12' : '1-9'

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

  const sectionOptions = useMemo(() => {
    return classSections.map((section, index) => ({
      label: `A${index + 1}`,
      value: section.id
    }))
  }, [classSections])

  const slots = useMemo(() => getSlotTemplate(selectedClassNumber), [selectedClassNumber])
  const classSlots = useMemo(() => slots.filter(s => s.periodNumber !== null), [slots])

  // Determine term number from selection
  const termNumber = useMemo(() => {
    if (isSecondary) return 0
    if (!selectedTerm) return null
    const parsed = Number(String(selectedTerm).replace('Term ', '').trim())
    return Number.isNaN(parsed) ? null : parsed
  }, [isSecondary, selectedTerm])

  // Check if all required fields are selected
  const selectionComplete = useMemo(() => {
    // Validate UUIDs
    if (!isValidUUID(selectedAcademicYearId)) return false
    if (!isValidUUID(selectedClassId)) return false
    if (!isValidUUID(classSectionId)) return false
    if (isHigherSec && !isValidUUID(selectedGroupId)) return false
    if (showTermDropdown && termNumber === null) return false
    return true
  }, [selectedAcademicYearId, selectedSchoolLevel, selectedClassId, classSectionId, selectedGroupId, termNumber, isHigherSec, showTermDropdown])

  // ============================================
  // LOAD INITIAL DATA
  // ============================================
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

  // ============================================
  // LOAD SAVED TIMETABLES
  // ============================================
  useEffect(() => {
    const fetchSavedTimetables = async () => {
      try {
        setSavedLoading(true)

        const { data: sessions, error } = await supabase
          .from('timetable_sessions')
          .select(`
            academic_year_id,
            class_section_id,
            term,
            academic_years!inner(id, year_name),
            class_sections!inner(id, class_id, section_id, sections!inner(section_name), classes!inner(class_name, class_number))
          `)
          .order('academic_year_id', { ascending: false })

        if (error) throw error

        // Group by academic_year_id, class_section_id, term
        const grouped = {}
        
        ;(sessions || []).forEach(session => {
          const key = `${session.academic_year_id}-${session.class_section_id}-${session.term}`
          
          if (!grouped[key]) {
            grouped[key] = {
              academic_year_id: session.academic_year_id,
              class_section_id: session.class_section_id,
              term: session.term,
              year_name: session.academic_years?.year_name || 'N/A',
              class_name: session.class_sections?.classes?.class_name || 'N/A',
              class_number: session.class_sections?.classes?.class_number || 0,
              section_name: session.class_sections?.sections?.section_name || 'N/A'
            }
          }
        })

        const timetableList = Object.values(grouped).map(t => ({
          id: `${t.academic_year_id}-${t.class_section_id}-${t.term}`,
          academic_year_id: t.academic_year_id,
          class_section_id: t.class_section_id,
          term: t.term,
          year_name: t.year_name,
          class_name: t.class_name,
          class_number: t.class_number,
          section_name: t.section_name,
          term_display: formatTerm(t.class_number, t.term)
        }))

        setSavedTimetables(timetableList)
      } catch (error) {
        console.error('Error fetching saved timetables:', error)
      } finally {
        setSavedLoading(false)
      }
    }

    fetchSavedTimetables()
  }, [])

  // ============================================
  // VIEW/EDIT/DELETE HANDLERS
  // ============================================
  const handleViewTimetable = async (timetable) => {
    try {
      setSelectedTimetable(timetable)
      setViewModalOpen(true)

      const { data: sessions, error } = await supabase
        .from('timetable_sessions')
        .select(`
          day_of_week,
          period_id,
          subject_id,
          subjects!inner(subject_title),
          periods!inner(period_number)
        `)
        .eq('academic_year_id', timetable.academic_year_id)
        .eq('class_section_id', timetable.class_section_id)
        .eq('term', timetable.term)

      if (error) throw error

      const periodCount = timetable.class_number >= 10 ? 6 : 8
      const grid = {}
      FIXED_DAYS.forEach(day => { grid[day] = {} })

      ;(sessions || []).forEach(session => {
        if (!session.day_of_week || !session.periods?.period_number) return
        const slotKey = `p${session.periods.period_number}`
        grid[session.day_of_week][slotKey] = {
          subject_id: session.subject_id,
          subject_title: session.subjects?.subject_title || 'N/A'
        }
      })

      setViewData({
        academicYear: timetable.year_name,
        className: timetable.class_name,
        sectionName: timetable.section_name,
        term: timetable.term,
        classNumber: timetable.class_number,
        grid,
        periodCount
      })
    } catch (error) {
      console.error('Error viewing timetable:', error)
      toast.error('Failed to load timetable')
    }
  }

  const handleEditTimetable = async (timetable) => {
    try {
      // First get the class_section to find class_id
      const { data: sectionData, error: sectionError } = await supabase
        .from('class_sections')
        .select('class_id, sections(section_name)')
        .eq('id', timetable.class_section_id)
        .single()

      if (sectionError) throw sectionError

      // Determine school level from class_number
      const classNum = Number(timetable.class_number || 0)
      let schoolLevel = ''
      if (classNum >= 1 && classNum <= 5) schoolLevel = 'Primary'
      else if (classNum >= 6 && classNum <= 9) schoolLevel = 'Middle'
      else if (classNum >= 10) schoolLevel = 'Secondary'

      // Set all the selection states
      setSelectedAcademicYearId(timetable.academic_year_id)
      setSelectedSchoolLevel(schoolLevel)
      setSelectedClassId(sectionData.class_id)
      setClassSectionId(timetable.class_section_id)
      
      // Set term based on class
      if (classNum >= 10) {
        setSelectedTerm('') // Full year
      } else {
        setSelectedTerm(timetable.term === 0 ? '' : `Term ${timetable.term}`)
      }
      
      // Set editing mode
      setEditingTimetable(timetable)
      toast.info('Timetable loaded for editing')
    } catch (error) {
      console.error('Error loading timetable for edit:', error)
      toast.error('Failed to load timetable for editing')
    }
  }

  const handleDeleteClick = (timetable) => {
    setSelectedTimetable(timetable)
    setDeleteModalOpen(true)
  }

  const confirmDelete = async () => {
    if (!selectedTimetable) return

    try {
      const { error } = await supabase
        .from('timetable_sessions')
        .delete()
        .eq('academic_year_id', selectedTimetable.academic_year_id)
        .eq('class_section_id', selectedTimetable.class_section_id)
        .eq('term', selectedTimetable.term)

      if (error) throw error

      toast.success('Timetable deleted successfully')
      setDeleteModalOpen(false)
      
      // Refresh saved timetables
      const { data: sessions } = await supabase
        .from('timetable_sessions')
        .select(`
          academic_year_id,
          class_section_id,
          term,
          academic_years!inner(id, year_name),
          class_sections!inner(id, class_id, section_id, sections!inner(section_name), classes!inner(class_name, class_number))
        `)
        .order('academic_year_id', { ascending: false })

      const grouped = {}
      ;(sessions || []).forEach(session => {
        const key = `${session.academic_year_id}-${session.class_section_id}-${session.term}`
        if (!grouped[key]) {
          grouped[key] = {
            academic_year_id: session.academic_year_id,
            class_section_id: session.class_section_id,
            term: session.term,
            year_name: session.academic_years?.year_name || 'N/A',
            class_name: session.class_sections?.classes?.class_name || 'N/A',
            class_number: session.class_sections?.classes?.class_number || 0,
            section_name: session.class_sections?.sections?.section_name || 'N/A'
          }
        }
      })

      const timetableList = Object.values(grouped).map(t => ({
        id: `${t.academic_year_id}-${t.class_section_id}-${t.term}`,
        academic_year_id: t.academic_year_id,
        class_section_id: t.class_section_id,
        term: t.term,
        year_name: t.year_name,
        class_name: t.class_name,
        class_number: t.class_number,
        section_name: t.section_name,
        term_display: formatTerm(t.class_number, t.term)
      }))

      setSavedTimetables(timetableList)
    } catch (error) {
      console.error('Error deleting timetable:', error)
      toast.error('Failed to delete timetable')
    }
  }

  // ============================================
  // LOAD SECTIONS
  // ============================================
  useEffect(() => {
    if (!selectedClassId || !selectedAcademicYearId) {
      setClassSections([])
      return
    }

    if (isHigherSec && !selectedGroupId) {
      setClassSections([])
      return
    }

    const loadSections = async () => {
      try {
        // Validate UUIDs before querying
        if (!isValidUUID(selectedClassId) || !isValidUUID(selectedAcademicYearId)) {
          setClassSections([])
          return
        }

        let query = supabase
          .from('class_sections')
          .select('id, class_id, section_id, sections(id, section_name, group_id)')
          .eq('class_id', selectedClassId)
          .eq('academic_year_id', selectedAcademicYearId)

        if (isHigherSec && selectedGroupId) {
          query = query.eq('group_id', selectedGroupId)
        } else {
          query = query.is('group_id', null)
        }

        const { data, error } = await query.order('created_at')

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
  }, [selectedClassId, selectedGroupId, selectedAcademicYearId, isHigherSec])

  // ============================================
  // LOAD SUBJECTS, TEACHERS & EXISTING GRID
  // ============================================
  useEffect(() => {
    if (!selectionComplete) {
      setSubjects([])
      setSubjectStaffMap({})
      setGrid({})
      setClassTeachers([])
      setClassTeacherSubjectMap({})
      setPeriodIdBySlot({})
      return
    }

    const loadSubjectsAndGrid = async () => {
      const termForDb = termNumber
      if (!isValidUUID(selectedAcademicYearId) || !isValidUUID(classSectionId) || termForDb === null) {
        return
      }

      try {
        setLoading(true)

        // Load class subjects
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

        // Build staff map for subjects
        const nextStaffMap = {}
        ;(mappingRows || []).forEach(row => {
          if (row.subject_id && row.staff_id) {
            const list = nextStaffMap[row.subject_id] || []
            list.push(row.staff_id)
            nextStaffMap[row.subject_id] = list
          }
        })
        setSubjectStaffMap(nextStaffMap)

        // Load class teachers
        let normalizedTeachers = []
        if (isValidUUID(classSectionId)) {
          const { data: classTeacherRows, error: classTeacherError } = await supabase
            .from('class_teacher_mapping')
            .select('staff_id, staff (full_name)')
            .eq('class_section_id', classSectionId)
            .eq('academic_year_id', selectedAcademicYearId)

          if (classTeacherError) throw classTeacherError

          normalizedTeachers = (classTeacherRows || []).map(row => ({
            staff_id: row.staff_id,
            staff_name: row.staff?.full_name || 'Teacher ' + row.staff_id
          }))
        }

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

        // ============================================
        // PERIOD FETCHING WITH CLASS_BAND FILTER
        // ============================================
        
        // Debug logs
        console.log("Class Band:", classBand)
        
        const { data: periodRows, error: periodError } = await supabase
          .from('periods')
          .select('id, period_number')
          .eq('class_band', classBand)
          .order('period_number', { ascending: true })

        console.log("Fetched Periods:", periodRows)

        if (periodError) {
          console.warn('Periods query error:', periodError)
        }

        // Validation: Check if periods were found
        if (!periodRows || !periodRows.length) {
          console.warn("No periods found for class_band:", classBand)
          toast.warning(`No periods configured for ${classBand}. Please set up periods in the database.`)
        }

        // Safe mapping: period_number → slot key
        const slotToPeriodId = {}
        const periodIdToSlot = {}
        
        if (periodRows && periodRows.length > 0) {
          (periodRows || []).forEach(period => {
            if (!period?.id || !period.period_number) return
            const slotKey = 'p' + period.period_number
            slotToPeriodId[slotKey] = period.id
            periodIdToSlot[String(period.id)] = slotKey
          })
        } else {
          // Fallback: Map from local slot template if DB returns nothing
          console.warn('No periods found in database, using local mapping')
          slots.forEach(slot => {
            if (slot.periodNumber) {
              // This is a fallback - real IDs should come from DB
              slotToPeriodId[slot.key] = `local-${slot.periodNumber}`
            }
          })
        }

        console.log("Period Mapping:", slotToPeriodId)
        setPeriodIdBySlot(slotToPeriodId)

        // Load existing timetable
        const { data: existingRows, error: existingError } = await supabase
          .from('timetable_sessions')
          .select('day_of_week, period_id, subject_id, staff_id')
          .eq('academic_year_id', selectedAcademicYearId)
          .eq('class_section_id', classSectionId)
          .eq('term', termForDb)

        if (existingError) throw existingError

        // ========== STEP 1: FETCH BUSY STAFF DATA ==========
        const { data: busyRows, error: busyError } = await supabase
          .from('timetable_sessions')
          .select('staff_id, day_of_week, period_id, class_section_id')
          .eq('academic_year_id', selectedAcademicYearId)
          .eq('term', termForDb)

        if (busyError) throw busyError
        console.log("Busy Rows:", busyRows)

        // ========== STEP 2: BUILD BUSY MAP ==========
        // Skip same class (important for edit mode)
        const busyMap = {}
        ;(busyRows || []).forEach(row => {
          if (!row.staff_id || !row.day_of_week || !row.period_id) return

          // Skip same class_section_id (editing case)
          if (String(row.class_section_id) === String(classSectionId)) return

          // Map period_id back to slot key
          const slotKey = periodIdToSlot[String(row.period_id)]
          if (!slotKey) return

          const key = `${row.day_of_week}-${slotKey}`

          if (!busyMap[key]) {
            busyMap[key] = new Set()
          }

          busyMap[key].add(String(row.staff_id))
        })

        console.log("Busy Map:", busyMap)
        setBusyStaffSlots(busyMap)

        // Build grid with null values instead of empty strings
        const nextGrid = {}
        FIXED_DAYS.forEach(day => { nextGrid[day] = {} })

        ;(existingRows || []).forEach(row => {
          const slotKey = periodIdToSlot[String(row.period_id)]
          if (!row.day_of_week || !slotKey) return
          if (!nextGrid[row.day_of_week]) nextGrid[row.day_of_week] = {}
          // Ensure we use null, not empty string
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
        console.error('Error loading subjects and grid:', error)
        toast.error('Failed to load timetable details')
      } finally {
        setLoading(false)
      }
    }

    loadSubjectsAndGrid()
  }, [
    selectionComplete,
    selectedClassId,
    classSectionId,
    selectedGroupId,
    selectedTerm,
    selectedAcademicYearId,
    isSecondary,
    isHigherSec,
    termNumber,
    slots,
    classBand
  ])

  // ============================================
  // EVENT HANDLERS
  // ============================================

  const handleAcademicYearChange = useCallback((yearId) => {
    const value = nullIfEmpty(yearId)
    setSelectedAcademicYearId(value)
    setClassSectionId(null)
  }, [])

  const handleSchoolLevelChange = useCallback((level) => {
    setSelectedSchoolLevel(level)
    setSelectedClassId(null)
    setSelectedGroupId(null)
    setSelectedTerm('')
    setClassSectionId(null)
  }, [])

  const handleClassChange = useCallback((classId) => {
    const value = nullIfEmpty(classId)
    setClassSectionId(null)
    setSelectedClassId(value)
    setSelectedGroupId(null)
  }, [])

  const handleGroupChange = useCallback((groupId) => {
    const value = nullIfEmpty(groupId)
    setSelectedGroupId(value)
    setClassSectionId(null)
  }, [])

  const handleSectionChange = useCallback((event) => {
    const value = nullIfEmpty(event.target.value)
    setClassSectionId(value)
  }, [])

  const handleCellChange = useCallback((day, key, subjectId) => {
    if (key === 'p1') return // p1 is handled separately
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
        // Allow p1 to be optional (handled separately)
        if (slot.key !== 'p1') {
          if (!entry?.subject_id || !entry?.staff_id) return false
        }
      }
    }
    return true
  }, [selectionComplete, classSlots, grid])

  // ============================================
  // SAVE TIMETABLE
  // ============================================
  const saveTimetable = async () => {
    // ---------- Strict Validation ----------
    if (!isAdmin) {
      toast.error('Only Admin users can create or modify timetables.')
      return
    }

    if (!selectionComplete) {
      toast.warning('Complete all required selections first.')
      return
    }

    if (termNumber === null) {
      toast.error('Invalid term selected.')
      return
    }

    if (!isValidUUID(selectedAcademicYearId) || !isValidUUID(classSectionId)) {
      toast.error('Academic year and section selection are required.')
      return
    }

    if (!Object.keys(periodIdBySlot).length) {
      toast.error('Unable to determine period identifiers for this class.')
      return
    }

    setSaving(true)
    try {
      const numericTerm = Number(termNumber)
      const subjectById = subjects.reduce((acc, s) => { acc[s.subject_id] = s; return acc }, {})
      const timetableData = []

      for (const day of FIXED_DAYS) {
        for (const slot of classSlots) {
          const entry = grid[day]?.[slot.key] || {}
          let subjectId = nullIfEmpty(entry.subject_id)
          let staffId = nullIfEmpty(entry.staff_id)

          // For non-period-1 slots, require both subject and staff
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

          // Only include valid entries (with subject and staff)
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

      // ---------- SAFE PAYLOAD GENERATION ----------
      const payload = timetableData
        .map(item => ({
          academic_year_id: selectedAcademicYearId,
          class_section_id: classSectionId,
          subject_id: nullIfEmpty(item.subject_id),
          staff_id: nullIfEmpty(item.staff_id),
          period_id: nullIfEmpty(item.period_id),
          day_of_week: item.day,
          term: Number(numericTerm),
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

      // ---------- CHECK FOR STAFF CONFLICTS ----------
      const { data: existingAssignments, error: assignmentError } = await supabase
        .from('timetable_sessions')
        .select('staff_id, day_of_week, period_id, class_section_id')
        .eq('academic_year_id', selectedAcademicYearId)
        .eq('term', numericTerm)

      if (assignmentError) throw assignmentError

      // Improved staff conflict check - prevents same staff teaching different classes
      const conflictFound = payload.some(row =>
        (existingAssignments || []).some(existing => {
          // Skip if same class section (same teacher in same slot is OK for updates)
          if (String(existing.class_section_id) === String(classSectionId)) return false
          
          // Check: same staff, same day, same period, DIFFERENT class
          return (
            String(existing.staff_id) === String(row.staff_id) &&
            existing.day_of_week === row.day_of_week &&
            String(existing.period_id) === String(row.period_id)
          )
        })
      )

      if (conflictFound) {
        toast.error('Staff already assigned to another class in this slot')
        return
      }

      // ---------- DELETE EXISTING AND INSERT NEW ----------
      const { error: deleteError } = await supabase
        .from('timetable_sessions')
        .delete()
        .eq('academic_year_id', selectedAcademicYearId)
        .eq('class_section_id', classSectionId)
        .eq('term', numericTerm)

      if (deleteError) throw deleteError

      const { data: inserted, error: insertError } = await supabase
        .from('timetable_sessions')
        .insert(payload)

      if (insertError) {
        console.error('Insert error:', insertError)
        throw insertError
      }

      console.log('Timetable saved successfully', inserted)
      const message = editingTimetable ? 'Timetable updated successfully' : 'Timetable saved successfully'
      toast.success(message)
      
      // Clear editing state after successful save
      if (editingTimetable) {
        setEditingTimetable(null)
      }
    } catch (error) {
      console.error('Error saving timetable:', error)
      toast.error(error.message || 'Failed to save timetable')
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
        <h4 className="mb-4">Class Time Table</h4>

        {!isAdmin && (
          <div className="alert alert-danger mb-3">Only Admin users can create and modify timetables.</div>
        )}

        {/* ---------- SAVED TIMETABLES CARD ---------- */}
        <div className="card card-soft p-4 mb-4">
          <h5 className="mb-3 fw-semibold">Saved Timetables</h5>
          
          {savedLoading ? (
            <div className="text-center p-3">
              <div className="spinner-border spinner-border-sm" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : savedTimetables.length === 0 ? (
            <p className="text-muted mb-0">No saved timetables found. Create a new timetable below.</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm table-hover">
                <thead>
                  <tr>
                    <th>Academic Year</th>
                    <th>Class</th>
                    <th>Section</th>
                    <th>Term</th>
                    <th style={{ width: '180px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {savedTimetables.map(timetable => (
                    <tr key={timetable.id}>
                      <td>{timetable.year_name}</td>
                      <td>{timetable.class_name}</td>
                      <td>{timetable.section_name}</td>
                      <td>
                        <span className={`badge ${timetable.term === 0 || timetable.class_number >= 10 ? 'bg-success' : 'bg-primary'}`}>
                          {timetable.term_display}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline-primary me-1"
                          onClick={() => handleViewTimetable(timetable)}
                        >
                          View
                        </button>
                        <button
                          className="btn btn-sm btn-outline-secondary me-1"
                          onClick={() => handleEditTimetable(timetable)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDeleteClick(timetable)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ---------- SELECTION PANEL ---------- */}
        <div className="card card-soft p-4 mb-4">
          <h5 className="mb-3 fw-semibold">Select Timetable Parameters</h5>

          <div className="row g-3">
            {/* Academic Year */}
            <div className="col-md-3">
              <label className="form-label fw-semibold">Academic Year <span className="text-danger">*</span></label>
              <select
                className="form-select"
                value={selectedAcademicYearId || ''}
                onChange={e => handleAcademicYearChange(e.target.value)}
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
                value={selectedClassId || ''}
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
                  value={selectedGroupId || ''}
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
                value={classSectionId || ''}
                onChange={handleSectionChange}
                disabled={!selectedClassId || (showGroupDropdown && !selectedGroupId)}
              >
                <option value="">Select Section</option>
                {sectionOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
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
                Section {sectionOptions.find(opt => String(opt.value) === String(classSectionId))?.label || 'Unknown'}
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

        {/* ---------- TIMETABLE GRID ---------- */}
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
              <div className="d-flex gap-2">
                {editingTimetable && (
                  <button
                    className="btn btn-secondary px-4"
                    onClick={() => {
                      setEditingTimetable(null)
                      setSelectedAcademicYearId(null)
                      setSelectedSchoolLevel('')
                      setSelectedClassId(null)
                      setClassSectionId(null)
                      setSelectedTerm('')
                    }}
                  >
                    Clear
                  </button>
                )}
                <button
                  className="btn btn-primary px-4"
                  onClick={saveTimetable}
                  disabled={!isAdmin || saving || loading || !isGridComplete}
                >
                  {saving ? 'Saving...' : (editingTimetable ? 'Update Timetable' : 'Save Timetable')}
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-center p-5 text-muted">Loading timetable data...</div>
            ) : (
              <div className="table-responsive">
                <table className="timetable-table" style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  tableLayout: 'fixed',
                  border: '2px solid #6b7280'
                }}>
                  <thead>
                    <tr>
                      <th style={{ width: '120px', padding: '10px', backgroundColor: '#f3f4f6', fontWeight: '600', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af' }}>DAY</th>
                      {slots.map(slot => (
                        <th key={slot.key} style={{ padding: '10px 6px', backgroundColor: '#f3f4f6', fontWeight: '600', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af' }}>
                          <div className="fw-bold">{slot.label}</div>
                          <div className="text-muted small mb-0">
                            {formatTime(slot.start)} – {formatTime(slot.end)}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {FIXED_DAYS.map(day => (
                      <tr key={day}>
                        <td className="day-name" style={{ padding: '10px', fontWeight: '600', backgroundColor: '#f3f4f6', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af' }}>{day}</td>
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
                              <td key={`${day}-${slot.key}`} className="slot-cell" style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af' }}>
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
                                        // ========== CHECK IF STAFF IS BUSY ==========
                                        const slotBusyKey = `${day}-${slot.key}`
                                        const slotBusySet = busyStaffSlots[slotBusyKey] || new Set()
                                        const isBusy = slotBusySet.has(String(staffId))
                                        return (
                                          <option 
                                            key={`${slot.key}-${staffId}`} 
                                            value={staffId}
                                            disabled={isBusy}
                                            style={isBusy ? { color: '#dc3545', fontStyle: 'italic' } : {}}
                                          >
                                            {label} {isBusy ? "(Busy)" : ""}
                                          </option>
                                        )
                                      })}
                                    </select>
                                    {!selectedSubjectId && (
                                      <div className="text-muted small" style={{ fontSize: '0.65rem' }}>
                                        Select a subject to pick a staff member
                                      </div>
                                    )}
                                    {selectedSubjectId && !(subjectStaffMap[selectedSubjectId] || []).length && (
                                      <div className="text-danger small mt-1">
                                        No staff available for this subject
                                      </div>
                                    )}
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
                      : !classSectionId ? 'Select a Section.'
                        : (showTermDropdown && !selectedTerm) ? 'Select a Term.'
                          : 'All fields required.'}
            </p>
          </div>
        )}
      </div>

      {/* ---------- VIEW TIMETABLE MODAL ---------- */}
      {viewModalOpen && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="modal-content" style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '20px',
            maxWidth: '95vw',
            maxHeight: '95vh',
            overflow: 'auto'
          }}>
            {/* HEADER: Class & Section */}
            <div style={{ 
              textAlign: 'center', 
              padding: '15px', 
              backgroundColor: '#f8f9fa', 
              borderRadius: '8px',
              marginBottom: '15px',
              border: '1px solid #dee2e6'
            }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#333' }}>
                CLASS: {viewData?.className} &nbsp;|&nbsp; SECTION: {viewData?.sectionName}
              </div>
            </div>
            
            <div className="modal-header no-print" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px',
              borderBottom: '1px solid #eee',
              paddingBottom: '10px'
            }}>
              <div style={{ fontSize: '0.9rem', color: '#666' }}>
                <strong>Academic Year:</strong> {viewData?.academicYear} &nbsp;|&nbsp; 
                <strong>Term:</strong> {formatTerm(viewData?.classNumber, viewData?.term)}
              </div>
              <div>
                <button className="btn btn-primary btn-sm me-2" onClick={async () => {
                  // Import jsPDF and html2canvas
                  const { default: jsPDF } = await import('jspdf')
                  const html2canvas = (await import('html2canvas')).default
                  
                  // Create a container for PDF generation
                  const pdfContainer = document.createElement('div')
                  pdfContainer.style.position = 'absolute'
                  pdfContainer.style.left = '-9999px'
                  pdfContainer.style.top = '0'
                  pdfContainer.style.width = '1100px'
                  pdfContainer.style.padding = '20px'
                  pdfContainer.style.backgroundColor = 'white'
                  pdfContainer.style.fontFamily = 'Arial, sans-serif'
                  
                  // Build the PDF content HTML
                  const periodCount = viewData?.periodCount || 6
                  const is6Periods = periodCount <= 6
                  
                  // Generate header cells
                  let headerCells = `
                    <th style="background-color: #f2f2f2; border: 1px solid #333; padding: 8px; font-size: 10px;">DAY</th>
                  `
                  let bodyRows = ''
                  
                  // Period headers and body for 6 periods
                  if (is6Periods) {
                    headerCells += `
                      <th style="background-color: #f2f2f2; border: 1px solid #333; padding: 6px; font-size: 9px;">PERIOD 1<br/>10:00-10:40</th>
                      <th style="background-color: #f2f2f2; border: 1px solid #333; padding: 6px; font-size: 9px;">PERIOD 2<br/>10:40-11:20</th>
                      <th style="background-color: #fffde7; border: 1px solid #333; padding: 6px; font-size: 9px; color: #f57f17;">BREAK</th>
                      <th style="background-color: #f2f2f2; border: 1px solid #333; padding: 6px; font-size: 9px;">PERIOD 3<br/>11:25-12:05</th>
                      <th style="background-color: #f2f2f2; border: 1px solid #333; padding: 6px; font-size: 9px;">PERIOD 4<br/>12:05-12:45</th>
                      <th style="background-color: #e3f2fd; border: 1px solid #333; padding: 6px; font-size: 9px; color: #1976d2;">LUNCH</th>
                      <th style="background-color: #f2f2f2; border: 1px solid #333; padding: 6px; font-size: 9px;">PERIOD 5<br/>13:10-13:50</th>
                      <th style="background-color: #f2f2f2; border: 1px solid #333; padding: 6px; font-size: 9px;">PERIOD 6<br/>13:50-14:30</th>
                    `
                  } else {
                    headerCells += `
                      <th style="background-color: #f2f2f2; border: 1px solid #333; padding: 6px; font-size: 9px;">PERIOD 1<br/>10:00-10:40</th>
                      <th style="background-color: #f2f2f2; border: 1px solid #333; padding: 6px; font-size: 9px;">PERIOD 2<br/>10:40-11:20</th>
                      <th style="background-color: #fffde7; border: 1px solid #333; padding: 6px; font-size: 9px; color: #f57f17;">BREAK</th>
                      <th style="background-color: #f2f2f2; border: 1px solid #333; padding: 6px; font-size: 9px;">PERIOD 3<br/>11:25-12:05</th>
                      <th style="background-color: #f2f2f2; border: 1px solid #333; padding: 6px; font-size: 9px;">PERIOD 4<br/>12:05-12:45</th>
                      <th style="background-color: #e3f2fd; border: 1px solid #333; padding: 6px; font-size: 9px; color: #1976d2;">LUNCH</th>
                      <th style="background-color: #f2f2f2; border: 1px solid #333; padding: 6px; font-size: 9px;">PERIOD 5<br/>13:10-13:50</th>
                      <th style="background-color: #f2f2f2; border: 1px solid #333; padding: 6px; font-size: 9px;">PERIOD 6<br/>13:50-14:30</th>
                      <th style="background-color: #fffde7; border: 1px solid #333; padding: 6px; font-size: 9px; color: #f57f17;">BREAK</th>
                      <th style="background-color: #f2f2f2; border: 1px solid #333; padding: 6px; font-size: 9px;">PERIOD 7<br/>14:35-15:15</th>
                      <th style="background-color: #f2f2f2; border: 1px solid #333; padding: 6px; font-size: 9px;">PERIOD 8<br/>15:15-15:55</th>
                    `
                  }
                  
                  // Generate body rows
                  FIXED_DAYS.forEach(day => {
                    const dayIndex = FIXED_DAYS.indexOf(day)
                    
                    if (is6Periods) {
                      bodyRows += `
                        <tr>
                          <td style="background-color: #f9f9f9; border: 1px solid #333; padding: 6px; font-weight: bold; font-size: 9px;">${day}</td>
                          <td style="border: 1px solid #333; padding: 6px; font-size: 8px;">${viewData?.grid?.[day]?.p1?.subject_title || '-'}</td>
                          <td style="background-color: #fffde7; border: 1px solid #333; padding: 6px; font-weight: bold; color: #f57f17; font-size: 9px;">${'BREAK'[dayIndex]}</td>
                          <td style="border: 1px solid #333; padding: 6px; font-size: 8px;">${viewData?.grid?.[day]?.p2?.subject_title || '-'}</td>
                          <td style="border: 1px solid #333; padding: 6px; font-size: 8px;">${viewData?.grid?.[day]?.p3?.subject_title || '-'}</td>
                          <td style="background-color: #e3f2fd; border: 1px solid #333; padding: 6px; font-weight: bold; color: #1976d2; font-size: 9px;">${'LUNCH'[dayIndex]}</td>
                          <td style="border: 1px solid #333; padding: 6px; font-size: 8px;">${viewData?.grid?.[day]?.p4?.subject_title || '-'}</td>
                          <td style="border: 1px solid #333; padding: 6px; font-size: 8px;">${viewData?.grid?.[day]?.p5?.subject_title || '-'}</td>
                        </tr>
                      `
                    } else {
                      bodyRows += `
                        <tr>
                          <td style="background-color: #f9f9f9; border: 1px solid #333; padding: 6px; font-weight: bold; font-size: 9px;">${day}</td>
                          <td style="border: 1px solid #333; padding: 6px; font-size: 8px;">${viewData?.grid?.[day]?.p1?.subject_title || '-'}</td>
                          <td style="border: 1px solid #333; padding: 6px; font-size: 8px;">${viewData?.grid?.[day]?.p2?.subject_title || '-'}</td>
                          <td style="background-color: #fffde7; border: 1px solid #333; padding: 6px; font-weight: bold; color: #f57f17; font-size: 9px;">${'BREAK'[dayIndex]}</td>
                          <td style="border: 1px solid #333; padding: 6px; font-size: 8px;">${viewData?.grid?.[day]?.p3?.subject_title || '-'}</td>
                          <td style="border: 1px solid #333; padding: 6px; font-size: 8px;">${viewData?.grid?.[day]?.p4?.subject_title || '-'}</td>
                          <td style="background-color: #e3f2fd; border: 1px solid #333; padding: 6px; font-weight: bold; color: #1976d2; font-size: 9px;">${'LUNCH'[dayIndex]}</td>
                          <td style="border: 1px solid #333; padding: 6px; font-size: 8px;">${viewData?.grid?.[day]?.p5?.subject_title || '-'}</td>
                          <td style="border: 1px solid #333; padding: 6px; font-size: 8px;">${viewData?.grid?.[day]?.p6?.subject_title || '-'}</td>
                          <td style="background-color: #fffde7; border: 1px solid #333; padding: 6px; font-weight: bold; color: #f57f17; font-size: 9px;">${'BREAK'[dayIndex]}</td>
                          <td style="border: 1px solid #333; padding: 6px; font-size: 8px;">${viewData?.grid?.[day]?.p7?.subject_title || '-'}</td>
                          <td style="border: 1px solid #333; padding: 6px; font-size: 8px;">${viewData?.grid?.[day]?.p8?.subject_title || '-'}</td>
                        </tr>
                      `
                    }
                  })
                  
                  pdfContainer.innerHTML = `
                    <div style="text-align: center; padding: 15px; background-color: #f8f9fa; border: 1px solid #dee2e6; margin-bottom: 15px; border-radius: 5px;">
                      <h2 style="font-size: 18px; margin-bottom: 5px; color: #333;">CLASS: ${viewData?.className} | SECTION: ${viewData?.sectionName}</h2>
                      <p style="font-size: 12px; color: #666;">Academic Year: ${viewData?.academicYear} | Term: ${formatTerm(viewData?.classNumber, viewData?.term)}</p>
                    </div>
                    <table style="width: 100%; border-collapse: collapse; border: 1px solid #333;">
                      <thead>
                        <tr>${headerCells}</tr>
                      </thead>
                      <tbody>${bodyRows}</tbody>
                    </table>
                    <div style="text-align: center; padding: 15px; background-color: #f8f9fa; border: 1px solid #dee2e6; margin-top: 15px; border-radius: 5px;">
                      <p style="font-size: 12px;">Academic Year: ${viewData?.academicYear} | Class: ${viewData?.className} | Section: ${viewData?.sectionName}</p>
                    </div>
                  `
                  
                  document.body.appendChild(pdfContainer)
                  
                  try {
                    // Convert to canvas
                    const canvas = await html2canvas(pdfContainer, {
                      scale: 2,
                      useCORS: true,
                      logging: false,
                      backgroundColor: '#ffffff'
                    })
                    
                    // Calculate dimensions for A4 landscape
                    const imgWidth = 297 // A4 landscape width in mm
                    const pageHeight = 210 // A4 landscape height in mm
                    const imgHeight = (canvas.height * imgWidth) / canvas.width
                    
                    // Create PDF in landscape mode
                    const pdf = new jsPDF('l', 'mm', 'a4')
                    let heightLeft = imgHeight
                    let position = 0
                    
                    // Add image to PDF
                    const imgData = canvas.toDataURL('image/png')
                    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
                    heightLeft -= pageHeight
                    
                    // Add more pages if needed
                    while (heightLeft > 0) {
                      position = heightLeft - imgHeight
                      pdf.addPage()
                      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
                      heightLeft -= pageHeight
                    }
                    
                    // Generate filename
                    const fileName = `Class_${viewData?.className}_${viewData?.sectionName}_Timetable_${viewData?.academicYear}.pdf`.replace(/\s+/g, '_')
                    
                    // Download directly
                    pdf.save(fileName)
                    
                  } catch (error) {
                    console.error('PDF generation error:', error)
                    alert('Error generating PDF. Please try again.')
                  } finally {
                    // Clean up
                    document.body.removeChild(pdfContainer)
                  }
                }}>
                  Download PDF
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => {
                  setViewModalOpen(false)
                  setViewData(null)
                  setSelectedTimetable(null)
                }}>
                  Close
                </button>
              </div>
            </div>
            <div id="timetable-view-grid">
              {/* Use the same slots as the edit view */}
              <table className="timetable-table" style={{
                width: '100%',
                borderCollapse: 'collapse',
                tableLayout: 'fixed',
                border: '2px solid #6b7280'
              }}>
                <thead>
                  <tr>
                    <th className="day-name" style={{ width: '120px', padding: '10px', backgroundColor: '#f3f4f6', fontWeight: '600', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af' }}>DAY</th>
                    {viewData?.periodCount <= 6 ? (
                      <>
                        <th style={{ padding: '10px 6px', backgroundColor: '#f3f4f6', fontWeight: '600', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af' }}>
                          <div className="fw-bold">PERIOD 1</div>
                          <div className="text-muted small mb-0">{formatTime('10:00')} - {formatTime('10:40')}</div>
                        </th>
                        <th style={{ padding: '10px 6px', backgroundColor: '#f3f4f6', fontWeight: '600', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af' }}>
                          <div className="fw-bold">PERIOD 2</div>
                          <div className="text-muted small mb-0">{formatTime('10:40')} - {formatTime('11:20')}</div>
                        </th>
                        <th className="break-cell" style={{ padding: '10px 6px', backgroundColor: '#fef3c7', color: '#d97706', fontWeight: 'bold', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af' }}>
                          <div>BREAK</div>
                        </th>
                        <th style={{ padding: '10px 6px', backgroundColor: '#f3f4f6', fontWeight: '600', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af' }}>
                          <div className="fw-bold">PERIOD 3</div>
                          <div className="text-muted small mb-0">{formatTime('11:25')} - {formatTime('12:05')}</div>
                        </th>
                        <th style={{ padding: '10px 6px', backgroundColor: '#f3f4f6', fontWeight: '600', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af' }}>
                          <div className="fw-bold">PERIOD 4</div>
                          <div className="text-muted small mb-0">{formatTime('12:05')} - {formatTime('12:45')}</div>
                        </th>
                        <th className="lunch-cell" style={{ padding: '10px 6px', backgroundColor: '#dbeafe', color: '#2563eb', fontWeight: 'bold', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af' }}>
                          <div>LUNCH</div>
                        </th>
                        <th style={{ padding: '10px 6px', backgroundColor: '#f3f4f6', fontWeight: '600', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af' }}>
                          <div className="fw-bold">PERIOD 5</div>
                          <div className="text-muted small mb-0">{formatTime('13:10')} - {formatTime('13:50')}</div>
                        </th>
                        <th style={{ padding: '10px 6px', backgroundColor: '#f3f4f6', fontWeight: '600', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af' }}>
                          <div className="fw-bold">PERIOD 6</div>
                          <div className="text-muted small mb-0">{formatTime('13:50')} - {formatTime('14:30')}</div>
                        </th>
                      </>
                    ) : (
                      <>
                        <th style={{ padding: '10px 6px', backgroundColor: '#f3f4f6', fontWeight: '600', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af' }}>
                          <div className="fw-bold">PERIOD 1</div>
                          <div className="text-muted small mb-0">{formatTime('10:00')} - {formatTime('10:40')}</div>
                        </th>
                        <th style={{ padding: '10px 6px', backgroundColor: '#f3f4f6', fontWeight: '600', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af' }}>
                          <div className="fw-bold">PERIOD 2</div>
                          <div className="text-muted small mb-0">{formatTime('10:40')} - {formatTime('11:20')}</div>
                        </th>
                        <th className="break-cell" style={{ padding: '10px 6px', backgroundColor: '#fef3c7', color: '#d97706', fontWeight: 'bold', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af' }}>
                          <div>BREAK</div>
                        </th>
                        <th style={{ padding: '10px 6px', backgroundColor: '#f3f4f6', fontWeight: '600', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af' }}>
                          <div className="fw-bold">PERIOD 3</div>
                          <div className="text-muted small mb-0">{formatTime('11:25')} - {formatTime('12:05')}</div>
                        </th>
                        <th style={{ padding: '10px 6px', backgroundColor: '#f3f4f6', fontWeight: '600', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af' }}>
                          <div className="fw-bold">PERIOD 4</div>
                          <div className="text-muted small mb-0">{formatTime('12:05')} - {formatTime('12:45')}</div>
                        </th>
                        <th className="lunch-cell" style={{ padding: '10px 6px', backgroundColor: '#dbeafe', color: '#2563eb', fontWeight: 'bold', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af' }}>
                          <div>LUNCH</div>
                        </th>
                        <th style={{ padding: '10px 6px', backgroundColor: '#f3f4f6', fontWeight: '600', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af' }}>
                          <div className="fw-bold">PERIOD 5</div>
                          <div className="text-muted small mb-0">{formatTime('13:10')} - {formatTime('13:50')}</div>
                        </th>
                        <th style={{ padding: '10px 6px', backgroundColor: '#f3f4f6', fontWeight: '600', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af' }}>
                          <div className="fw-bold">PERIOD 6</div>
                          <div className="text-muted small mb-0">{formatTime('13:50')} - {formatTime('14:30')}</div>
                        </th>
                        <th className="break-cell" style={{ padding: '10px 6px', backgroundColor: '#fef3c7', color: '#d97706', fontWeight: 'bold', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af' }}>
                          <div>BREAK</div>
                        </th>
                        <th style={{ padding: '10px 6px', backgroundColor: '#f3f4f6', fontWeight: '600', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af' }}>
                          <div className="fw-bold">PERIOD 7</div>
                          <div className="text-muted small mb-0">{formatTime('14:35')} - {formatTime('15:15')}</div>
                        </th>
                        <th style={{ padding: '10px 6px', backgroundColor: '#f3f4f6', fontWeight: '600', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af' }}>
                          <div className="fw-bold">PERIOD 8</div>
                          <div className="text-muted small mb-0">{formatTime('15:15')} - {formatTime('15:55')}</div>
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {FIXED_DAYS.map(day => (
                    <tr key={day}>
                      <td className="day-name" style={{ padding: '10px', fontWeight: '600', backgroundColor: '#f3f4f6', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af' }}>{day}</td>
                      {viewData?.periodCount <= 6 ? (
                        // 6 periods
                        <>
                          <td style={{ padding: '10px 6px', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af', whiteSpace: 'normal' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                              <span className="fw-bold">{viewData?.grid?.[day]?.p1?.subject_title || '-'}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 6px', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af', whiteSpace: 'normal' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                              <span className="fw-bold">{viewData?.grid?.[day]?.p2?.subject_title || '-'}</span>
                            </div>
                          </td>
                          <td className="break-cell" style={{ padding: '10px 6px', textAlign: 'center', verticalAlign: 'middle', backgroundColor: '#fef3c7', color: '#d97706', fontWeight: 'bold', border: '1px solid #9ca3af' }}>
                            {(() => {
                              const dayIndex = FIXED_DAYS.indexOf(day)
                              return 'BREAK'[dayIndex]
                            })()}
                          </td>
                          <td style={{ padding: '10px 6px', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af', whiteSpace: 'normal' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                              <span className="fw-bold">{viewData?.grid?.[day]?.p3?.subject_title || '-'}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 6px', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af', whiteSpace: 'normal' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                              <span className="fw-bold">{viewData?.grid?.[day]?.p4?.subject_title || '-'}</span>
                            </div>
                          </td>
                          <td className="lunch-cell" style={{ padding: '10px 6px', textAlign: 'center', verticalAlign: 'middle', backgroundColor: '#dbeafe', color: '#2563eb', fontWeight: 'bold', border: '1px solid #9ca3af' }}>
                            {(() => {
                              const dayIndex = FIXED_DAYS.indexOf(day)
                              return 'LUNCH'[dayIndex]
                            })()}
                          </td>
                          <td style={{ padding: '10px 6px', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af', whiteSpace: 'normal' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                              <span className="fw-bold">{viewData?.grid?.[day]?.p5?.subject_title || '-'}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 6px', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af', whiteSpace: 'normal' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                              <span className="fw-bold">{viewData?.grid?.[day]?.p6?.subject_title || '-'}</span>
                            </div>
                          </td>
                        </>
                      ) : (
                        // 8 periods
                        <>
                          <td style={{ padding: '10px 6px', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af', whiteSpace: 'normal' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                              <span className="fw-bold">{viewData?.grid?.[day]?.p1?.subject_title || '-'}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 6px', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af', whiteSpace: 'normal' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                              <span className="fw-bold">{viewData?.grid?.[day]?.p2?.subject_title || '-'}</span>
                            </div>
                          </td>
                          <td className="break-cell" style={{ padding: '10px 6px', textAlign: 'center', verticalAlign: 'middle', backgroundColor: '#fef3c7', color: '#d97706', fontWeight: 'bold', border: '1px solid #9ca3af' }}>
                            {(() => {
                              const dayIndex = FIXED_DAYS.indexOf(day)
                              return 'BREAK'[dayIndex]
                            })()}
                          </td>
                          <td style={{ padding: '10px 6px', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af', whiteSpace: 'normal' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                              <span className="fw-bold">{viewData?.grid?.[day]?.p3?.subject_title || '-'}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 6px', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af', whiteSpace: 'normal' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                              <span className="fw-bold">{viewData?.grid?.[day]?.p4?.subject_title || '-'}</span>
                            </div>
                          </td>
                          <td className="lunch-cell" style={{ padding: '10px 6px', textAlign: 'center', verticalAlign: 'middle', backgroundColor: '#dbeafe', color: '#2563eb', fontWeight: 'bold', border: '1px solid #9ca3af' }}>
                            {(() => {
                              const dayIndex = FIXED_DAYS.indexOf(day)
                              return 'LUNCH'[dayIndex]
                            })()}
                          </td>
                          <td style={{ padding: '10px 6px', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af', whiteSpace: 'normal' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                              <span className="fw-bold">{viewData?.grid?.[day]?.p5?.subject_title || '-'}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 6px', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af', whiteSpace: 'normal' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                              <span className="fw-bold">{viewData?.grid?.[day]?.p6?.subject_title || '-'}</span>
                            </div>
                          </td>
                          <td className="break-cell" style={{ padding: '10px 6px', textAlign: 'center', verticalAlign: 'middle', backgroundColor: '#fef3c7', color: '#d97706', fontWeight: 'bold', border: '1px solid #9ca3af' }}>
                            {(() => {
                              const dayIndex = FIXED_DAYS.indexOf(day)
                              return 'BREAK'[dayIndex]
                            })()}
                          </td>
                          <td style={{ padding: '10px 6px', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af', whiteSpace: 'normal' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                              <span className="fw-bold">{viewData?.grid?.[day]?.p7?.subject_title || '-'}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 6px', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #9ca3af', whiteSpace: 'normal' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                              <span className="fw-bold">{viewData?.grid?.[day]?.p8?.subject_title || '-'}</span>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* FOOTER: Academic Year, Class, Section */}
            <div style={{ 
              textAlign: 'center', 
              padding: '15px', 
              backgroundColor: '#f8f9fa', 
              borderRadius: '8px',
              marginTop: '15px',
              border: '1px solid #dee2e6'
            }}>
              <div style={{ fontSize: '0.95rem', color: '#333' }}>
                <strong>Academic Year:</strong> {viewData?.academicYear} &nbsp;|&nbsp; 
                <strong>Class:</strong> {viewData?.className} &nbsp;|&nbsp; 
                <strong>Section:</strong> {viewData?.sectionName}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- DELETE CONFIRMATION MODAL ---------- */}
      {deleteModalOpen && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="modal-content" style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '20px',
            maxWidth: '400px'
          }}>
            <h5>Confirm Delete</h5>
            <p>Are you sure you want to delete the timetable for <strong>{selectedTimetable?.class_name} - {selectedTimetable?.section_name}</strong>?</p>
            <p className="text-muted">This action cannot be undone.</p>
            <div className="d-flex justify-content-end gap-2">
              <button className="btn btn-secondary" onClick={() => {
                setDeleteModalOpen(false)
                setSelectedTimetable(null)
              }}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </AdShellAdmin>
  )
}
