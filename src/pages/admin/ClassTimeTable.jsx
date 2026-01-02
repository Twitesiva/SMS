import AdminShell from '../../components/AdminShell'
import crestPrimary from '../../assets/media/images.png'
import { useEffect, useState } from 'react'
import { supabase } from '../../../supabaseClient'

/* ===============================
   CONSTANTS
================================ */
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

const BREAK_LETTERS = ['B', 'R', 'E', 'A', 'K']
const LUNCH_LETTERS = ['L', 'U', 'N', 'C', 'H']

const TIME_SLOTS = [
  { key: 'p1', label: 'PERIOD 1', time: '9:00 AM - 10:10 AM', type: 'period' },
  { key: 'b1', label: 'BREAK', time: '10:10 AM - 10:20 AM', type: 'break' },
  { key: 'p2', label: 'PERIOD 2', time: '10:20 AM - 11:30 AM', type: 'period' },
  { key: 'p3', label: 'PERIOD 3', time: '11:30 AM - 12:40 PM', type: 'period' },
  { key: 'lunch', label: 'LUNCH', time: '12:40 PM - 1:40 PM', type: 'lunch' },
  { key: 'p4', label: 'PERIOD 4', time: '1:40 PM - 2:50 PM', type: 'period' },
  { key: 'b2', label: 'BREAK', time: '2:50 PM - 3:00 PM', type: 'break' },
  { key: 'p5', label: 'PERIOD 5', time: '3:00 PM - 4:00 PM', type: 'period' }
]

