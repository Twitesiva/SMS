import { useEffect, useState, useMemo } from 'react'
import AdShellAdmin from '../../components/AdShellAdmin'
import { supabase } from '../../../supabaseClient'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get workload status based on period count
 */
const getLoadStatus = (count) => {
  if (count > 35) return "OVERLOAD"
  if (count >= 28) return "NORMAL"
  return "LOW"
}

/**
 * Get status color for UI
 */
const getStatusColor = (status) => {
  if (status === "OVERLOAD") return { bg: '#ffebee', border: '#5c0000', text: '#c62828' }
  if (status === "NORMAL") return { bg: '#fff8e1', border: '#ff6f00', text: '#f57c00' }
  return { bg: '#e8f5e9', border: '#1b5e20', text: '#2e7d32' }
}

/**
 * Format term for display
 */
const formatTerm = (term) => {
  if (term === 0 || term === '0') return 'Full Year'
  return `Term ${term}`
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function StaffWorkloadReport() {
  // ---------- State ----------
  const [academicYears, setAcademicYears] = useState([])
  const [selectedYear, setSelectedYear] = useState('')
  const [selectedTerm, setSelectedTerm] = useState('')
  const [reportData, setReportData] = useState([])
  const [loading, setLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  
  // New filter states
  const [selectedLevel, setSelectedLevel] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  
  // Clear all filters
  const clearFilters = () => {
    setSelectedLevel('')
    setSearchTerm('')
    setFilterStatus('all')
  }

  // ---------- Load Academic Years ----------
  useEffect(() => {
    const loadYears = async () => {
      const { data, error } = await supabase
        .from('academic_years')
        .select('id, year_name')
        .order('year_name', { ascending: false })

      if (error) {
        console.error('Error loading years:', error)
        return
      }

      setAcademicYears(data || [])
      if (data?.length > 0) {
        setSelectedYear(data[0].id)
      }
    }

    loadYears()
  }, [])

  // ---------- Fetch Report Data ----------
  useEffect(() => {
    if (!selectedYear || !selectedTerm) {
      setReportData([])
      return
    }

    const fetchReportData = async () => {
      setLoading(true)
      try {
        const termNumber = selectedTerm === 'full' ? 0 : Number(selectedTerm)

        // Step 1: Fetch all timetable sessions for selected year and term with class info
        const { data: sessionData, error: sessionError } = await supabase
          .from('timetable_sessions')
          .select(`
            staff_id, 
            day_of_week, 
            period_id,
            class_sections(
              classes(
                class_name,
                class_number,
                school_level
              )
            )
          `)
          .eq('academic_year_id', selectedYear)
          .eq('term', termNumber)

        if (sessionError) throw sessionError

        // Step 2: Count periods per staff and track school levels
        const countMap = {}
        const levelMap = {}
        ;(sessionData || []).forEach(row => {
          if (!row.staff_id) return
          countMap[row.staff_id] = (countMap[row.staff_id] || 0) + 1
          
          // Extract school level from the join
          const level = row.class_sections?.classes?.school_level
          if (level) {
            if (!levelMap[row.staff_id]) {
              levelMap[row.staff_id] = new Set()
            }
            levelMap[row.staff_id].add(level)
          }
        })

        // Step 3: Fetch all staff
        const { data: staffData, error: staffError } = await supabase
          .from('staff')
          .select('id, full_name')
          .order('full_name')

        if (staffError) throw staffError

        // Step 4: Fetch staff subjects
        const { data: staffSubjectsData, error: subjectsError } = await supabase
          .from('staff_subjects')
          .select('staff_id, subjects(subject_title)')

        if (subjectsError) throw subjectsError

        // Build subject map
        const subjectMap = {}
        ;(staffSubjectsData || []).forEach(row => {
          if (!row.staff_id) return
          const list = subjectMap[row.staff_id] || []
          if (row.subjects?.subject_title) {
            list.push(row.subjects.subject_title)
          }
          subjectMap[row.staff_id] = list
        })

        // Step 5: Merge data
        const mergedData = (staffData || []).map(staff => ({
          id: staff.id,
          name: staff.full_name,
          subjects: subjectMap[staff.id] || [],
          totalPeriods: countMap[staff.id] || 0,
          levels: levelMap[staff.id] ? Array.from(levelMap[staff.id]) : []
        }))

        // Add status to each staff
        const dataWithStatus = mergedData.map(staff => ({
          ...staff,
          status: getLoadStatus(staff.totalPeriods)
        }))

        // Sort by highest load
        dataWithStatus.sort((a, b) => b.totalPeriods - a.totalPeriods)

        setReportData(dataWithStatus)

      } catch (error) {
        console.error('Error fetching report data:', error)
        toast.error('Failed to load report data')
      } finally {
        setLoading(false)
      }
    }

    fetchReportData()
  }, [selectedYear, selectedTerm])

  // ---------- Filtered Data ----------
  const filteredData = useMemo(() => {
    let filtered = reportData
    
    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(staff => staff.status === filterStatus.toUpperCase())
    }
    
    // Filter by school level
    if (selectedLevel) {
      filtered = filtered.filter(staff => 
        staff.levels && staff.levels.includes(selectedLevel)
      )
    }
    
    // Filter by search term (staff name)
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(staff => 
        staff.name.toLowerCase().includes(term)
      )
    }
    
    return filtered
  }, [reportData, filterStatus, selectedLevel, searchTerm])

  // ---------- Stats ----------
  const stats = useMemo(() => {
    const total = reportData.length
    const low = reportData.filter(s => s.status === 'LOW').length
    const normal = reportData.filter(s => s.status === 'NORMAL').length
    const overload = reportData.filter(s => s.status === 'OVERLOAD').length
    const totalPeriods = reportData.reduce((sum, s) => sum + s.totalPeriods, 0)
    const avgPeriods = total > 0 ? Math.round(totalPeriods / total) : 0
    return { total, low, normal, overload, avgPeriods }
  }, [reportData])

  // ============================================
  // RENDER
  // ============================================

  return (
    <AdShellAdmin>
      <div className="container-fluid py-4">
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h4 className="mb-0">Staff Workload Report</h4>
        </div>

        {/* Filters */}
        <div className="row g-3 mb-4">
          <div className="col-md-3">
            <label className="form-label fw-semibold">Academic Year</label>
            <select
              className="form-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              <option value="">Select Year</option>
              {academicYears.map(year => (
                <option key={year.id} value={year.id}>
                  {year.year_name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-md-2">
            <label className="form-label fw-semibold">Term</label>
            <select
              className="form-select"
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
            >
              <option value="">Select Term</option>
              <option value="1">Term 1</option>
              <option value="2">Term 2</option>
              <option value="3">Term 3</option>
              <option value="full">Full Year</option>
            </select>
          </div>

          <div className="col-md-2">
            <label className="form-label fw-semibold">School Level</label>
            <select
              className="form-select"
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
            >
              <option value="">All Levels</option>
              <option value="Primary">Primary</option>
              <option value="Middle">Middle</option>
              <option value="Secondary">Secondary</option>
            </select>
          </div>

          <div className="col-md-3">
            <label className="form-label fw-semibold">Search Staff</label>
            <input
              type="text"
              className="form-control"
              placeholder="Search by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="col-md-2">
            <label className="form-label fw-semibold">Status</label>
            <select
              className="form-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All</option>
              <option value="low">LOW</option>
              <option value="normal">NORMAL</option>
              <option value="overload">OVERLOAD</option>
            </select>
          </div>

          <div className="col-md-12">
            <button 
              className="btn btn-outline-secondary btn-sm"
              onClick={clearFilters}
            >
              <i className="bi bi-x-circle me-1"></i>
              Clear Filters
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {selectedYear && selectedTerm && (
          <div className="row g-3 mb-4">
            <div className="col-md-2">
              <div className="card text-center h-100">
                <div className="card-body">
                  <h5 className="card-title text-muted mb-1" style={{ fontSize: '0.8rem' }}>Total Staff</h5>
                  <h3 className="mb-0">{stats.total}</h3>
                </div>
              </div>
            </div>
            <div className="col-md-2">
              <div className="card text-center h-100" style={{ backgroundColor: '#e8f5e9', borderLeft: '4px solid #2e7d32' }}>
                <div className="card-body">
                  <h5 className="card-title text-muted mb-1" style={{ fontSize: '0.8rem' }}>LOW (Below 28)</h5>
                  <h3 className="mb-0" style={{ color: '#2e7d32' }}>{stats.low}</h3>
                </div>
              </div>
            </div>
            <div className="col-md-2">
              <div className="card text-center h-100" style={{ backgroundColor: '#fff8e1', borderLeft: '4px solid #f57c00' }}>
                <div className="card-body">
                  <h5 className="card-title text-muted mb-1" style={{ fontSize: '0.8rem' }}>Normal (28-35)</h5>
                  <h3 className="mb-0" style={{ color: '#f57c00' }}>{stats.normal}</h3>
                </div>
              </div>
            </div>
            <div className="col-md-2">
              <div className="card text-center h-100" style={{ backgroundColor: '#ffebee', borderLeft: '4px solid #c62828' }}>
                <div className="card-body">
                  <h5 className="card-title text-muted mb-1" style={{ fontSize: '0.8rem' }}>Overload (Above 35)</h5>
                  <h3 className="mb-0" style={{ color: '#c62828' }}>{stats.overload}</h3>
                </div>
              </div>
            </div>
            <div className="col-md-2">
              <div className="card text-center h-100">
                <div className="card-body">
                  <h5 className="card-title text-muted mb-1" style={{ fontSize: '0.8rem' }}>Total Periods</h5>
                  <h3 className="mb-0">{stats.totalPeriods}</h3>
                </div>
              </div>
            </div>
            <div className="col-md-2">
              <div className="card text-center h-100">
                <div className="card-body">
                  <h5 className="card-title text-muted mb-1" style={{ fontSize: '0.8rem' }}>Avg Periods</h5>
                  <h3 className="mb-0">{stats.avgPeriods}</h3>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-2 text-muted">Loading report data...</p>
          </div>
        )}

        {/* No Data */}
        {!loading && selectedYear && selectedTerm && filteredData.length === 0 && (
          <div className="text-center py-5">
            <p className="text-muted">No timetable data found for selected filters.</p>
          </div>
        )}

        {/* No Selection */}
        {!loading && (!selectedYear || !selectedTerm) && (
          <div className="text-center py-5">
            <p className="text-muted">Please select Academic Year and Term to view report.</p>
          </div>
        )}

        {/* Staff Cards Grid */}
        {!loading && filteredData.length > 0 && (
          <div className="row g-4">
            {filteredData.map(staff => {
              const colors = getStatusColor(staff.status)
              return (
                <div key={staff.id} className="col-md-6 col-lg-4">
                  <div 
                    className="card h-100"
                    style={{ 
                      backgroundColor: colors.bg,
                      borderLeft: `5px solid ${colors.border}`
                    }}
                  >
                    <div className="card-body">
                      {/* Staff Name & Status */}
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <h5 className="card-title mb-0" style={{ color: colors.text }}>
                          {staff.name}
                        </h5>
                        <span 
                          className="badge"
                          style={{ 
                            backgroundColor: colors.border,
                            color: 'white',
                            fontSize: '0.7rem'
                          }}
                        >
                          {staff.status}
                        </span>
                      </div>

                      {/* Subjects */}
                      <p className="card-text small mb-2">
                        <strong>Subjects:</strong>{' '}
                        {staff.subjects.length > 0 
                          ? staff.subjects.slice(0, 3).join(', ') + (staff.subjects.length > 3 ? '...' : '')
                          : 'N/A'
                        }
                      </p>

                      {/* School Levels */}
                      {staff.levels && staff.levels.length > 0 && (
                        <p className="card-text small mb-2">
                          <strong>Levels:</strong>{' '}
                          {staff.levels.join(', ')}
                        </p>
                      )}

                      {/* Total Periods */}
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="small text-muted">Total Periods/Week:</span>
                        <span 
                          className="fw-bold"
                          style={{ 
                            fontSize: '1.5rem',
                            color: colors.text
                          }}
                        >
                          {staff.totalPeriods}
                        </span>
                      </div>

                      {/* Status Bar */}
                      <div className="mt-3">
                        <div className="progress" style={{ height: '8px' }}>
                          <div 
                            className="progress-bar" 
                            role="progressbar"
                            style={{ 
                              width: `${Math.min((staff.totalPeriods / 40) * 100, 100)}%`,
                              backgroundColor: colors.border
                            }}
                          />
                        </div>
                        <div className="d-flex justify-content-between small text-muted mt-1">
                          <span>0</span>
                          <span>28</span>
                          <span>35</span>
                          <span>40+</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <ToastContainer position="top-right" autoClose={3000} />
      </div>
    </AdShellAdmin>
  )
}
