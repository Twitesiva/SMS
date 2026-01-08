import { useEffect, useMemo, useState } from 'react'
import StudentShell from '../../components/StudentShell'
import { supabase } from '../../../supabaseClient'
import { useStudentAuth } from '../../store/studentAuth'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement
} from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

export default function StudentAttendance() {
  const { student } = useStudentAuth()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Filter State
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    const loadAttendance = async () => {
      if (!student?.id) {
        setError('Student profile is missing.')
        return
      }

      setLoading(true)
      setError('')
      try {
        const { data: recordRows, error: recordError } = await supabase
          .from('attendance_records')
          .select('id, status, attendance_session_id, created_at')
          .eq('student_id', student.id)
          .order('created_at', { ascending: false })

        if (recordError) throw recordError

        const sessionIds = (recordRows || []).map((row) => row.attendance_session_id).filter(Boolean)
        if (!sessionIds.length) {
          setRecords([])
          return
        }

        const { data: sessionRows, error: sessionError } = await supabase
          .from('attendance_sessions')
          .select('id, attendance_date, subject_id')
          .in('id', sessionIds)

        if (sessionError) throw sessionError

        const subjectIds = (sessionRows || []).map((row) => row.subject_id).filter(Boolean)
        const subjectMap = new Map()
        if (subjectIds.length) {
          const { data: subjectRows, error: subjectError } = await supabase
            .from('subjects')
            .select('subject_id, subject_name, subject_code')
            .in('subject_id', subjectIds)

          if (subjectError) throw subjectError

          ;(subjectRows || []).forEach((row) => {
            subjectMap.set(row.subject_id, row)
          })
        }

        const sessionMap = new Map()
        ;(sessionRows || []).forEach((row) => {
          sessionMap.set(row.id, row)
        })

        const merged = (recordRows || []).map((row) => {
          const session = sessionMap.get(row.attendance_session_id)
          const subject = session ? subjectMap.get(session.subject_id) : null
          return {
            ...row,
            attendance_sessions: session
              ? {
                  attendance_date: session.attendance_date,
                  subjects: subject || null
                }
              : null
          }
        })

        setRecords(merged)
      } catch (err) {
        console.error('Failed to load attendance', err)
        setError('Unable to load attendance right now.')
        setRecords([])
      } finally {
        setLoading(false)
      }
    }

    loadAttendance()
  }, [student?.id])

  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], [])

  // Grouping and Filtering by Date
  const dateWiseRecords = useMemo(() => {
    const map = new Map()
    records.forEach((r) => {
      const d = r.attendance_sessions?.attendance_date
      if (!d) return
      
      if (startDate && d < startDate) return
      if (endDate && d > endDate) return

      if (!map.has(d)) map.set(d, [])
      map.get(d).push(r)
    })

    return Array.from(map.entries())
      .map(([date, sessions]) => {
        const presentCount = sessions.filter(s => s.status === 'PRESENT').length
        let statusText = 'ABSENT'
        if (presentCount >= 5) statusText = 'FULL PRESENT'
        else if (presentCount >= 3) statusText = 'HALF DAY'
        
        return { date, sessions, presentCount, statusText }
      })
      .filter(day => !statusFilter || day.statusText === statusFilter)
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [records, startDate, endDate, statusFilter])

  const todayData = useMemo(() => {
    const dayEntry = dateWiseRecords.find((d) => d.date === todayIso)
    const sessions = dayEntry?.sessions || []
    const present = sessions.filter((s) => s.status === 'PRESENT').length
    const total = sessions.length
    const rate = total > 0 ? (present / 5 * 100).toFixed(1) : "0.0" 

    let label = 'NO DATA'
    if (total > 0) {
      if (present >= 5) label = 'FULL PRESENT'
      else if (present >= 3) label = 'HALF DAY'
      else label = 'ABSENT / PARTIAL'
    }

    return { present, total, rate, label }
  }, [dateWiseRecords, todayIso])

  const overallStats = useMemo(() => {
    const days = dateWiseRecords.length
    const presentDays = dateWiseRecords.filter(d => d.statusText === 'FULL PRESENT').length
    const halfDays = dateWiseRecords.filter(d => d.statusText === 'HALF DAY').length
    
    const totalScore = presentDays + (halfDays * 0.5)
    const rate = days > 0 ? (totalScore / days * 100).toFixed(1) : "0.0"
    
    return { days, presentDays, halfDays, rate, totalScore }
  }, [dateWiseRecords])

  const formatDateFull = (value) => {
    if (!value) return 'N/A'
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  // Daily Chart Logic for Current Month
  const dailyChartData = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const labels = [];
    const dataPoints = [];
    const colors = [];

    for (let i = 1; i <= daysInMonth; i++) {
      labels.push(i);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const record = dateWiseRecords.find(r => r.date === dateStr);
      
      if (record) {
        if (record.statusText === 'FULL PRESENT') {
          dataPoints.push(3); // Top level
          colors.push('#10b981');
        } else if (record.statusText === 'HALF DAY') {
          dataPoints.push(2); // Middle level
          colors.push('#f59e0b');
        } else {
          dataPoints.push(1); // Bottom visible level
          colors.push('#ef4444');
        }
      } else {
        dataPoints.push(null); 
        colors.push('#e2e8f0');
      }
    }

    return {
      labels,
      datasets: [
        {
          label: 'Daily Status',
          data: dataPoints,
          backgroundColor: colors,
          borderRadius: 4,
          barThickness: 15
        }
      ]
    };
  }, [dateWiseRecords]);

  const dailyChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => `Day ${items[0].label}`,
          label: (context) => {
            const val = context.raw;
            if (val === 3) return 'Status: FULL PRESENT';
            if (val === 2) return 'Status: HALF DAY';
            if (val === 1) return 'Status: ABSENT';
            return 'No Record';
          }
        }
      }
    },
    scales: {
      y: {
        min: 0,
        max: 3,
        ticks: {
          stepSize: 1,
          callback: function(value) {
            if (value === 3) return 'PRESENT';
            if (value === 2) return 'HALFDAY';
            if (value === 1) return 'ABSENT';
            return '';
          },
          font: { weight: 'bold', size: 10 },
          color: '#000000'
        },
        title: { display: true, text: 'STATUS', font: { weight: 'bold', size: 10 }, color: '#000000' },
        grid: { color: '#e2e8f0' }
      },
      x: {
        ticks: { font: { weight: 'bold', size: 10 }, color: '#000000' },
        title: { display: true, text: 'DAY OF MONTH', font: { weight: 'bold', size: 10 }, color: '#000000' },
        grid: { display: false }
      }
    }
  };

  return (
    <StudentShell>
      <div className="student-details student-attendance">
        <div className="student-details__header">
          <h2 className="fw-bold text-dark">Attendance Analysis</h2>
          <p className="text-dark fw-semibold">Monitor your daily sessions and attendance status.</p>
        </div>

        {/* TOP STATS */}
        <div className="student-attendance__stats">
          <div className="student-attendance__stat">
            <div className="student-attendance__stat-head">
              <span className="student-attendance__stat-icon">
                <i className="bi bi-calendar-check text-primary" aria-hidden="true"></i>
              </span>
              <div className="student-attendance__stat-label fw-bold text-dark">Today's Sessions</div>
            </div>
            <div className="student-attendance__stat-value text-dark">{todayData.total} / 5</div>
            <div className="student-attendance__stat-meta text-dark">{todayData.label || 'NO DATA'}</div>
          </div>
          <div className="student-attendance__stat">
            <div className="student-attendance__stat-head">
              <span className="student-attendance__stat-icon">
                <i className="bi bi-calendar-check text-success" aria-hidden="true"></i>
              </span>
              <div className="student-attendance__stat-label fw-bold text-dark">Overall Present Days</div>
            </div>
            <div className="student-attendance__stat-value text-dark">{overallStats.totalScore} Days</div>
            <div className="student-attendance__stat-meta text-dark">Present + Half Days</div>
          </div>
          <div className="student-attendance__stat">
            <div className="student-attendance__stat-head">
              <span className="student-attendance__stat-icon">
                <i className="bi bi-globe text-info" aria-hidden="true"></i>
              </span>
              <div className="student-attendance__stat-label fw-bold text-dark">Overall Attendance Rate</div>
            </div>
            <div className="student-attendance__stat-value text-dark">{overallStats.rate}%</div>
            <div className="student-attendance__stat-meta text-dark">Calculated from total days</div>
          </div>
        </div>

        {/* FILTERS */}
        <div className="card card-soft p-3 mb-4">
          <div className="row g-3">
            <div className="col-md-4">
              <label className="small fw-bold text-dark mb-1">From Date</label>
              <input type="date" className="form-control form-control-sm" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="col-md-4">
              <label className="small fw-bold text-dark mb-1">To Date</label>
              <input type="date" className="form-control form-control-sm" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div className="col-md-4">
              <label className="small fw-bold text-dark mb-1">Status Filter</label>
              <select className="form-select form-select-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="FULL PRESENT">Full Present</option>
                <option value="HALF DAY">Half Day</option>
                <option value="ABSENT">Absent</option>
              </select>
            </div>
          </div>
        </div>

        <div className="student-attendance__main">
          <div className="d-flex flex-column gap-4 w-100">
            {/* GRAPH */}
            <div className="card card-soft p-4 shadow-sm">
              <h4 className="fw-bold text-dark mb-4 text-uppercase small">Current Month: {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h4>
              <div style={{ height: '350px' }}>
                <Bar data={dailyChartData} options={dailyChartOptions} />
              </div>
              <div className="mt-3 d-flex justify-content-center gap-4">
                <div className="small fw-bold text-dark"><span className="d-inline-block rounded-circle me-1" style={{width:10, height:10, background:'#10b981'}}></span> Full Present</div>
                <div className="small fw-bold text-dark"><span className="d-inline-block rounded-circle me-1" style={{width:10, height:10, background:'#f59e0b'}}></span> Half Day</div>
                <div className="small fw-bold text-dark"><span className="d-inline-block rounded-circle me-1" style={{width:10, height:10, background:'#ef4444'}}></span> Absent</div>
              </div>
            </div>

            {/* TABLE */}
            <div className="student-attendance__table-card">
              <div className="student-attendance__table-header">
                <h4 className="fw-bold text-dark mb-1">Attendance History (Day-wise)</h4>
                <p className="text-dark small mb-0">Analysis of grouped daily sessions.</p>
              </div>
              <div className="table-responsive">
                <table className="student-attendance__table">
                  <thead>
                    <tr className="bg-light">
                      <th className="text-dark fw-bold">Date</th>
                      <th className="text-dark fw-bold text-center">Day Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dateWiseRecords.map((day) => (
                      <tr key={day.date} className="border-bottom">
                        <td className="fw-bold text-dark">{formatDateFull(day.date)}</td>
                        <td className="text-center">
                          <span className={`badge ${day.statusText === 'FULL PRESENT' ? 'bg-success' : day.statusText === 'HALF DAY' ? 'bg-warning text-dark' : 'bg-danger'} fw-bold px-3 py-2`} style={{ minWidth: '120px' }}>
                            {day.statusText}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* OVERALL PANEL */}
          <div className="student-attendance__panel">
            <h4 className="fw-bold text-dark mb-4">Overall Summary</h4>
            <div className="student-attendance__donut-wrap">
              <div className="student-attendance__donut" style={{ background: overallStats.days ? `conic-gradient(#10b981 ${overallStats.rate}%, #ef4444 0)` : '#e2e8f0' }}>
                <div className="student-attendance__donut-center">
                  <div className="student-attendance__donut-value text-dark fw-bold">{overallStats.rate}%</div>
                  <div className="student-attendance__donut-label text-dark small fw-bold">Score</div>
                </div>
              </div>
            </div>
            <div className="w-100 mt-4 d-flex flex-column gap-3">
              <div className="d-flex justify-content-between p-3 bg-white rounded shadow-sm border-start border-4 border-primary">
                <span className="text-dark fw-bold">Analyzed Days</span>
                <span className="text-dark fw-bold fs-5">{overallStats.days}</span>
              </div>
              <div className="d-flex justify-content-between p-3 bg-white rounded shadow-sm border-start border-4 border-success">
                <span className="text-dark fw-bold">Full Present</span>
                <span className="text-success fw-bold fs-5">{overallStats.presentDays}</span>
              </div>
              <div className="d-flex justify-content-between p-3 bg-white rounded shadow-sm border-start border-4 border-warning">
                <span className="text-dark fw-bold">Half Days</span>
                <span className="text-warning fw-bold fs-5">{overallStats.halfDays}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </StudentShell>
  )
}
