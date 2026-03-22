import { useEffect, useState } from 'react'
import StaffShell from '../../components/StaffShell'
import { supabase } from '../../../supabaseClient'
import { useStaffAuth } from '../../store/staffAuth'
import './StaffPortal.css'


/* ===============================
   CONSTANTS
 ================================ */
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

// Helper to format time
const formatTime = (timeStr) => {
  if (!timeStr) return ''
  const [hours, minutes] = timeStr.split(':')
  const h = parseInt(hours, 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${minutes} ${ampm}`
}

const normalizeDay = (day) =>
  day.charAt(0).toUpperCase() + day.slice(1).toLowerCase()

/* ===============================
   PAGE
 ================================ */
export default function StaffTimetable() {
  const { staff } = useStaffAuth()
  const [timetables, setTimetables] = useState({ primary: null, secondary: null })
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
      // Use single join query to fetch timetable data
      const { data: slots, error } = await supabase
        .from('timetable_sessions')
        .select(`
          day_of_week,
          period_id,
          periods ( period_number, start_time, end_time ),
          subject_id,
          subjects ( subject_title ),
          class_section_id,
          class_sections ( 
            class_id,
            section_id,
            classes ( class_name, class_number ),
            sections ( section_name )
          )
        `)
        .eq('staff_id', staff.id)

      console.log('Fetched timetable data:', slots)

      if (error) {
        console.log('Error fetching timetable:', error)
        setTimetables({ primary: null, secondary: null })
        setLoading(false)
        return
      }

      if (!slots || slots.length === 0) {
        console.log('No slots found')
        setTimetables({ primary: null, secondary: null })
        setLoading(false)
        return
      }

      // Initialize timetables for Primary/Middle (8 periods) and Secondary (6 periods)
      // Use lowercase day keys to match data
      const primaryTimetable = {}
      const secondaryTimetable = {}

      DAYS.forEach(day => {
        const dayKey = day.toLowerCase()
        primaryTimetable[dayKey] = { p1: null, p2: null, p3: null, p4: null, p5: null, p6: null, p7: null, p8: null }
        secondaryTimetable[dayKey] = { p1: null, p2: null, p3: null, p4: null, p5: null, p6: null, p7: null, p8: null }
      })

      // Fill timetables - group by class level
      slots.forEach(item => {
        // Extract period number from nested periods object
        const periodNumber = item.periods?.period_number
        // Use lowercase day key
        const dayKey = item.day_of_week?.toLowerCase()
        
        console.log('Mapping:', dayKey, periodNumber, item.subjects?.subject_title)
        
        if (!dayKey || !periodNumber || periodNumber < 1 || periodNumber > 8) return

        const subject = item.subjects
        const section = item.class_sections
        const cls = section?.classes
        const sectionNameObj = section?.sections

        // Format section as A1, A2, A3... from A, B, C... in database
        const sectionMap = { A: 'A1', B: 'A2', C: 'A3', D: 'A4', E: 'A5', F: 'A6' }
        const sectionDisplay = sectionNameObj?.section_name ? (sectionMap[sectionNameObj.section_name] || sectionNameObj.section_name + '1') : ''

        const cellData = {
          subjectTitle: subject?.subject_title || 'Unknown',
          className: cls?.class_name || '-',
          sectionDisplay: sectionDisplay
        }

        // Check if class_number >= 10 (Secondary) - use 6 periods
        // Otherwise Primary/Middle - use 8 periods
        const classNumber = cls?.class_number || 0
        const isSecondary = classNumber >= 10

        // Use p1, p2, p3... format for grid keys
        const periodKey = `p${periodNumber}`

        if (isSecondary) {
          // Secondary: only periods 1-6
          if (periodNumber <= 6 && secondaryTimetable[dayKey]) {
            secondaryTimetable[dayKey][periodKey] = cellData
          }
        } else {
          // Primary/Middle: all 8 periods
          if (primaryTimetable[dayKey]) {
            primaryTimetable[dayKey][periodKey] = cellData
          }
        }
      })

      // Check if we have any data for each timetable
      const hasPrimary = Object.values(primaryTimetable).some(day => 
        Object.values(day).some(cell => cell !== null)
      )
      const hasSecondary = Object.values(secondaryTimetable).some(day => 
        Object.values(day).some(cell => cell !== null)
      )

      console.log('Primary timetable:', primaryTimetable)
      console.log('Secondary timetable:', secondaryTimetable)

      setTimetables({
        primary: hasPrimary ? primaryTimetable : null,
        secondary: hasSecondary ? secondaryTimetable : null
      })
    } catch (err) {
      console.error('Error loading staff timetable:', err)
      setTimetables({ primary: null, secondary: null })
    } finally {
      setLoading(false)
    }
  }

  /* ===============================
     RENDER - 8 PERIODS TABLE (Primary/Middle)
  ================================ */
  const render8PeriodTable = (timetable, title) => (
    <div className="card mb-4">
      <div className="card-header bg-light py-3">
        <h5 className="mb-0 fw-bold">{title}</h5>
      </div>
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table table-bordered table-sm mb-0" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th style={{ width: '90px', padding: '10px 6px', backgroundColor: '#f8f9fa', textAlign: 'center', verticalAlign: 'middle' }}>DAY</th>
                <th style={{ padding: '8px 4px', backgroundColor: '#f8f9fa', textAlign: 'center' }}>
                  <div className="fw-bold">PERIOD 1</div>
                  <div className="text-muted small mb-0">{formatTime('10:00')} - {formatTime('10:40')}</div>
                </th>
                <th style={{ padding: '8px 4px', backgroundColor: '#f8f9fa', textAlign: 'center' }}>
                  <div className="fw-bold">PERIOD 2</div>
                  <div className="text-muted small mb-0">{formatTime('10:40')} - {formatTime('11:20')}</div>
                </th>
                <th style={{ width: '50px', padding: '8px 4px', backgroundColor: '#fff8e1', color: '#f57f17', fontWeight: 'bold', textAlign: 'center', verticalAlign: 'middle' }}>BREAK</th>
                <th style={{ padding: '8px 4px', backgroundColor: '#f8f9fa', textAlign: 'center' }}>
                  <div className="fw-bold">PERIOD 3</div>
                  <div className="text-muted small mb-0">{formatTime('11:25')} - {formatTime('12:05')}</div>
                </th>
                <th style={{ padding: '8px 4px', backgroundColor: '#f8f9fa', textAlign: 'center' }}>
                  <div className="fw-bold">PERIOD 4</div>
                  <div className="text-muted small mb-0">{formatTime('12:05')} - {formatTime('12:45')}</div>
                </th>
                <th style={{ width: '50px', padding: '8px 4px', backgroundColor: '#e3f2fd', color: '#1565c0', fontWeight: 'bold', textAlign: 'center', verticalAlign: 'middle' }}>LUNCH</th>
                <th style={{ padding: '8px 4px', backgroundColor: '#f8f9fa', textAlign: 'center' }}>
                  <div className="fw-bold">PERIOD 5</div>
                  <div className="text-muted small mb-0">{formatTime('13:10')} - {formatTime('13:50')}</div>
                </th>
                <th style={{ padding: '8px 4px', backgroundColor: '#f8f9fa', textAlign: 'center' }}>
                  <div className="fw-bold">PERIOD 6</div>
                  <div className="text-muted small mb-0">{formatTime('13:50')} - {formatTime('14:30')}</div>
                </th>
                <th style={{ width: '50px', padding: '8px 4px', backgroundColor: '#fff8e1', color: '#f57f17', fontWeight: 'bold', textAlign: 'center', verticalAlign: 'middle' }}>BREAK</th>
                <th style={{ padding: '8px 4px', backgroundColor: '#f8f9fa', textAlign: 'center' }}>
                  <div className="fw-bold">PERIOD 7</div>
                  <div className="text-muted small mb-0">{formatTime('14:35')} - {formatTime('15:15')}</div>
                </th>
                <th style={{ padding: '8px 4px', backgroundColor: '#f8f9fa', textAlign: 'center' }}>
                  <div className="fw-bold">PERIOD 8</div>
                  <div className="text-muted small mb-0">{formatTime('15:15')} - {formatTime('15:55')}</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day, dayIndex) => {
                const dayKey = day.toLowerCase()
                return (
                <tr key={day}>
                  <td style={{ padding: '10px 6px', fontWeight: 'bold', backgroundColor: '#f8f9fa', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>{day}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                    {timetable?.[dayKey]?.p1 ? (
                      <div>
                        <div className="fw-bold text-primary">{timetable[dayKey].p1.subjectTitle}</div>
                        <small className="text-muted">{timetable[dayKey].p1.className} - {timetable[dayKey].p1.sectionDisplay}</small>
                      </div>
                    ) : <span className="text-muted">-</span>}
                  </td>
                  <td style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                    {timetable?.[dayKey]?.p2 ? (
                      <div>
                        <div className="fw-bold text-primary">{timetable[dayKey].p2.subjectTitle}</div>
                        <small className="text-muted">{timetable[dayKey].p2.className} - {timetable[dayKey].p2.sectionDisplay}</small>
                      </div>
                    ) : <span className="text-muted">-</span>}
                  </td>
                  <td style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'middle', backgroundColor: '#fff8e1', fontWeight: 'bold', color: '#f57f17', fontSize: '1.1rem' }}>{'BREAK'[dayIndex]}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                    {timetable?.[dayKey]?.p3 ? (
                      <div>
                        <div className="fw-bold text-primary">{timetable[dayKey].p3.subjectTitle}</div>
                        <small className="text-muted">{timetable[dayKey].p3.className} - {timetable[dayKey].p3.sectionDisplay}</small>
                      </div>
                    ) : <span className="text-muted">-</span>}
                  </td>
                  <td style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                    {timetable?.[dayKey]?.p4 ? (
                      <div>
                        <div className="fw-bold text-primary">{timetable[dayKey].p4.subjectTitle}</div>
                        <small className="text-muted">{timetable[dayKey].p4.className} - {timetable[dayKey].p4.sectionDisplay}</small>
                      </div>
                    ) : <span className="text-muted">-</span>}
                  </td>
                  <td style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'middle', backgroundColor: '#e3f2fd', fontWeight: 'bold', color: '#1565c0', fontSize: '1.1rem' }}>{'LUNCH'[dayIndex]}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                    {timetable?.[dayKey]?.p5 ? (
                      <div>
                        <div className="fw-bold text-primary">{timetable[dayKey].p5.subjectTitle}</div>
                        <small className="text-muted">{timetable[dayKey].p5.className} - {timetable[dayKey].p5.sectionDisplay}</small>
                      </div>
                    ) : <span className="text-muted">-</span>}
                  </td>
                  <td style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                    {timetable?.[dayKey]?.p6 ? (
                      <div>
                        <div className="fw-bold text-primary">{timetable[dayKey].p6.subjectTitle}</div>
                        <small className="text-muted">{timetable[dayKey].p6.className} - {timetable[dayKey].p6.sectionDisplay}</small>
                      </div>
                    ) : <span className="text-muted">-</span>}
                  </td>
                  <td style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'middle', backgroundColor: '#fff8e1', fontWeight: 'bold', color: '#f57f17', fontSize: '1.1rem' }}>{'BREAK'[dayIndex]}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                    {timetable?.[dayKey]?.p7 ? (
                      <div>
                        <div className="fw-bold text-primary">{timetable[dayKey].p7.subjectTitle}</div>
                        <small className="text-muted">{timetable[dayKey].p7.className} - {timetable[dayKey].p7.sectionDisplay}</small>
                      </div>
                    ) : <span className="text-muted">-</span>}
                  </td>
                  <td style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                    {timetable?.[dayKey]?.p8 ? (
                      <div>
                        <div className="fw-bold text-primary">{timetable[dayKey].p8.subjectTitle}</div>
                        <small className="text-muted">{timetable[dayKey].p8.className} - {timetable[dayKey].p8.sectionDisplay}</small>
                      </div>
                    ) : <span className="text-muted">-</span>}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  /* ===============================
     RENDER - 6 PERIODS TABLE (Secondary)
  ================================ */
  const render6PeriodTable = (timetable, title) => (
    <div className="card mb-4">
      <div className="card-header bg-light py-3">
        <h5 className="mb-0 fw-bold">{title}</h5>
      </div>
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table table-bordered table-sm mb-0" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th style={{ width: '90px', padding: '10px 6px', backgroundColor: '#f8f9fa', textAlign: 'center', verticalAlign: 'middle' }}>DAY</th>
                <th style={{ padding: '8px 4px', backgroundColor: '#f8f9fa', textAlign: 'center' }}>
                  <div className="fw-bold">PERIOD 1</div>
                  <div className="text-muted small mb-0">{formatTime('08:00')} - {formatTime('09:00')}</div>
                </th>
                <th style={{ padding: '8px 4px', backgroundColor: '#f8f9fa', textAlign: 'center' }}>
                  <div className="fw-bold">PERIOD 2</div>
                  <div className="text-muted small mb-0">{formatTime('09:00')} - {formatTime('10:00')}</div>
                </th>
                <th style={{ width: '50px', padding: '8px 4px', backgroundColor: '#fff8e1', color: '#f57f17', fontWeight: 'bold', textAlign: 'center', verticalAlign: 'middle' }}>BREAK</th>
                <th style={{ padding: '8px 4px', backgroundColor: '#f8f9fa', textAlign: 'center' }}>
                  <div className="fw-bold">PERIOD 3</div>
                  <div className="text-muted small mb-0">{formatTime('10:15')} - {formatTime('11:15')}</div>
                </th>
                <th style={{ padding: '8px 4px', backgroundColor: '#f8f9fa', textAlign: 'center' }}>
                  <div className="fw-bold">PERIOD 4</div>
                  <div className="text-muted small mb-0">{formatTime('11:15')} - {formatTime('12:15')}</div>
                </th>
                <th style={{ width: '50px', padding: '8px 4px', backgroundColor: '#e3f2fd', color: '#1565c0', fontWeight: 'bold', textAlign: 'center', verticalAlign: 'middle' }}>LUNCH</th>
                <th style={{ padding: '8px 4px', backgroundColor: '#f8f9fa', textAlign: 'center' }}>
                  <div className="fw-bold">PERIOD 5</div>
                  <div className="text-muted small mb-0">{formatTime('13:00')} - {formatTime('14:00')}</div>
                </th>
                <th style={{ padding: '8px 4px', backgroundColor: '#f8f9fa', textAlign: 'center' }}>
                  <div className="fw-bold">PERIOD 6</div>
                  <div className="text-muted small mb-0">{formatTime('14:00')} - {formatTime('15:00')}</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day, dayIndex) => {
                const dayKey = day.toLowerCase()
                return (
                <tr key={day}>
                  <td style={{ padding: '10px 6px', fontWeight: 'bold', backgroundColor: '#f8f9fa', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>{day}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                    {timetable?.[dayKey]?.p1 ? (
                      <div>
                        <div className="fw-bold text-primary">{timetable[dayKey].p1.subjectTitle}</div>
                        <small className="text-muted">{timetable[dayKey].p1.className} - {timetable[dayKey].p1.sectionDisplay}</small>
                      </div>
                    ) : <span className="text-muted">-</span>}
                  </td>
                  <td style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                    {timetable?.[dayKey]?.p2 ? (
                      <div>
                        <div className="fw-bold text-primary">{timetable[dayKey].p2.subjectTitle}</div>
                        <small className="text-muted">{timetable[dayKey].p2.className} - {timetable[dayKey].p2.sectionDisplay}</small>
                      </div>
                    ) : <span className="text-muted">-</span>}
                  </td>
                  <td style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'middle', backgroundColor: '#fff8e1', fontWeight: 'bold', color: '#f57f17', fontSize: '1.1rem' }}>{'BREAK'[dayIndex]}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                    {timetable?.[dayKey]?.p3 ? (
                      <div>
                        <div className="fw-bold text-primary">{timetable[dayKey].p3.subjectTitle}</div>
                        <small className="text-muted">{timetable[dayKey].p3.className} - {timetable[dayKey].p3.sectionDisplay}</small>
                      </div>
                    ) : <span className="text-muted">-</span>}
                  </td>
                  <td style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                    {timetable?.[dayKey]?.p4 ? (
                      <div>
                        <div className="fw-bold text-primary">{timetable[dayKey].p4.subjectTitle}</div>
                        <small className="text-muted">{timetable[dayKey].p4.className} - {timetable[dayKey].p4.sectionDisplay}</small>
                      </div>
                    ) : <span className="text-muted">-</span>}
                  </td>
                  <td style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'middle', backgroundColor: '#e3f2fd', fontWeight: 'bold', color: '#1565c0', fontSize: '1.1rem' }}>{'LUNCH'[dayIndex]}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                    {timetable?.[dayKey]?.p5 ? (
                      <div>
                        <div className="fw-bold text-primary">{timetable[dayKey].p5.subjectTitle}</div>
                        <small className="text-muted">{timetable[dayKey].p5.className} - {timetable[dayKey].p5.sectionDisplay}</small>
                      </div>
                    ) : <span className="text-muted">-</span>}
                  </td>
                  <td style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                    {timetable?.[dayKey]?.p6 ? (
                      <div>
                        <div className="fw-bold text-primary">{timetable[dayKey].p6.subjectTitle}</div>
                        <small className="text-muted">{timetable[dayKey].p6.className} - {timetable[dayKey].p6.sectionDisplay}</small>
                      </div>
                    ) : <span className="text-muted">-</span>}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  return (
    <StaffShell>
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
            <span className="sr-only">Loading timetable...</span>
          </div>
        )}

        {!loading && !timetables.primary && !timetables.secondary && (
          <div className="card">
            <div className="text-center py-5">
              <i className="bi bi-calendar-x" style={{ fontSize: '3rem', color: '#9ca3af' }}></i>
              <h5 className="mt-3 text-muted">No timetable assigned yet</h5>
              <p className="text-muted">Contact your administrator to get your class timetable.</p>
            </div>
          </div>
        )}

        {!loading && (timetables.primary || timetables.secondary) && (
          <>
            {timetables.primary && render8PeriodTable(timetables.primary, 'Primary / Middle School Timetable (8 Periods)')}
            {timetables.secondary && render6PeriodTable(timetables.secondary, 'Secondary School Timetable (6 Periods)')}
          </>
        )}
      </div>
    </StaffShell>
  )
}