/* ===============================
   NAV
================================ */
const adminNavGroups = [
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
    title: 'Department',
    static: true,
    items: [
      {
        to: '/admin-portal/department',
        label: 'Department',
        icon: 'bi-diagram-3'
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

  const [selectedAcademicYear, setSelectedAcademicYear] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('')
  const [selectedCourseCode, setSelectedCourseCode] = useState('')
  const [selectedSemester, setSelectedSemester] = useState('')
  const [timetable, setTimetable] = useState({})

  useEffect(() => {
    fetchAcademicYears()
    fetchGroups()
  }, [])

  const fetchAcademicYears = async () => {
    const { data } = await supabase
      .from('academic_year')
      .select('academic_year')

    setAcademicYears(data || [])
  }

  const fetchGroups = async () => {
    const { data } = await supabase
      .from('groups')
      .select('group_name')

    setGroups(data || [])
  }

  const fetchCoursesByGroup = async (groupName) => {
    const { data } = await supabase
      .from('courses')
      .select('course_name, course_code')
      .eq('group_name', groupName)

    setCourses(data || [])
  }

  const fetchSemesters = async (academicYear, courseCode) => {
    const { data } = await supabase
      .from('subjects')
      .select('semester_number')
      .eq('academic_year', academicYear)
      .eq('course_name', courseCode)

    setSemesters([...new Set((data || []).map(d => d.semester_number))])
  }

  const fetchSubjects = async (academicYear, courseCode, semester) => {
    const { data } = await supabase
      .from('subjects')
      .select('subject_name')
      .eq('academic_year', academicYear)
      .eq('course_name', courseCode)
      .eq('semester_number', semester)

    setSubjects(data || [])
  }

  const handleCellChange = (day, key, value) => {
    setTimetable(prev => ({
      ...prev,
      [day]: {
        ...(prev[day] || {}),
        [key]: value
      }
    }))
  }

  const showTimetable = selectedSemester && subjects.length > 0
  const hasFilters = selectedAcademicYear && selectedGroup && selectedCourseCode && selectedSemester

  return (
    <AdminShell
      navGroups={adminNavGroups}
      brandTitle="Admin Management Console"
      brandSubtitle="Chittoor"
      footerTitle="Admin Management Studio"
      footerSubtitle="Crafted for Vijayam College"
    >
      <style>{`
        .tt-wrapper {
          border: 2px solid #1f2937;
        }

        table.tt-table {
          border-collapse: collapse;
          width: 100%;
          table-layout: auto;
        }

        .tt-table th,
        .tt-table td {
          border: 1px solid #1f2937;
          padding: 8px;
          vertical-align: middle;
        }

        thead th {
          white-space: normal;
          text-align: center;
        }

        .tt-head-title {
          display: block;
          font-size: 0.8rem;
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
          width: 130px;
        }

        .tt-period {
          width: auto;
        }

        .tt-select {
          width: 100%;
          min-height: 38px;
          height: auto;
          padding: 6px 12px;
          font-size: 0.9rem;
          line-height: 1.2;
          white-space: normal;
          overflow: visible;
        }

        .tt-select option {
          white-space: normal;
        }

        .tt-break,
        .tt-lunch {
          width: 34px;
          min-width: 34px;
          max-width: 34px;
          padding: 0;
          text-align: center;
          font-weight: 800;
          vertical-align: middle;
          font-size: 0.85rem;
        }

        .tt-break {
          background: #fff3cd;
          color: #92400e;
        }

        .tt-lunch {
          background: #dbeafe;
          color: #1e3a8a;
        }
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

        <div className="students-section-shell card card-soft mb-4">
          <div className="students-section-shell-header mb-3">
            <div>
              <h5 className="section-title mb-1">Class Time Table</h5>
              <p className="students-section-copy small mb-0">Filter by academic year, group, course, and semester.</p>
            </div>
          </div>

          <div className="students-section-form row g-3 align-items-end">
            <div className="col-md-3">
              <label className="form-label fw-bold mb-1">Academic Year</label>
              <select
                className="form-select"
                onChange={e => setSelectedAcademicYear(e.target.value)}
              >
                <option value="">Select Academic Year</option>
                {academicYears.map(y => (
                  <option key={y.academic_year} value={y.academic_year}>
                    {y.academic_year}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label fw-bold mb-1">Group</label>
              <select
                className="form-select"
                onChange={e => {
                  setSelectedGroup(e.target.value)
                  fetchCoursesByGroup(e.target.value)
                }}
              >
                <option value="">Select Group</option>
                {groups.map(g => (
                  <option key={g.group_name} value={g.group_name}>
                    {g.group_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label fw-bold mb-1">Course</label>
              <select
                className="form-select"
                onChange={e => {
                  setSelectedCourseCode(e.target.value)
                  fetchSemesters(selectedAcademicYear, e.target.value)
                }}
              >
                <option value="">Select Course</option>
                {courses.map(c => (
                  <option key={c.course_code} value={c.course_code}>
                    {c.course_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label fw-bold mb-1">Semester</label>
              <select
                className="form-select"
                onChange={e => {
                  setSelectedSemester(e.target.value)
                  fetchSubjects(
                    selectedAcademicYear,
                    selectedCourseCode,
                    e.target.value
                  )
                }}
              >
                <option value="">Select Semester</option>
                {semesters.map(s => (
                  <option key={s} value={s}>
                    Semester {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {showTimetable ? (
          <div className="students-table-panel card card-soft p-4 mb-4">
            <div className="students-table-panel-header mb-3">
              <div>
                <p className="students-table-panel-title mb-1 text-white">Weekly Timetable</p>
                <p className="students-table-panel-copy small mb-0">
                  Assign subjects to each period for the selected semester.
                </p>
              </div>
            </div>

            <div className="tt-wrapper">
              <div className="p-4 pb-5">
                <table className="tt-table text-center">
                  <thead>
                    <tr>
                      <th>DAY</th>
                      {TIME_SLOTS.map(slot => (
                        <th key={slot.key}>
                          <div className="tt-head-title">{slot.label}</div>
                          <div className="tt-head-time">{slot.time}</div>
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
                              <select
                                className="form-select tt-select"
                                value={timetable?.[day]?.[slot.key] || ''}
                                onChange={e =>
                                  handleCellChange(day, slot.key, e.target.value)
                                }
                              >
                                <option value="">Select Subject</option>
                                {subjects.map(s => (
                                  <option
                                    key={s.subject_name}
                                    value={s.subject_name}
                                    title={s.subject_name}
                                  >
                                    {s.subject_name}
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
          </div>
        ) : (
          <div className="card card-soft p-4 text-center text-muted">
            <div className="mb-2">
              <i className="bi bi-calendar2-range fs-2"></i>
            </div>
            <h5 className="mb-1">No timetable yet</h5>
            <p className="mb-0 small">
              {hasFilters ? 'No subjects found for this selection.' : 'Select filters to build the timetable.'}
            </p>
          </div>
        )}
      </div>
    </AdminShell>
  )
}


