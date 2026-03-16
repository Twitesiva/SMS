import { useEffect, useMemo, useState } from 'react'
import AdShellAdmin from '../../components/AdShellAdmin'
import { supabase } from '../../../supabaseClient'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { useAuth } from '../../store/auth'
import './Setup.css'
import './AdminContent.css'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

const SLOT_TEMPLATE_8 = [
  { key: 'p1', label: 'P1', start: '10:00:00', end: '10:40:00', periodNumber: 1, periodType: 'class' },
  { key: 'p2', label: 'P2', start: '10:40:00', end: '11:20:00', periodNumber: 2, periodType: 'class' },
  { key: 'b1', label: 'Break', start: '11:20:00', end: '11:25:00', periodNumber: null, periodType: 'break' },
  { key: 'p3', label: 'P3', start: '11:25:00', end: '12:05:00', periodNumber: 3, periodType: 'class' },
  { key: 'p4', label: 'P4', start: '12:05:00', end: '12:45:00', periodNumber: 4, periodType: 'class' },
  { key: 'l1', label: 'Lunch', start: '12:45:00', end: '13:10:00', periodNumber: null, periodType: 'lunch' },
  { key: 'p5', label: 'P5', start: '13:10:00', end: '13:50:00', periodNumber: 5, periodType: 'class' },
  { key: 'p6', label: 'P6', start: '13:50:00', end: '14:30:00', periodNumber: 6, periodType: 'class' },
  { key: 'b2', label: 'Break', start: '14:30:00', end: '14:35:00', periodNumber: null, periodType: 'break' },
  { key: 'p7', label: 'P7', start: '14:35:00', end: '15:15:00', periodNumber: 7, periodType: 'class' },
  { key: 'p8', label: 'P8', start: '15:15:00', end: '15:55:00', periodNumber: 8, periodType: 'class' }
]

const SLOT_TEMPLATE_6 = [
  { key: 'p1', label: 'P1', start: '10:00:00', end: '10:40:00', periodNumber: 1, periodType: 'class' },
  { key: 'p2', label: 'P2', start: '10:40:00', end: '11:20:00', periodNumber: 2, periodType: 'class' },
  { key: 'b1', label: 'Break', start: '11:20:00', end: '11:25:00', periodNumber: null, periodType: 'break' },
  { key: 'p3', label: 'P3', start: '11:25:00', end: '12:05:00', periodNumber: 3, periodType: 'class' },
  { key: 'p4', label: 'P4', start: '12:05:00', end: '12:45:00', periodNumber: 4, periodType: 'class' },
  { key: 'l1', label: 'Lunch', start: '12:45:00', end: '13:10:00', periodNumber: null, periodType: 'lunch' },
  { key: 'p5', label: 'P5', start: '13:10:00', end: '13:50:00', periodNumber: 5, periodType: 'class' },
  { key: 'p6', label: 'P6', start: '13:50:00', end: '14:30:00', periodNumber: 6, periodType: 'class' }
]

const getSlotTemplate = (classNumber) => (classNumber >= 10 ? SLOT_TEMPLATE_6 : SLOT_TEMPLATE_8)

const isActivitySlotValid = (classNumber, periodNumber) => {
  if (classNumber >= 1 && classNumber <= 5) {
    return periodNumber >= 1 && periodNumber <= 4
  }
  if (classNumber >= 6 && classNumber <= 9) {
    return periodNumber >= 5 && periodNumber <= 8
  }
  return true
}

