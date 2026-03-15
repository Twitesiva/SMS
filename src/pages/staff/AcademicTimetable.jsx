import { useEffect, useState } from 'react'
import StaffShell from '../../components/StaffShell'
import { supabase } from '../../../supabaseClient'
import { useStaffAuth } from '../../store/staffAuth'
import './StaffPortal.css'


/* ===============================
   CONSTANTS
================================ */
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

const BREAK_LETTERS = ['B', 'R', 'E', 'A', 'K']
const LUNCH_LETTERS = ['L', 'U', 'N', 'C', 'H']

const TIME_SLOTS = [
  { key: 'p1', label: 'PERIOD 1', time: '9:00 AM – 10:10 AM', type: 'period', period: 1 },
  { key: 'b1', label: 'BREAK', time: '10:10 AM – 10:20 AM', type: 'break' },
  { key: 'p2', label: 'PERIOD 2', time: '10:20 AM – 11:30 AM', type: 'period', period: 2 },
  { key: 'p3', label: 'PERIOD 3', time: '11:30 AM – 12:40 PM', type: 'period', period: 3 },
  { key: 'lunch', label: 'LUNCH', time: '12:40 PM – 1:40 PM', type: 'lunch' },
  { key: 'p4', label: 'PERIOD 4', time: '1:40 PM – 2:50 PM', type: 'period', period: 4 },
  { key: 'b2', label: 'BREAK', time: '2:50 PM – 3:00 PM', type: 'break' },
  { key: 'p5', label: 'PERIOD 5', time: '3:00 PM – 4:00 PM', type: 'period', period: 5 }
]

const normalizeDay = (day) =>
  day.charAt(0).toUpperCase() + day.slice(1).toLowerCase()

