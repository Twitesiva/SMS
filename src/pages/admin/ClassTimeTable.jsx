import AdminShell from '../../components/AdminShell'
import crestPrimary from '../../assets/media/images.png'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../../supabaseClient'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

/* ===============================
   CONSTANTS
================================ */
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

const BREAK_LETTERS = ['B', 'R', 'E', 'A', 'K']
const LUNCH_LETTERS = ['L', 'U', 'N', 'C', 'H']

// UI Definition mapping to periods 1-5
const TIME_SLOTS = [
  { key: 'p1', label: 'PERIOD 1', displayTime: '9:00 AM - 10:10 AM', startTime: '09:00:00', endTime: '10:10:00', type: 'CLASS', periodNum: 1 },
  { key: 'b1', label: 'BREAK', displayTime: '10:10 AM - 10:20 AM', type: 'BREAK' },
  { key: 'p2', label: 'PERIOD 2', displayTime: '10:20 AM - 11:30 AM', startTime: '10:20:00', endTime: '11:30:00', type: 'CLASS', periodNum: 2 },
  { key: 'p3', label: 'PERIOD 3', displayTime: '11:30 AM - 12:40 PM', startTime: '11:30:00', endTime: '12:40:00', type: 'CLASS', periodNum: 3 },
  { key: 'lunch', label: 'LUNCH', displayTime: '12:40 PM - 1:40 PM', type: 'LUNCH' },
  { key: 'p4', label: 'PERIOD 4', displayTime: '1:40 PM - 2:50 PM', startTime: '13:40:00', endTime: '14:50:00', type: 'CLASS', periodNum: 4 },
  { key: 'b2', label: 'BREAK', displayTime: '2:50 PM - 3:00 PM', type: 'BREAK' },
  { key: 'p5', label: 'PERIOD 5', displayTime: '3:00 PM - 4:00 PM', startTime: '15:00:00', endTime: '16:00:00', type: 'CLASS', periodNum: 5 }
]

/* ===============================
   NAV
================================ */
const adminNavGroups = [

  {
    title: 'Exam Applications',
    static: true,
    items: [
      {
        to: '/admin-portal/applications',
        label: 'Exam Applications',
        icon: 'bi-inboxes'
      }
    ]
  },
  {
    title: 'Student Portal',
    items: [
      {
        to: '/admin-portal/academic-years',
        label: 'Academic Years',
        icon: 'bi-calendar3'
      },
      {
        to: '/admin-portal/groups-courses',
        label: 'Groups & Courses',
        icon: 'bi-diagram-3'
      },
      {
        to: '/admin-portal/subjects',
        label: 'Subjects',
        icon: 'bi-journal-text'
      }
    ]
  },
  {
    title: 'Fees Creation',
    static: true,
    items: [
      {
        to: '/admin-portal/fees-creation',
        label: 'Student Fees Creation',
        icon: 'bi-currency-rupee'
      }
    ]
  },
  {
    title: 'Fees Collection',
    static: true,
    items: [
      {
        to: '/admin-portal/fees-collection',
        label: 'Fees Collection',
        icon: 'bi-cash-stack'
      }
    ]
  },
  {
    title: 'Profile Creation',
    static: true,
    items: [
      {
        to: '/admin-portal/profile-creation',
        label: 'Staff Profile Creation',
        icon: 'bi-person-plus-fill'
      }
    ]
  },
  {
    title: 'Staff Management',
    static: true,
    items: [
      {
        to: '/admin-portal/subject-mapping',
        label: 'Subject Mapping',
        icon: 'bi-person-lines-fill'
      }
    ]
  },

  {
    title: 'Class Time Table',
    static: true,
    items: [
      {
        to: '/admin-portal/class-time-table',
        label: 'Class Time Table',
        icon: 'bi-calendar-date'
      }
    ]
  },
  {
    title: 'Class Time Table Creation',
    static: true,
    items: [
      {
        to: '/admin-portal/class-time-table-creation',
        label: 'Class Time Table Creation',
        icon: 'bi-calendar-plus'
      }
    ]
  }
]