export default function ClassTimeTable() {
  const { user } = useAuth()
  const isAdmin = String(user?.role || '').toUpperCase() === 'ADMIN'

  const [sessions, setSessions] = useState([])
  const [classes, setClasses] = useState([])
  const [sections, setSections] = useState([])
  const [subjects, setSubjects] = useState([])
  const [subjectStaffMap, setSubjectStaffMap] = useState({})
  const [staffNameMap, setStaffNameMap] = useState({})

  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedClassNumber, setSelectedClassNumber] = useState(0)
  const [selectedClassName, setSelectedClassName] = useState('')
  const [selectedSectionId, setSelectedSectionId] = useState('')
  const [selectedSectionCode, setSelectedSectionCode] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState(null)

  const [grid, setGrid] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const selectedSession = useMemo(
    () => sessions.find((row) => String(row.id) === String(selectedSessionId)) || null,
    [sessions, selectedSessionId]
  )

  const classNumberById = useMemo(
    () =>
      classes.reduce((acc, row) => {
        acc[row.id] = Number(row.class_number || 0)
        return acc
      }, {}),
    [classes]
  )

  const slots = useMemo(() => getSlotTemplate(selectedClassNumber), [selectedClassNumber])

  useEffect(() => {
    const loadInitial = async () => {
      try {
        setLoading(true)
        const [{ data: sessionRows, error: sessionError }, { data: classRows, error: classError }, { data: staffRows, error: staffError }] = await Promise.all([
          supabase.from('timetable_sessions').select('*').order('created_at', { ascending: false }),
          supabase.from('classes').select('id, class_name, class_number, category_id').order('class_number', { ascending: true }),
          supabase.from('staff').select('id, full_name')
        ])

        if (sessionError) throw sessionError
        if (classError) throw classError
        if (staffError) throw staffError

        setSessions(sessionRows || [])
        setClasses(classRows || [])
        setStaffNameMap((staffRows || []).reduce((acc, row) => {
          acc[row.id] = row.full_name || `Staff ${row.id}`
          return acc
        }, {}))
      } catch (error) {
        console.error('Error loading timetable data', error)
        toast.error('Failed to load timetable data')
      } finally {
        setLoading(false)
      }
    }

    loadInitial()
  }, [])

  useEffect(() => {
    if (!selectedClassId) {
      setSections([])
      setSelectedSectionId('')
      setSelectedSectionCode('')
      return
    }

    const loadSections = async () => {
      try {
        const { data, error } = await supabase
          .from('class_sections')
          .select('id, class_id, section_id, sections(id, section_name, group_id)')
          .eq('class_id', Number(selectedClassId))
          .order('id')
        if (error) throw error
        setSections((data || []).map((row) => ({
          id: row.id,
          class_id: row.class_id,
          section_id: row.section_id,
          section_name: row.sections?.section_name || '',
          group_id: row.sections?.group_id || null,
        })))
      } catch (error) {
        console.error('Error loading sections', error)
        toast.error('Failed to load sections')
      }
    }

    loadSections()
  }, [selectedClassId])

  useEffect(() => {
    const canLoad = selectedSession && selectedClassId && selectedSectionId && selectedSectionCode
    if (!canLoad) {
      setSubjects([])
      setSubjectStaffMap({})
      setGrid({})
      return
    }

    const loadSubjectAndGrid = async () => {
      try {
        setLoading(true)
        const term = Number(selectedSession.term)
        const termString = selectedClassNumber >= 10 ? 'Full Year' : `Term ${term}`;
        const isHigherSecondary = selectedClassNumber === 11 || selectedClassNumber === 12;

        let subjectsQuery = supabase
          .from('subjects')
          .select('id, subject_title, subject_code, subject_categories!subjects_category_id_fkey(category_name)')
          .eq('class_id', Number(selectedClassId))
          .eq('term', termString);
        
        if (isHigherSecondary && selectedGroupId) {
          subjectsQuery = subjectsQuery.eq('group_id', selectedGroupId);
        } else {
          subjectsQuery = subjectsQuery.is('group_id', null);
        }

        // Subjects now apply to class/group level (section_id is null in subjects table)
        subjectsQuery = subjectsQuery.is('section_id', null);

        const [{ data: subjectRows, error: subjectError }, { data: mappingRows, error: mappingError }] = await Promise.all([
          subjectsQuery.order('subject_title'),
          supabase
            .from('staff_subjects')
            .select('subject_id, staff_id')
        ])

        if (subjectError) throw subjectError
        if (mappingError) throw mappingError

        setSubjects((subjectRows || []).map(s => ({
            subject_id: s.id,
            subject_name: s.subject_title,
            subject_code: s.subject_code,
            subject_type: s.subject_categories?.category_name || ''
        })))

        const nextStaffMap = {}
        ;(mappingRows || []).forEach((row) => {
          if (row.subject_id && row.staff_id) {
            nextStaffMap[row.subject_id] = row.staff_id
          }
        })
        setSubjectStaffMap(nextStaffMap)

        const { data: existingRows, error: existingError } = await supabase
          .from('timetable_session_classes')
          .select('day_of_week, period_number, subject_id, period_type')
          .eq('session_id', Number(selectedSessionId))
          .eq('class_id', Number(selectedClassId))
          .eq('section_id', Number(selectedSectionId))
          .eq('term', term)

        if (existingError) throw existingError

        const nextGrid = {}
        DAYS.forEach((day) => {
          nextGrid[day] = {}
        })

        ;(existingRows || []).forEach((row) => {
          if (String(row.period_type || '').toLowerCase() !== 'class') return
          const key = `p${row.period_number}`
          if (!nextGrid[row.day_of_week]) nextGrid[row.day_of_week] = {}
          nextGrid[row.day_of_week][key] = row.subject_id
        })

        setGrid(nextGrid)
      } catch (error) {
        console.error('Error loading subject and timetable grid', error)
        toast.error('Failed to load timetable details')
      } finally {
        setLoading(false)
      }
    }

    loadSubjectAndGrid()
  }, [selectedSession, selectedSessionId, selectedClassId, selectedSectionId, selectedSectionCode])

  const handleCellChange = (day, key, subjectId) => {
    setGrid((prev) => ({
      ...prev,
      [day]: {
        ...(prev[day] || {}),
        [key]: subjectId,
      }
    }))
  }

  const classSlots = useMemo(() => slots.filter((slot) => slot.periodType === 'class'), [slots])

  const isGridComplete = useMemo(() => {
    if (!selectedSession || !selectedClassId || !selectedSectionId) return false
    for (const day of DAYS) {
      for (const slot of classSlots) {
        if (!grid[day]?.[slot.key]) return false
      }
    }
    return true
  }, [selectedSession, selectedClassId, selectedSectionId, classSlots, grid])

  const validateBeforeSave = async () => {
    const term = Number(selectedSession.term)
    const subjectById = subjects.reduce((acc, row) => {
      acc[row.subject_id] = row
      return acc
    }, {})

    const entries = []
    for (const day of DAYS) {
      for (const slot of classSlots) {
        const subjectId = grid[day]?.[slot.key]
        if (!subjectId) {
          throw new Error('All class periods must have a subject assigned before saving.')
        }

        const staffId = subjectStaffMap[subjectId]
        if (!staffId) {
          const subjectName = subjectById[subjectId]?.subject_name || 'Selected subject'
          throw new Error(`${subjectName} has no staff mapping. Please assign staff in Subject Mapping for Staff.`)
        }

        entries.push({
          day,
          periodNumber: slot.periodNumber,
          subjectId,
          staffId,
        })
      }
    }

    for (const day of DAYS) {
      const countBySubject = {}
      entries
        .filter((row) => row.day === day)
        .forEach((row) => {
          countBySubject[row.subjectId] = (countBySubject[row.subjectId] || 0) + 1
        })

      const exceeded = Object.entries(countBySubject).find(([, count]) => count > 2)
      if (exceeded) {
        const [subjectId] = exceeded
        const subjectName = subjectById[subjectId]?.subject_name || `Subject ${subjectId}`
        throw new Error(`${subjectName} exceeds the daily limit (max 2 periods per day).`)
      }
    }

    if (selectedClassNumber >= 1 && selectedClassNumber <= 9) {
      const fridayEntries = entries.filter((row) => row.day === 'Friday')
      const hasValidActivity = fridayEntries.some((row) => {
        const subject = subjectById[row.subjectId]
        if (!subject || String(subject.subject_type || '').toLowerCase() !== 'activity') return false
        return isActivitySlotValid(selectedClassNumber, row.periodNumber)
      })

      if (!hasValidActivity) {
        if (selectedClassNumber <= 5) {
          throw new Error('Friday activity is required in first half (P1-P4) for Classes 1-5.')
        }
        throw new Error('Friday activity is required in second half (P5-P8) for Classes 6-9.')
      }
    }

    const staffIds = [...new Set(entries.map((row) => row.staffId))]

    if (staffIds.length) {
      const { data: conflictRows, error: conflictError } = await supabase
        .from('timetable_session_classes')
        .select('day_of_week, period_number, staff_id, class_id, subject_id')
        .eq('session_id', Number(selectedSessionId))
        .eq('term', term)
        .in('staff_id', staffIds)
        .eq('period_type', 'class')
        .neq('class_id', Number(selectedClassId))

      if (conflictError) throw conflictError

      const conflictMap = new Map()
      ;(conflictRows || []).forEach((row) => {
        const key = `${row.staff_id}__${row.day_of_week}__${row.period_number}`
        const list = conflictMap.get(key) || []
        list.push(row)
        conflictMap.set(key, list)
      })

      for (const entry of entries) {
        const key = `${entry.staffId}__${entry.day}__${entry.periodNumber}`
        const clashes = conflictMap.get(key) || []
        if (clashes.length === 0) continue

        const allowed = clashes.every((clash) => {
          const otherClass = Number(classNumberById[clash.class_id] || 0)
          const sameSubject = Number(clash.subject_id) === Number(entry.subjectId)
          return selectedClassNumber >= 10 && otherClass >= 10 && sameSubject
        })

        if (!allowed) {
          const staffName = staffNameMap[entry.staffId] || 'Staff'
          throw new Error(`${staffName} has a clash on ${entry.day} P${entry.periodNumber}.`)
        }
      }

      const { data: workloadRows, error: workloadError } = await supabase
        .from('timetable_session_classes')
        .select('staff_id')
        .eq('session_id', Number(selectedSessionId))
        .eq('term', term)
        .in('staff_id', staffIds)
        .eq('period_type', 'class')
        .neq('class_id', Number(selectedClassId))

      if (workloadError) throw workloadError

      const counts = {}
      ;(workloadRows || []).forEach((row) => {
        counts[row.staff_id] = (counts[row.staff_id] || 0) + 1
      })
      entries.forEach((entry) => {
        counts[entry.staffId] = (counts[entry.staffId] || 0) + 1
      })

      const invalidWorkload = Object.entries(counts).find(([, count]) => count < 28 || count > 35)
      if (invalidWorkload) {
        const [staffId, count] = invalidWorkload
        const name = staffNameMap[staffId] || `Staff ${staffId}`
        throw new Error(`${name} workload is ${count} periods/week. Allowed range is 28 to 35.`)
      }
    }

    return entries
  }

  const saveTimetable = async () => {
    if (!isAdmin) {
      toast.error('Only Admin users can create or modify timetables.')
      return
    }

    if (!selectedSession || !selectedClassId || !selectedSectionId) {
      toast.warning('Select session, class and section first.')
      return
    }

    setSaving(true)
    try {
      const entries = await validateBeforeSave()
      const term = Number(selectedSession.term)

      const { error: deleteError } = await supabase
        .from('timetable_session_classes')
        .delete()
        .eq('session_id', Number(selectedSessionId))
        .eq('class_id', Number(selectedClassId))
        .eq('section_id', Number(selectedSectionId))
        .eq('term', term)

      if (deleteError) throw deleteError

      const rows = []
      for (const day of DAYS) {
        for (const slot of slots) {
          const row = {
            session_id: Number(selectedSessionId),
            class_id: Number(selectedClassId),
            section_id: Number(selectedSectionId),
            term,
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
      console.error('Error saving timetable', error)
      toast.error(error.message || 'Failed to save timetable')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdShellAdmin
      brandTitle="ADMIN PORTAL"
      footerTitle="Admin Management Studio"
      footerSubtitle="Crafted for Vijayam College"
    >
      <div className="desktop-container" style={{ overflowX: 'hidden' }}>
        <h4 className="mb-4">Class Time Table</h4>

        {!isAdmin && (
          <div className="alert alert-danger mb-3">Only Admin users can create and modify timetables.</div>
        )}

        <div className="card card-soft p-4 mb-4">
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label fw-semibold">Timetable Session</label>
              <select
                className="form-select"
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
              >
                <option value="">Select Session</option>
                {sessions.map((row) => (
                  <option key={row.id} value={row.id}>{row.session_name} - {row.academic_year} (Term {row.term})</option>
                ))}
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label fw-semibold">Class</label>
              <select
                className="form-select"
                value={selectedClassId}
                onChange={(e) => {
                  const selected = classes.find((row) => String(row.id) === String(e.target.value))
                  setSelectedClassId(e.target.value)
                  setSelectedClassNumber(Number(selected?.class_number || 0))
                  setSelectedClassName(selected?.class_name || '')
                  setSelectedSectionId('')
                  setSelectedSectionCode('')
                }}
              >
                <option value="">Select Class</option>
                {classes.map((row) => (
                  <option key={row.id} value={row.id}>{row.class_name}</option>
                ))}
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label fw-semibold">Section</label>
              <select
                className="form-select"
                value={selectedSectionId}
                onChange={(e) => {
                  const selected = sections.find((row) => String(row.section_id) === String(e.target.value))
                  setSelectedSectionId(e.target.value)
                  setSelectedSectionCode(selected?.section_name || '')
                  setSelectedGroupId(selected?.group_id || null)
                }}
                disabled={!selectedClassId}
              >
                <option value="">Select Section</option>
                {sections.map((row) => (
                  <option key={row.section_id} value={row.section_id}>{row.section_name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {selectedSession && selectedClassId && selectedSectionId ? (
          <div className="card card-soft p-4 mb-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0">Timetable Grid ({selectedClassNumber >= 10 ? '6 periods/day' : '8 periods/day'})</h5>
              <button className="btn btn-primary" onClick={saveTimetable} disabled={!isAdmin || saving || loading || !isGridComplete}>
                {saving ? 'Saving...' : 'Save Timetable'}
              </button>
            </div>

            <div className="table-responsive">
              <table className="table table-bordered align-middle text-center">
                <thead className="table-light">
                  <tr>
                    <th>Day</th>
                    {slots.map((slot) => (
                      <th key={slot.key}>{slot.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map((day) => (
                    <tr key={day}>
                      <th>{day}</th>
                      {slots.map((slot) => {
                        if (slot.periodType !== 'class') {
                          return (
                            <td key={`${day}-${slot.key}`} className={slot.periodType === 'break' ? 'table-warning' : 'table-info'}>
                              {slot.label}
                            </td>
                          )
                        }

                        return (
                          <td key={`${day}-${slot.key}`}>
                            <select
                              className="form-select"
                              value={grid[day]?.[slot.key] || ''}
                              onChange={(e) => handleCellChange(day, slot.key, e.target.value)}
                            >
                              <option value="">Select Subject</option>
                              {subjects.map((subject) => (
                                <option key={subject.subject_id} value={subject.subject_id}>
                                  {(subject.subject_code ? `${subject.subject_code} - ` : '') + subject.subject_name}
                                </option>
                              ))}
                            </select>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="card card-soft p-4 text-center text-muted mb-4">
            Select session, class and section to build timetable.
          </div>
        )}
      </div>
      <ToastContainer position="top-right" autoClose={3000} />
    </AdShellAdmin>
  )
}