/* ===============================
   PAGE
================================ */
export default function StaffTimetable() {
  const { staff } = useStaffAuth()
  const [tableData, setTableData] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (staff?.staff_id) {
      loadTimetable()
    }
  }, [staff])

  /* ===============================
     DATA LOADING
  ================================ */
  const loadTimetable = async () => {
    setLoading(true)
    // 1️⃣ Resolve teacher numeric ID
    const { data: teacher } = await supabase
      .from('teachers')
      .select('id')
      .eq('staff_id', staff.staff_id)
      .single()

    if (!teacher) {
      setLoading(false)
      return
    }

    // 2️⃣ Get teacher subject mappings (THIS IS SOURCE OF TRUTH)
    const { data: mappings } = await supabase
      .from('teacher_subject_mapping')
      .select(`
        subject_id,
        course_id,
        group_id,
        semester,
        subjects ( subject_name ),
        sections ( section_name as course_name ),
        classes ( class_name as group_name )
      `)
      .eq('teacher_id', teacher.id)
      .eq('is_active', true)

    if (!mappings?.length) {
      setLoading(false)
      return
    }

    // Build subject map
    const subjectMap = {}
    mappings.forEach(m => {
      subjectMap[m.subject_id] = {
        subject: m.subjects?.subject_name || '',
        course: m.courses?.course_name || '',
        group: m.groups?.group_name || '',
        semester: m.semester
      }
    })


    // 3️⃣ Find matching timetables
    const { data: timetables } = await supabase
      .from('timetables')
      .select('id')
      .in('course_id', mappings.map(m => m.course_id))
      .in('group_id', mappings.map(m => m.group_id))
      .in('semester', mappings.map(m => m.semester))

    if (!timetables?.length) {
      setLoading(false)
      return
    }

    const timetableIds = timetables.map(t => t.id)

    // 4️⃣ Fetch timetable slots
    const { data: slots } = await supabase
      .from('timetable_slots')
      .select('day_of_week, period_number, subject_id')
      .in('timetable_id', timetableIds)
      .in('subject_id', Object.keys(subjectMap))

    if (!slots?.length) {
      setLoading(false)
      return
    }

    // 5️⃣ Build table data
    const table = {}

    slots.forEach(slot => {
      const day = normalizeDay(slot.day_of_week)
      const period = Number(slot.period_number)

      if (!DAYS.includes(day)) return
      if (![1, 2, 3, 4, 5].includes(period)) return

      if (!table[day]) table[day] = {}

      table[day][period] = subjectMap[slot.subject_id]
    })

    setTableData(table)
    setLoading(false)
  }

  /* ===============================
     RENDER
  ================================ */
  return (
    <StaffShell>
      <style>{`
        .tt-wrapper {
          border: 2px solid #1f2937;
          background: #fff;
          border-radius: 14px;
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .table-responsive {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          width: 100%;
        }

        table.tt-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          min-width: 1000px; /* Ensure scrolling on mobile */
        }

        .tt-table th,
        .tt-table td {
          border: 1px solid #1f2937;
          padding: 10px;
          text-align: center;
          vertical-align: middle;
        }

        .tt-head-title {
          display: block;
          font-size: 0.85rem;
          font-weight: 600;
        }

        .tt-head-time {
          display: block;
          font-size: 0.7rem;
          color: #6b7280;
          margin-top: 4px;
        }

        .tt-day {
          background: #f8fafc;
          font-weight: 600;
          width: 140px;
        }

        .tt-period {
          font-size: 0.9rem;
        }

        .tt-break {
          background: #fff3cd;
          color: #92400e;
          font-weight: 800;
          width: 36px;
        }

        .tt-lunch {
          background: #dbeafe;
          color: #1e3a8a;
          font-weight: 800;
          width: 36px;
        }
      `}</style>

      <div className="students-section-shell">
        <div className="student-card mb-4">
          <div className="student-card__header">Academic Timetable</div>
          <div className="student-card__body">
            <p className="students-section-copy mb-0">View your weekly teaching schedule.</p>
          </div>
        </div>

        {loading && (
          <div className="student-details__loading" role="status" aria-live="polite">
            <div className="student-details__loading-header">
              <div className="student-loader__spinner" aria-hidden="true"></div>
              <div>
                <div className="student-loader__title">Loading academic timetable</div>
                <div className="student-loader__subtitle">Preparing your weekly schedule and periods.</div>
              </div>
            </div>
            <div className="student-details__loading-grid" aria-hidden="true">
              <div className="student-loader-card">
                <div className="student-loader-card__header student-loader__shimmer"></div>
                <div className="student-loader-card__line student-loader__shimmer"></div>
                <div className="student-loader-card__line student-loader__shimmer"></div>
              </div>
            </div>
            <span className="sr-only">Loading timetable...</span>
          </div>
        )}

        {!loading && (
          <div className="card card-soft tt-wrapper overflow-hidden p-0">
            <div className="table-responsive p-3">
              <table className="tt-table">
                <thead>
                  <tr>
                    <th>DAY</th>
                    {TIME_SLOTS.map(slot => (
                      <th key={slot.key}>
                        <span className="tt-head-title">{slot.label}</span>
                        <span className="tt-head-time">{slot.time}</span>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {DAYS.map((day, i) => (
                    <tr key={day}>
                      <th className="tt-day">{day}</th>

                      {TIME_SLOTS.map(slot => {
                        if (slot.type === 'break') {
                          return (
                            <td key={slot.key} className="tt-break">
                              {BREAK_LETTERS[i]}
                            </td>
                          )
                        }

                        if (slot.type === 'lunch') {
                          return (
                            <td key={slot.key} className="tt-lunch">
                              {LUNCH_LETTERS[i]}
                            </td>
                          )
                        }

                        return (
                          <td key={slot.key} className="tt-period">
                            {tableData?.[day]?.[slot.period] ? (
                              <>
                                <div style={{ fontWeight: 700 }}>
                                  {tableData[day][slot.period].subject}
                                </div>
                                <div
                                  style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    color: '#374151'
                                  }}
                                >
                                  (
                                  {tableData[day][slot.period].course} –{' '}
                                  {tableData[day][slot.period].group} – Sem{' '}
                                  {tableData[day][slot.period].semester}
                                  )
                                </div>
                              </>
                            ) : (
                              <span style={{ color: '#111827', fontWeight: 800, fontSize: '1rem' }}>
                                –
                              </span>
                            )}
                          </td>





                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </StaffShell>
  )
}