/* ===============================
   PAGE
================================ */
export default function ClassTimeTable() {
  const [academicYears, setAcademicYears] = useState([])
  const [groups, setGroups] = useState([])
  const [courses, setCourses] = useState([])
  const [semesters, setSemesters] = useState([])
  const [subjects, setSubjects] = useState([])

  // Selection States (storing IDs/Values)
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [selectedSemester, setSelectedSemester] = useState('')

  // Layout State
  const [timetable, setTimetable] = useState({}) // { [day]: { [periodKey]: subject_id } }
  const [currentTimetableId, setCurrentTimetableId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Conflict State
  // { [teacherId]: { [day]: { [periodNum]: "Busy details..." } } }
  const [teacherConflicts, setTeacherConflicts] = useState({})

  // Saved Timetables List State
  const [savedTimetables, setSavedTimetables] = useState([])

  // View Modal State
  const [showModal, setShowModal] = useState(false)
  const [modalData, setModalData] = useState(null) // { info: {}, grid: {} }
  const [isPreview, setIsPreview] = useState(false)

  const isGridComplete = useMemo(() => {
    if (!selectedAcademicYear || !selectedGroupId || !selectedCourseId || !selectedSemester) return false
    for (const day of DAYS) {
      for (const slot of TIME_SLOTS) {
        if (slot.type === 'CLASS') {
          if (!timetable[day]?.[slot.key]) return false
        }
      }
    }
    return true
  }, [timetable, selectedAcademicYear, selectedGroupId, selectedCourseId, selectedSemester])

  useEffect(() => {
    fetchAcademicYears()
    fetchGroups()
    fetchSavedTimetables()
  }, [])

  // Auto-fetch data when selections change
  useEffect(() => {
    if (selectedGroupId) {
      fetchCoursesByGroup(selectedGroupId)
    } else {
      setCourses([])
      setSelectedCourseId('')
    }
  }, [selectedGroupId])

  useEffect(() => {
    if (selectedAcademicYear && selectedCourseId) {
      const course = courses.find(c => c.course_id === parseInt(selectedCourseId))
      if (course) {
        fetchSemesters(selectedAcademicYear, course.course_code)
      }
    } else {
      setSemesters([])
      setSelectedSemester('')
    }
  }, [selectedAcademicYear, selectedCourseId])

  useEffect(() => {
    if (selectedAcademicYear && selectedCourseId && selectedSemester) {
      const course = courses.find(c => c.course_id === parseInt(selectedCourseId))
      if (course) {
        // Fetch subjects should also trigger conflict fetching
        fetchSubjects(selectedAcademicYear, course.course_code, selectedSemester)
        // Attempt to load existing timetable
        fetchTimetable(selectedAcademicYear, selectedGroupId, selectedCourseId, selectedSemester)
      }
    } else {
      setSubjects([])
      setTimetable({})
      setCurrentTimetableId(null)
      setTeacherConflicts({})
    }
  }, [selectedAcademicYear, selectedCourseId, selectedSemester])

  // Fetch conflicts whenever subjects or current timetable ID changes
  useEffect(() => {
    if (subjects.length > 0 && selectedAcademicYear) {
      fetchConflicts(subjects, currentTimetableId)
    }
  }, [subjects, currentTimetableId])


  // --- Data Fetching ---

  const fetchAcademicYears = async () => {
    const { data } = await supabase.from('academic_year').select('academic_year')
    setAcademicYears(data || [])
  }

  const fetchGroups = async () => {
    const { data } = await supabase.from('groups').select('group_id, group_name')
    setGroups(data || [])
  }

  const fetchSavedTimetables = async () => {
    try {
      const { data, error } = await supabase
        .from('timetables')
        .select(`
            id,
            academic_year,
            semester,
            group_id,
            course_id,
            groups (group_name),
            courses (course_name, course_code)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setSavedTimetables(data || [])
    } catch (error) {
      console.error('Error fetching saved timetables', error)
    }
  }

  const fetchCoursesByGroup = async (groupId) => {
    const group = groups.find(g => g.group_id === parseInt(groupId))
    if (!group) return

    const { data } = await supabase
      .from('courses')
      .select('course_id, course_name, course_code')
      .eq('group_name', group.group_name)

    setCourses(data || [])
    return data
  }

  const fetchSemesters = async (year, courseName) => {
    const { data } = await supabase
      .from('subjects')
      .select('semester_number')
      .eq('academic_year', year)
      .eq('course_name', courseName)

    const uniqueSems = [...new Set((data || []).map(d => d.semester_number))].sort((a, b) => a - b)
    setSemesters(uniqueSems)
  }

  const fetchSubjects = async (year, courseName, semester) => {
    // 1. Fetch Subjects Base Data
    const { data: subjectData } = await supabase
      .from('subjects')
      .select('*')
      .eq('academic_year', year)
      .eq('course_name', courseName)
      .eq('semester_number', semester)

    if (!subjectData || subjectData.length === 0) {
      setSubjects([])
      return
    }

    // 2. Fetch Teacher Mappings for this specific class
    const { data: mappings } = await supabase
      .from('teacher_subject_mapping')
      .select('subject_id, teacher_id')
      .eq('group_id', selectedGroupId)
      .eq('course_id', selectedCourseId)
      .eq('semester', semester)
      .eq('is_active', true)

    const map = {}
    mappings?.forEach(m => {
      map[m.subject_id] = m.teacher_id
    })

    // Normalize and attach teacher_id
    const mapped = subjectData.map(s => {
      const realId = s.subject_id || s.id
      return {
        ...s,
        real_id: realId,
        teacher_id: map[realId] || null
      }
    })
    setSubjects(mapped)
  }

  const fetchConflicts = async (subjectList, ignoreTimetableId) => {
    setTeacherConflicts({})
    const teacherIds = [...new Set(subjectList.map(s => s.teacher_id).filter(Boolean))]
    if (teacherIds.length === 0) return

    try {
      // A. Get ALL subjects these teachers teach globally
      const { data: allTeacherSubjects } = await supabase
        .from('teacher_subject_mapping')
        .select('teacher_id, subject_id')
        .in('teacher_id', teacherIds)
        .eq('is_active', true)

      if (!allTeacherSubjects || allTeacherSubjects.length === 0) return

      const relevantSubjectIds = [...new Set(allTeacherSubjects.map(s => s.subject_id))]

      // B. Get Timetable Slots for these subjects in current year
      let query = supabase
        .from('timetable_slots')
        .select(`
                 day_of_week, 
                 period_number, 
                 subject_id,
                 timetable_id,
                 timetables!inner(id, academic_year, semester, groups(group_name), courses(course_name))
             `)
        .eq('timetables.academic_year', selectedAcademicYear)
        .in('subject_id', relevantSubjectIds)

      if (ignoreTimetableId) {
        query = query.neq('timetable_id', ignoreTimetableId)
      }

      const { data: slots, error } = await query
      if (error) throw error

      // C. Build Map
      const conflicts = {}
      // Quick lookup: subject_id -> teacher_id
      const subToTeacher = {}
      allTeacherSubjects.forEach(x => subToTeacher[x.subject_id] = x.teacher_id)

      slots.forEach(slot => {
        const tId = subToTeacher[slot.subject_id]
        if (tId) {
          if (!conflicts[tId]) conflicts[tId] = {}
          if (!conflicts[tId][slot.day_of_week]) conflicts[tId][slot.day_of_week] = {}

          const info = `${slot.timetables.groups?.group_name}/${slot.timetables.courses?.course_name}`
          conflicts[tId][slot.day_of_week][slot.period_number] = info
        }
      })

      setTeacherConflicts(conflicts)

    } catch (err) {
      console.error("Error fetching conflicts", err)
    }
  }

  const fetchTimetable = async (year, groupId, courseId, semester) => {
    setLoading(true)
    try {
      // 1. Find the timetable definition
      const { data: ttData, error: ttError } = await supabase
        .from('timetables')
        .select('id')
        .eq('academic_year', year)
        .eq('group_id', groupId)
        .eq('course_id', courseId)
        .eq('semester', semester)
        .maybeSingle()

      if (ttError) throw ttError

      if (!ttData) {
        setTimetable({})
        setCurrentTimetableId(null)
        return
      }

      setCurrentTimetableId(ttData.id)

      // 2. Fetch slots
      const { data: slots, error: slotsError } = await supabase
        .from('timetable_slots')
        .select('*')
        .eq('timetable_id', ttData.id)

      if (slotsError) throw slotsError

      // 3. Map slots to state
      const newTimetable = {}
      DAYS.forEach(day => {
        newTimetable[day] = {}
      })

      slots.forEach(slot => {
        const { day_of_week, period_number, subject_id, slot_type } = slot
        if (slot_type === 'CLASS' && period_number) {
          const slotDef = TIME_SLOTS.find(s => s.periodNum === period_number)
          if (slotDef) {
            if (!newTimetable[day_of_week]) newTimetable[day_of_week] = {}
            newTimetable[day_of_week][slotDef.key] = subject_id
          }
        }
      })
      setTimetable(newTimetable)

    } catch (error) {
      console.error('Error fetching timetable:', error)
      toast.error('Failed to load existing timetable.')
    } finally {
      setLoading(false)
    }
  }

  // --- Handlers ---

  const handleCellChange = (day, key, subjectId) => {
    setTimetable(prev => ({
      ...prev,
      [day]: {
        ...(prev[day] || {}),
        [key]: subjectId
      }
    }))
  }

  const handleBack = () => {
    setSelectedAcademicYear('')
    setSelectedGroupId('')
    setSelectedCourseId('')
    setSelectedSemester('')
    setTimetable({})
    setCurrentTimetableId(null)
    setTeacherConflicts({})
  }

  const handleSave = () => {
    const groupName = groups.find(g => g.group_id == selectedGroupId)?.group_name
    const courseName = courses.find(c => c.course_id == selectedCourseId)?.course_name

    // Construct preview data matching the View Modal structure
    const previewInfo = {
      academic_year: selectedAcademicYear,
      semester: selectedSemester,
      groups: { group_name: groupName },
      courses: { course_name: courseName }
    }

    // Map IDs to Names for Preview
    const previewGrid = {}

    // Create a quick lookup map for subjects
    const subjectMap = {}
    subjects.forEach(s => {
      subjectMap[s.real_id] = s.subject_name
    })

    Object.keys(timetable).forEach(day => {
      previewGrid[day] = {}
      Object.keys(timetable[day]).forEach(slotKey => {
        const subjectId = timetable[day][slotKey]
        if (subjectId) {
          previewGrid[day][slotKey] = subjectMap[subjectId] || 'Unknown'
        }
      })
    })

    setModalData({
      info: previewInfo,
      grid: previewGrid
    })
    setIsPreview(true)
    setShowModal(true)
  }

  const confirmSave = async () => {
    setSaving(true)
    try {
      // 1. Get or Create Timetable ID
      let timetableId = currentTimetableId // reuse if known

      if (!timetableId) {
        // Check again just in case (race condition mostly)
        const { data: existing } = await supabase
          .from('timetables')
          .select('id')
          .eq('academic_year', selectedAcademicYear)
          .eq('group_id', selectedGroupId)
          .eq('course_id', selectedCourseId)
          .eq('semester', selectedSemester)
          .maybeSingle()

        if (existing) {
          timetableId = existing.id
        } else {
          const { data: created, error: createErr } = await supabase
            .from('timetables')
            .insert([{
              academic_year: selectedAcademicYear,
              group_id: selectedGroupId,
              course_id: selectedCourseId,
              semester: parseInt(selectedSemester),
            }])
            .select()
            .single()
          if (createErr) throw createErr
          timetableId = created.id
        }
      }

      // 2. Prepare Slots
      const { error: deleteErr } = await supabase
        .from('timetable_slots')
        .delete()
        .eq('timetable_id', timetableId)

      if (deleteErr) throw deleteErr

      const newSlots = []
      DAYS.forEach(day => {
        const dayData = timetable[day] || {}
        TIME_SLOTS.forEach(slotDef => {
          if (slotDef.type === 'CLASS') {
            const subjectId = dayData[slotDef.key]
            if (subjectId) {
              newSlots.push({
                timetable_id: timetableId,
                day_of_week: day,
                period_number: slotDef.periodNum,
                start_time: slotDef.startTime,
                end_time: slotDef.endTime,
                slot_type: 'CLASS',
                subject_id: subjectId
              })
            }
          }
        })
      })

      if (newSlots.length > 0) {
        const { error: insertErr } = await supabase
          .from('timetable_slots')
          .insert(newSlots)

        if (insertErr) throw insertErr
      }

      toast.success('Timetable saved successfully!')
      fetchSavedTimetables() // Refresh list
      setCurrentTimetableId(timetableId) // Ensure state is synced

      // Refresh conflicts because now THESE slots are officially booked
      fetchConflicts(subjects, timetableId)

      // Close modal and exit preview mode
      setShowModal(false)
      setIsPreview(false)

    } catch (error) {
      console.error('Error saving timetable:', error)
      toast.error('Failed to save timetable: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadPDF = async () => {
    const input = document.getElementById('timetable-print-area')
    if (!input) return

    try {
      const canvas = await html2canvas(input, { scale: 2 })
      const imgData = canvas.toDataURL('image/png')

      const pdf = new jsPDF('l', 'mm', 'a4') // Landscape
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()

      const imgWidth = pdfWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let finalWidth = imgWidth
      let finalHeight = imgHeight

      if (finalHeight > pdfHeight) {
        const ratio = pdfHeight / finalHeight
        finalHeight = pdfHeight
        finalWidth = finalWidth * ratio
      }

      const x = (pdfWidth - finalWidth) / 2
      const y = (pdfHeight - finalHeight) / 2

      pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight)
      pdf.save(`Timetable_${modalData.info.groups?.group_name}_${modalData.info.courses?.course_name}.pdf`)

      toast.success('PDF downloaded successfully')
    } catch (error) {
      console.error('Error generating PDF', error)
      toast.error('Failed to generate PDF')
    }
  }

  const handleViewTimetable = async (tt) => {
    try {
      setLoading(true)
      const { data: slots, error } = await supabase
        .from('timetable_slots')
        .select(`*, subjects (subject_name)`)
        .eq('timetable_id', tt.id)

      if (error) throw error

      const grid = {}
      DAYS.forEach(day => { grid[day] = {} })

      slots?.forEach(slot => {
        if (slot.slot_type === 'CLASS' && slot.period_number) {
          const slotDef = TIME_SLOTS.find(s => s.periodNum === slot.period_number)
          if (slotDef) {
            if (!grid[slot.day_of_week]) grid[slot.day_of_week] = {}
            grid[slot.day_of_week][slotDef.key] = slot.subjects?.subject_name || 'Unknown'
          }
        }
      })

      setModalData({ info: tt, grid: grid })
      setShowModal(true)
    } catch (error) {
      console.error('Error viewing timetable', error)
      toast.error('Could not load timetable details')
    } finally {
      setLoading(false)
    }
  }

  const handleEditTimetable = async (tt) => {
    try {
      setLoading(true)
      // 1. Set selections
      setSelectedAcademicYear(tt.academic_year)
      setSelectedGroupId(tt.group_id)

      // Manually fetch to ensure data availability
      // Note: The effects will also trigger, but explicit fetch helps ensure sequence if needed
      await fetchCoursesByGroup(tt.group_id)
      setSelectedCourseId(tt.course_id)

      if (tt.courses?.course_code) {
        await fetchSemesters(tt.academic_year, tt.courses.course_code)
      }
      setSelectedSemester(tt.semester)

      // 2. Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' })
      toast.info('Loaded timetable for editing')

    } catch (error) {
      console.error('Error loading for edit', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTimetable = async (id) => {
    if (!window.confirm('Are you sure you want to delete this timetable?')) return

    try {
      const { error } = await supabase.from('timetables').delete().eq('id', id)
      if (error) throw error
      toast.success('Timetable deleted')
      fetchSavedTimetables()

      if (currentTimetableId === id) {
        setTimetable({})
        setCurrentTimetableId(null)
        setTeacherConflicts({})
      }
    } catch (error) {
      console.error('Error deleting timetable', error)
      toast.error('Failed to delete timetable')
    }
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setModalData(null)
  }

  const canShowGrid = selectedSemester && subjects.length > 0
  const hasFilters = selectedAcademicYear && selectedGroupId && selectedCourseId && selectedSemester

  return (
    <AdminShell
      navGroups={adminNavGroups}
      brandTitle="Admin Management Console"
      brandSubtitle="Chittoor"
      footerTitle="Admin Management Studio"
      footerSubtitle="Crafted for Vijayam College"
    >
      <style>{`
        .tt-wrapper { border: 2px solid #1f2937; }
        table.tt-table { border-collapse: collapse; width: 100%; table-layout: auto; }
        .tt-table th, .tt-table td { border: 1px solid #1f2937; padding: 8px; vertical-align: middle; }
        thead th { white-space: normal; text-align: center; }
        .tt-head-title { display: block; font-size: 0.8rem; font-weight: 600; }
        .tt-head-time { display: block; font-size: 0.7rem; color: #6b7280; margin-top: 4px; }
        .tt-day { background: #f8fafc; fontWeight: 600; width: 130px; }
        .tt-period { width: auto; }
        .tt-select { width: 100%; min-height: 38px; height: auto; padding: 6px 12px; font-size: 0.9rem; line-height: 1.2; white-space: normal; overflow: visible; }
        .tt-break, .tt-lunch { width: 34px; min-width: 34px; padding: 0; text-align: center; font-weight: 800; vertical-align: middle; font-size: 0.85rem; }
        .tt-break { background: #fff3cd; color: #92400e; }
        .tt-lunch { background: #dbeafe; color: #1e3a8a; }
      `}</style>

      <div className="desktop-container" style={{ overflowX: 'hidden' }}>
        <section className="setup-hero mb-4 text-center">
          <div className="setup-hero-copywrap mx-auto text-center" style={{ maxWidth: '640px' }}>
            <div className="admin-applications__crest mx-auto" aria-hidden="true">
              <img src={crestPrimary} alt="Vijayam crest" />
            </div>
            <h3 className="setup-hero-title mb-2">Vijayam Arts & Science College</h3>
            <p className="setup-hero-copy mb-3">Plan weekly class schedules and keep teaching slots organized.</p>
            <div className="setup-hero-chips d-flex flex-wrap gap-2 justify-content-center">
              <span className="setup-hero-chip text-uppercase">SMART EXAMINATION PLATFORM</span>
              <span className="setup-hero-chip text-uppercase">ACADEMIC OPERATIONS</span>
              <span className="setup-hero-chip text-uppercase">TIMETABLE CONTROL</span>
            </div>
          </div>
        </section>

        {/* Input Section */}
        <div className="card card-soft p-4 mb-4">
          <div className="row g-3">
            <div className="col-md-3">
              <label className="form-label fw-semibold">Academic Year</label>
              <select className="form-select" value={selectedAcademicYear} onChange={e => setSelectedAcademicYear(e.target.value)}>
                <option value="">Select Academic Year</option>
                {academicYears.map(y => <option key={y.academic_year} value={y.academic_year}>{y.academic_year}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold">Group</label>
              <select className="form-select" value={selectedGroupId} onChange={e => setSelectedGroupId(e.target.value)}>
                <option value="">Select Group</option>
                {groups.map(g => <option key={g.group_id} value={g.group_id}>{g.group_name}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold">Course</label>
              <select className="form-select" value={selectedCourseId} onChange={e => setSelectedCourseId(e.target.value)} disabled={!selectedGroupId}>
                <option value="">Select Course</option>
                {courses.map(c => <option key={c.course_id} value={c.course_id}>{c.course_name}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold">Semester</label>
              <select className="form-select" value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)} disabled={!selectedCourseId}>
                <option value="">Select Semester</option>
                {semesters.map(s => <option key={s} value={s}>Semester {s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Timetable Grid */}
        {canShowGrid ? (
          <div className="card card-soft tt-wrapper mb-5">
            <div className="p-4 pb-5">
              <table className="tt-table text-center">
                <thead>
                  <tr>
                    <th>DAY</th>
                    {TIME_SLOTS.map(slot => (
                      <th key={slot.key}>
                        <div className="tt-head-title">{slot.label}</div>
                        <div className="tt-head-time">{slot.displayTime}</div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {DAYS.map((day, i) => (
                    <tr key={day}>
                      <th className="tt-day">{day}</th>
                      {TIME_SLOTS.map(slot => {
                        if (slot.type === 'BREAK') return <td key={slot.key} className="tt-break">{BREAK_LETTERS[i]}</td>
                        if (slot.type === 'LUNCH') return <td key={slot.key} className="tt-lunch">{LUNCH_LETTERS[i]}</td>

                        return (
                          <td key={slot.key} className="tt-period">
                            <select
                              className="form-select tt-select"
                              value={timetable[day]?.[slot.key] || ''}
                              onChange={e => handleCellChange(day, slot.key, e.target.value)}
                            >
                              <option value="">Select Subject</option>
                              {subjects.map(s => {
                                const conflict = s.teacher_id ? teacherConflicts[s.teacher_id]?.[day]?.[slot.periodNum] : null
                                const isBusy = !!conflict

                                const displayText = isBusy
                                  ? `${s.subject_name} (Busy: ${conflict})`
                                  : s.subject_name

                                return (
                                  <option
                                    key={s.real_id}
                                    value={s.real_id}
                                    title={isBusy ? `Teacher Busy in: ${conflict}` : s.subject_name}
                                    disabled={isBusy}
                                    style={isBusy ? { color: '#dc3545', fontWeight: 'bold' } : {}}
                                  >
                                    {displayText}
                                  </option>
                                )
                              })}
                            </select>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="d-flex justify-content-end p-4 border-top gap-2">
              <button className="btn btn-outline-secondary" onClick={handleBack}>
                Back
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !isGridComplete}>
                {saving ? 'Saving...' : (currentTimetableId ? 'Update Timetable' : 'Save Timetable')}
              </button>
            </div>
          </div>
        ) : (
          <div className="card card-soft p-4 text-center text-muted mb-4">
            <div className="mb-2">
              <i className="bi bi-calendar2-range fs-2"></i>
            </div>
            <h5 className="mb-1">No timetable yet</h5>
            <p className="mb-0 small">
              {hasFilters ? 'No subjects found for this selection.' : 'Select filters to build the timetable.'}
            </p>
          </div>
        )}

        {/* Saved Timetables List */}
        {savedTimetables.length > 0 && (
          <div className="card card-soft p-4">
            <h5 className="mb-4">Saved Class Timetables</h5>
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Academic Year</th>
                    <th>Group</th>
                    <th>Course</th>
                    <th>Semester</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {savedTimetables.map(tt => (
                    <tr key={tt.id}>
                      <td>{tt.academic_year}</td>
                      <td>{tt.groups?.group_name}</td>
                      <td>{tt.courses?.course_name}</td>
                      <td>Semester {tt.semester}</td>
                      <td className="text-end">
                        <button className="btn btn-sm btn-outline-secondary me-2" onClick={() => handleEditTimetable(tt)} title="Edit">
                          <i className="bi bi-pencil"></i> Edit
                        </button>
                        <button className="btn btn-sm btn-outline-primary me-2" onClick={() => handleViewTimetable(tt)} title="View Details">
                          <i className="bi bi-eye"></i> View
                        </button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteTimetable(tt.id)} title="Delete">
                          <i className="bi bi-trash"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW MODAL */}
        {showModal && modalData && (
          <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-xl modal-dialog-scrollable">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    {isPreview ? 'Preview Timetable' : 'Timetable View'} &mdash; {modalData.info.groups?.group_name}, {modalData.info.courses?.course_name} (Sem {modalData.info.semester})
                  </h5>
                  <button type="button" className="btn-close" onClick={handleCloseModal}></button>
                </div>
                <div className="modal-body p-4" id="timetable-print-area">
                  <div className="text-center mb-4">
                    <h5>Class Timetable - {modalData.info.academic_year}</h5>
                    <p className="mb-0 fw-bold">{modalData.info.groups?.group_name} | {modalData.info.courses?.course_name} | Semester {modalData.info.semester}</p>
                  </div>

                  <div className="tt-wrapper">
                    <table className="tt-table text-center">
                      <thead>
                        <tr>
                          <th>DAY</th>
                          {TIME_SLOTS.map(slot => (
                            <th key={slot.key}>
                              <div className="tt-head-title">{slot.label}</div>
                              <div className="tt-head-time">{slot.displayTime}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {DAYS.map((day, i) => (
                          <tr key={day}>
                            <th className="tt-day">{day}</th>

                            {TIME_SLOTS.map(slot => {
                              if (slot.type === 'BREAK') return <td key={slot.key} className="tt-break">{BREAK_LETTERS[i]}</td>
                              if (slot.type === 'LUNCH') return <td key={slot.key} className="tt-lunch">{LUNCH_LETTERS[i]}</td>
                              return (
                                <td key={slot.key} className="tt-period text-center">
                                  <div className="fw-bold small">
                                    {modalData.grid[day]?.[slot.key] || '-'}
                                  </div>
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="modal-footer">
                  {isPreview ? (
                    <>
                      <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>Keep Editing</button>
                      <button type="button" className="btn btn-primary" onClick={confirmSave} disabled={saving}>
                        {saving ? 'Saving...' : 'Confirm & Save'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="btn btn-success" onClick={handleDownloadPDF}>
                        <i className="bi bi-file-earmark-pdf me-2"></i> Download PDF
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>Close</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        <ToastContainer position="top-right" autoClose={3000} />
      </div>
    </AdminShell>
  )
}

