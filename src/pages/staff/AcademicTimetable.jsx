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
  { key: 'p1', label: 'PERIOD 1', time: '9:00 AM – 10:00 AM', type: 'period', period: 1 },
  { key: 'p2', label: 'PERIOD 2', time: '10:00 AM – 11:00 AM', type: 'period', period: 2 },
  { key: 'p3', label: 'PERIOD 3', time: '11:00 AM – 12:00 PM', type: 'period', period: 3 },
  { key: 'p4', label: 'PERIOD 4', time: '12:00 PM – 1:00 PM', type: 'period', period: 4 },
  { key: 'p5', label: 'PERIOD 5', time: '1:00 PM – 2:00 PM', type: 'period', period: 5 },
  { key: 'p6', label: 'PERIOD 6', time: '2:00 PM – 3:00 PM', type: 'period', period: 6 },
  { key: 'p7', label: 'PERIOD 7', time: '3:00 PM – 4:00 PM', type: 'period', period: 7 },
  { key: 'p8', label: 'PERIOD 8', time: '4:00 PM – 5:00 PM', type: 'period', period: 8 }
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
    if (!staff?.id) return
    setLoading(true)

    try {
      // 1. Fetch staff slots from timetable_sessions
      const { data: slots, error } = await supabase
        .from('timetable_sessions')
        .select('day_of_week, period_id, subject_id, class_section_id')
        .eq('staff_id', staff.id)

      if (error || !slots || slots.length === 0) {
        console.log('No slots found or error:', error)
        setTableData({ empty: true })
        setLoading(false)
        return
      }

      // 2. Get unique IDs for lookup
      const periodIds = [...new Set(slots.map(s => s.period_id).filter(Boolean))]
      const subjectIds = [...new Set(slots.map(s => s.subject_id).filter(Boolean))]
      const sectionIds = [...new Set(slots.map(s => s.class_section_id).filter(Boolean))]

      // 3. Fetch periods, subjects, class_sections, and sections data
      const [{ data: periodsData }, { data: subjectsData }, { data: sectionsData }, { data: sectionNamesData }] = await Promise.all([
        periodIds.length > 0 ? supabase.from('periods').select('id, period_number, start_time, end_time').in('id', periodIds) : Promise.resolve({ data: [] }),
        subjectIds.length > 0 ? supabase.from('subjects').select('id, subject_title').in('id', subjectIds) : Promise.resolve({ data: [] }),
        sectionIds.length > 0 ? supabase.from('class_sections').select('id, class_id, section_id').in('id', sectionIds) : Promise.resolve({ data: [] }),
        Promise.resolve({ data: [] })
      ])

      // 4. Get unique class_ids and section_ids
      const classIds = [...new Set((sectionsData || []).map(s => s.class_id).filter(Boolean))]
      const sectionNameIds = [...new Set((sectionsData || []).map(s => s.section_id).filter(Boolean))]

      // 5. Fetch classes and sections
      const [{ data: classesData }, { data: sectionsListData }] = await Promise.all([
        classIds.length > 0 ? supabase.from('classes').select('id, class_name').in('id', classIds) : Promise.resolve({ data: [] }),
        sectionNameIds.length > 0 ? supabase.from('sections').select('id, section_name').in('id', sectionNameIds) : Promise.resolve({ data: [] })
      ])

      // 6. Create lookup maps
      const periodMap = new Map((periodsData || []).map(p => [p.id, p]))
      const subjectMap = new Map((subjectsData || []).map(s => [s.id, s]))
      const sectionMap = new Map((sectionsData || []).map(s => [s.id, s]))
      const classMap = new Map((classesData || []).map(c => [c.id, c]))
      const sectionNameMap = new Map((sectionsListData || []).map(s => [s.id, s]))

      // 7. Build table using periodMap to get period_number
      const table = {}
      slots.forEach(slot => {
        const day = normalizeDay(slot.day_of_week)
        const periodInfo = periodMap.get(slot.period_id)
        const period = Number(periodInfo?.period_number)
        if (!DAYS.includes(day) || !period) return

        if (!table[day]) table[day] = {}

        const subject = subjectMap.get(slot.subject_id)
        const section = sectionMap.get(slot.class_section_id)
        const cls = classMap.get(section?.class_id)
        const sectionName = sectionNameMap.get(section?.section_id)

        table[day][period] = {
          subject: subject?.subject_title || 'Unknown',
          className: cls?.class_name || '-',
          sectionName: sectionName?.section_name || ''
        }
      })

      setTableData(table)
    } catch (err) {
      console.error('Error loading staff timetable:', err)
      setTableData({ empty: true })
    } finally {
      setLoading(false)
    }
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
                            {tableData?.empty ? (
                              <span className="text-muted">No timetable assigned</span>
                            ) : tableData?.[day]?.[slot.period] ? (
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
                                  ({tableData[day][slot.period].className} - {tableData[day][slot.period].sectionName})
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
