import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../supabaseClient'
import { api } from '../../lib/mockApi'
import crestPrimary from '../../assets/media/images.png'
import AdminShell from '../../components/AdminShell'

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString()
}

const navGroups = [
  {
    title: 'Admissions Overview',
    static: true,
    items: [
      { to: '/admissions/overview', label: 'Admissions Overview', icon: 'bi-speedometer2' }
    ]
  },
  {
    title: 'Application Review',
    static: true,
    items: [
      { to: '/admissions/review', label: 'Application Review', icon: 'bi-file-earmark-check' }
    ]
  },
  {
    title: 'Final Application',
    static: true,
    items: [
      { to: '/admissions/application', label: 'Student Application', icon: 'bi-window-plus' }
    ]
  },
  {
    title: 'Confirmed Admissions',
    static: true,
    items: [
      { to: '/admissions/confirmed', label: 'Confirmed Admissions', icon: 'bi-person-check' }
    ]
  }
]

export default function AdmissionsOverview() {
  const [applications, setApplications] = useState([])
  const [groups, setGroups] = useState([])
  const [courses, setCourses] = useState([])
  const [filters, setFilters] = useState({ group_id: '', course_id: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      setError('')
      try {
        const [appsResponse, groupList, courseList] = await Promise.all([
          supabase
            .from('applications')
            .select('*, admission:admissions(*)')
            .order('created_at', { ascending: false }),
          api.listGroups?.() || [],
          api.listCourses(),
        ])

        if (appsResponse.error) throw appsResponse.error
        setApplications(appsResponse.data || [])
        setGroups(groupList || [])
        setCourses(courseList || [])
      } catch (err) {
        console.error('Unable to load admissions overview data', err)
        setError(err?.message || 'Unable to load admissions data.')
        setApplications([])
        setGroups([])
        setCourses([])
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const groupMap = useMemo(() => {
    const entries = (groups || []).map((group) => [String(group.id), group])
    return new Map(entries)
  }, [groups])

  const courseMap = useMemo(() => {
    const entries = (courses || []).map((course) => [String(course.id), course])
    return new Map(entries)
  }, [courses])

  const selectedGroup = useMemo(() => {
    if (!filters.group_id) return null
    return groupMap.get(String(filters.group_id)) || null
  }, [filters.group_id, groupMap])

  const filteredCourseOptions = useMemo(() => {
    if (!filters.group_id) return courses
    const groupName = selectedGroup?.name || selectedGroup?.group_name || ''
    const groupCode = selectedGroup?.code || selectedGroup?.group_code || ''
    return (courses || []).filter((course) => {
      const courseGroupName = course.group_name || course.groupName || ''
      const courseGroupCode = course.group_code || course.groupCode || ''
      return (
        (groupName && courseGroupName === groupName) ||
        (groupCode && courseGroupCode === groupCode)
      )
    })
  }, [filters.group_id, courses, selectedGroup])

  const filteredApplications = useMemo(() => {
    let rows = applications
    if (filters.group_id) {
      rows = rows.filter((app) => String(app.group_id) === String(filters.group_id))
    }
    if (filters.course_id) {
      rows = rows.filter((app) => String(app.course_id) === String(filters.course_id))
    }
    return rows
  }, [applications, filters.group_id, filters.course_id])

  const groupLabelFor = (groupId) => {
    if (!groupId) return '-'
    const group = groupMap.get(String(groupId))
    return group?.name || group?.group_name || group?.code || groupId
  }

  const courseLabelFor = (courseId) => {
    if (!courseId) return '-'
    const course = courseMap.get(String(courseId))
    return course?.name || course?.course_name || course?.code || courseId
  }

  const handleGroupChange = (event) => {
    const value = event.target.value
    setFilters({ group_id: value, course_id: '' })
  }

  const handleCourseChange = (event) => {
    const value = event.target.value
    setFilters((prev) => ({ ...prev, course_id: value }))
  }

  const clearFilters = () => setFilters({ group_id: '', course_id: '' })

  return (
    <AdminShell
      navGroups={navGroups}
      brandTitle="Admissions Portal"
      brandSubtitle="Vijayam College"
      footerTitle="Admission Management"
      footerSubtitle="Administrator Access"
    >

      <section className="setup-hero mb-4 text-center">
        <div className="setup-hero-copywrap mx-auto text-center" style={{ maxWidth: '640px' }}>
          <div className="admin-applications__crest mx-auto" aria-hidden="true">
            <img src={crestPrimary} alt="Vijayam crest" />
          </div>
          <h3 className="setup-hero-title mb-2">Admissions Overview</h3>
          <p className="setup-hero-copy mb-0">
            Track total applied admissions and filter by group or course.
          </p>
        </div>
      </section>

      <div className="row g-4 align-items-stretch">
        <div className="col-12 col-xl-4">
          <div className="card card-soft p-4 h-100">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <div className="text-uppercase text-muted small">Applied Admissions</div>
                <div className="display-6 fw-bold">{applications.length}</div>
                <div className="text-muted small">
                  Showing {filteredApplications.length} after filters
                </div>
              </div>
              <div className="display-6 text-muted">
                <i className="bi bi-people"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-8">
          <div className="card card-soft p-4 h-100">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h5 className="mb-1">Filters</h5>
                <p className="text-muted mb-0">Narrow down admissions by group and course.</p>
              </div>
              <button type="button" className="btn btn-outline-secondary" onClick={clearFilters}>
                Clear
              </button>
            </div>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Group</label>
                <select className="form-select" value={filters.group_id} onChange={handleGroupChange}>
                  <option value="">All groups</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name || group.group_name || group.code}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Course</label>
                <select
                  className="form-select"
                  value={filters.course_id}
                  onChange={handleCourseChange}
                  disabled={!filteredCourseOptions.length}
                >
                  <option value="">All courses</option>
                  {filteredCourseOptions.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.code ? `${course.code} - ` : ''}
                      {course.name || course.course_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card card-soft p-4 mt-4">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <h5 className="mb-1">Applied Admissions</h5>
            <p className="text-muted mb-0">Latest applications from the admission portal.</p>
          </div>
        </div>

        {loading && <div className="text-muted">Loading admissions...</div>}
        {!loading && error && <div className="alert alert-warning mb-0">{error}</div>}
        {!loading && !error && (
          <div className="table-responsive">
            <table className="table table-striped align-middle">
              <thead>
                <tr>
                  <th>Application No</th>
                  <th>Applicant</th>
                  <th>Admission Year</th>
                  <th>Group</th>
                  <th>Course</th>
                  <th>Submitted</th>
                  <th>Doc Verification</th>
                  <th>Fee Status</th>
                  <th>Admission Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredApplications.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center text-muted py-4">
                      No admissions found for the selected filters.
                    </td>
                  </tr>
                )}
                {filteredApplications.map((app) => {
                  const adm = Array.isArray(app.admission) ? app.admission[0] : app.admission
                  const docStatus = adm?.document_verification_status || 'Pending'
                  const feeStatus = adm?.admission_fee_paid ? 'Paid' : 'Pending'
                  const admissionStatus = adm?.admission_status || 'Pending'

                  return (
                    <tr key={app.id || app.application_no}>
                      <td>{app.application_no || '-'}</td>
                      <td>{app.full_name || '-'}</td>
                      <td>{app.admission_year || '-'}</td>
                      <td>{groupLabelFor(app.group_id)}</td>
                      <td>{courseLabelFor(app.course_id)}</td>
                      <td>{formatDate(app.created_at)}</td>
                      <td>
                        <span className={`badge ${docStatus === 'VERIFIED' ? 'bg-success' : 'bg-warning text-dark'}`}>
                          {docStatus}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${feeStatus === 'Paid' ? 'bg-success' : 'bg-danger'}`}>
                          {feeStatus}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${admissionStatus === 'APPROVED' ? 'bg-success' : 'bg-secondary'}`}>
                          {admissionStatus}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  )
}
