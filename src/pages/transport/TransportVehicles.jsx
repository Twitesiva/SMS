import { useEffect, useState } from 'react'
import TransportShell from '../../components/TransportShell'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../store/ui'



export default function TransportVehicles() {
  const [routes, setRoutes] = useState([])
  const [academicYears, setAcademicYears] = useState([])
  const [selectedYear, setSelectedYear] = useState('')

  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [modalLoading, setModalLoading] = useState(false)
  const [selectedRouteDetails, setSelectedRouteDetails] = useState(null)

  useEffect(() => {
    fetchAcademicYears()
    fetchRoutes()
  }, [])

  const fetchAcademicYears = async () => {
    try {
      const { data, error } = await supabase
        .from('academic_year')
        .select('academic_year')
        .order('academic_year', { ascending: false })

      if (error) throw error
      setAcademicYears(data || [])
      if (data && data.length > 0) {
        const defaultYear = data.find(y => y.academic_year === '2025-2026')
        setSelectedYear(defaultYear ? defaultYear.academic_year : data[0].academic_year)
      }
    } catch (error) {
      console.error('Error fetching academic years:', error)
      showToast('Failed to load academic years', 'error')
    }
  }

  const fetchRoutes = async () => {
    try {
      const { data, error } = await supabase
        .from('transport_routes')
        .select('*')
        .order('route_no', { ascending: true })

      if (error) throw error

      const processedRoutes = (data || []).map(route => ({
        ...route,
        reserved_count: route.reserved_seats || 0
      }))

      setRoutes(processedRoutes)
    } catch (error) {
      console.error('Error fetching routes:', error)
      showToast('Failed to load routes', 'error')
    }
  }

  const handleRouteClick = async (routeId) => {
    setShowModal(true)
    setModalLoading(true)
    try {
      // 1. Fetch Route Details
      const { data: routeData, error: routeError } = await supabase
        .from('transport_routes')
        .select('*')
        .eq('id', routeId)
        .single()

      if (routeError) throw routeError

      // 2. Fetch Boarding Points (needed for student details)
      const { data: bpData, error: bpError } = await supabase
        .from('transport_route_boarding_points')
        .select('*')
        .eq('route_id', routeId)
        .order('stop_order', { ascending: true })

      if (bpError) throw bpError

      // 3. Fetch Registered Students
      const { data: studData, error: studError } = await supabase
        .from('student_transport')
        .select(`
          id,
          students (full_name, student_id, course_name, group_name, academic_year),
          transport_route_boarding_points (name, departure_time)
        `)
        .eq('route_id', routeId)

      if (studError) throw studError

      setSelectedRouteDetails({
        route: routeData,
        boardingPoints: bpData || [],
        students: studData || []
      })

    } catch (error) {
      console.error('Error fetching route details:', error)
      showToast('Failed to load route details', 'error')
      setShowModal(false)
    } finally {
      setModalLoading(false)
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setSelectedRouteDetails(null)
  }

  // --- Chart Data Preparation ---
  const filteredRoutes = routes.filter(r => !selectedYear || r.academic_year === selectedYear)

  // 1. Availability Status by Route (Top 5)
  const topRoutes = filteredRoutes.slice(0, 5)

  const occupancyChartData = {
    labels: topRoutes.map(r => r.route_no),
    datasets: [
      {
        label: 'Reserved',
        data: topRoutes.map(r => r.reserved_count),
        backgroundColor: '#4361ee', // Blue
        borderRadius: 4,
        barPercentage: 0.6,
      },
      {
        label: 'Available',
        data: topRoutes.map(r => (r.seats_available || 0) - r.reserved_count),
        backgroundColor: '#e9ecef', // Light gray
        borderRadius: 4,
        barPercentage: 0.6,
      }
    ]
  }

  const occupancyChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', align: 'end', labels: { boxWidth: 10, usePointStyle: true } },
      title: { display: false }
    },
    scales: {
      x: { stacked: true, grid: { display: false } },
      y: { stacked: true, grid: { borderDash: [2, 4] }, beginAtZero: true }
    }
  }

  // 2. Total Capacity Analysis
  const totalCapacity = filteredRoutes.reduce((acc, curr) => acc + (curr.seats_available || 0), 0)
  const totalReserved = filteredRoutes.reduce((acc, curr) => acc + curr.reserved_count, 0)
  const totalAvailable = totalCapacity - totalReserved

  const capacityChartData = {
    labels: ['Reserved', 'Available'],
    datasets: [
      {
        data: [totalReserved, totalAvailable],
        backgroundColor: ['#2ec4b6', '#ff9f1c'], // Teal and Orange
        borderWidth: 0
      }
    ]
  }

  const capacityChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right', labels: { usePointStyle: true } }
    },
    cutout: '70%'
  }

  // 3. Route density (Percentage Full)
  const densityChartData = {
    labels: topRoutes.map(r => r.route_no),
    datasets: [
      {
        label: 'Occupancy %',
        data: topRoutes.map(r => {
          const cap = r.seats_available || 0
          return cap > 0 ? ((r.reserved_count / cap) * 100).toFixed(1) : 0
        }),
        backgroundColor: '#3a0ca3', // Dark Blue
        borderRadius: 4,
        barPercentage: 0.5,
      }
    ]
  }

  const densityChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: { beginAtZero: true, max: 100, grid: { borderDash: [2, 4] } },
      x: { grid: { display: false } }
    }
  }

  return (
    <TransportShell brandTitle="Transport Management" brandSubtitle="Seats Availability">
      <div className="container-fluid px-0">
        <div className="row justify-content-center">

          <div className="col-12">
            <div className="transport-card shadow-sm border-0">
              <div className="transport-card__header py-3 d-flex justify-content-between align-items-center px-4 text-white">
                <h5 className="mb-0 fw-bold">Seats Availability</h5>
              </div>

              <div className="p-3 bg-light border-bottom">
                <div className="row">
                  <div className="col-md-3">
                    <label className="form-label fw-bold text-secondary small text-uppercase">Select Academic Year</label>
                    <select
                      className="form-select"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                    >
                      <option value="">All Years</option>
                      {academicYears.map(year => (
                        <option key={year.academic_year} value={year.academic_year}>
                          {year.academic_year}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-bordered table-hover align-middle mb-0">
                    <thead className="transport-card__header text-white">
                      <tr>
                        <th style={{ width: '10%' }} className="ps-4 py-3 fw-bold text-white text-uppercase border-end-0 fs-6">Route No</th>
                        <th style={{ width: '25%' }} className="py-3 fw-bold text-white text-uppercase border-start-0 border-end-0 fs-6">Route Name</th>
                        <th style={{ width: '20%' }} className="py-3 fw-bold text-white text-uppercase border-start-0 border-end-0 fs-6">Vehicle No</th>
                        <th style={{ width: '10%' }} className="py-3 text-center fw-bold text-white text-uppercase border-start-0 border-end-0 fs-6">Total Seats</th>
                        <th style={{ width: '10%' }} className="py-3 text-center fw-bold text-white text-uppercase border-start-0 border-end-0 fs-6">Reserved</th>
                        <th style={{ width: '10%' }} className="py-3 text-center fw-bold text-white text-uppercase border-start-0 border-end-0 fs-6">Available</th>
                      </tr>
                    </thead>
                    <tbody>
                      {routes.filter(r => !selectedYear || r.academic_year === selectedYear).length > 0 ? (
                        routes.filter(r => !selectedYear || r.academic_year === selectedYear).map((route) => (
                          <tr
                            key={route.id}
                            onClick={() => handleRouteClick(route.id)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td className="ps-4 fw-bold text-dark">{route.route_no}</td>
                            <td className="text-dark">{route.route_name}</td>
                            <td className="text-muted small">{route.vehicle_register_no || '-'}</td>
                            <td className="text-muted small text-center">{route.seats_available || 0}</td>
                            <td className="text-muted small text-center">{route.reserved_count}</td>
                            <td className={`small fw-bold text-center ${Math.max(0, (route.seats_available || 0) - route.reserved_count) > 0 ? 'text-success' : 'text-danger'}`}>
                              {Math.max(0, (route.seats_available || 0) - route.reserved_count)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="text-center py-5 text-muted">
                            <div className="d-flex flex-column align-items-center opacity-50">
                              <i className="bi bi-exclamation-circle fs-4 mb-2"></i>
                              <p className="mb-0 small">No routes found.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Modal - Shows ONLY Registered Students */}
      {showModal && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }} tabIndex="-1">
          <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header transport-card__header text-white">
                <h5 className="modal-title fw-bold">
                  {modalLoading ? 'Loading...' : 'Overview'}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={closeModal} aria-label="Close"></button>
              </div>
              <div className="modal-body bg-light">
                {modalLoading ? (
                  <div className="d-flex justify-content-center py-5">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                ) : selectedRouteDetails && (
                  <div className="row g-4">
                    {/* Route Overview Section */}
                    <div className="col-12">
                      <div className="card border-0 shadow-sm">
                        <div className="card-body">
                          <div className="d-flex flex-column gap-2 mb-3">
                            <div className="fw-bold fs-6">
                              <span className="text-secondary text-uppercase" style={{ minWidth: '120px', display: 'inline-block' }}>Route Name :</span>
                              <span className="text-dark ms-2">{selectedRouteDetails.route.route_name}</span>
                            </div>
                            <div className="fw-bold fs-6">
                              <span className="text-secondary text-uppercase" style={{ minWidth: '120px', display: 'inline-block' }}>Route No :</span>
                              <span className="text-dark ms-2">{selectedRouteDetails.route.route_no}</span>
                            </div>
                            <div className="fw-bold fs-6">
                              <span className="text-secondary text-uppercase" style={{ minWidth: '120px', display: 'inline-block' }}>Vehicle No :</span>
                              <span className="text-dark ms-2">{selectedRouteDetails.route.vehicle_register_no || '-'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Registered Students Only - Full Width */}
                    <div className="col-12">
                      <div className="card border-0 shadow-sm h-100">
                        <div className="card-header bg-white py-3">
                          <h6 className="mb-0 fw-bold">Total Registered Students : {String(selectedRouteDetails.students.length).padStart(2, '0')}</h6>
                        </div>
                        <div className="table-responsive" style={{ maxHeight: '600px' }}>
                          <table className="table table-hover mb-0 align-middle">
                            <thead className="transport-card__header sticky-top">
                              <tr>
                                <th className="ps-3 text-white text-uppercase fw-bold border-end-0 fs-6">Student ID</th>
                                <th className="text-white text-uppercase fw-bold border-start-0 border-end-0 fs-6">Student Name</th>
                                <th className="text-white text-uppercase fw-bold border-start-0 border-end-0 fs-6">Boarding Point</th>
                                <th className="text-end pe-3 text-white text-uppercase fw-bold border-start-0 fs-6">Boarding Time</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedRouteDetails.students.length > 0 ? (
                                selectedRouteDetails.students.map((st, idx) => (
                                  <tr key={idx}>
                                    <td className="ps-3 fw-bold text-dark">{st.students?.student_id}</td>
                                    <td className="text-dark">{st.students?.full_name}</td>
                                    <td>{st.transport_route_boarding_points?.name}</td>
                                    <td className="text-end pe-3 font-monospace text-muted">{st.transport_route_boarding_points?.departure_time}</td>
                                  </tr>
                                ))
                              ) : (
                                <tr><td colSpan="4" className="text-center text-muted py-3">No students registered</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer border-0 bg-light">
                <button type="button" className="btn btn-secondary px-4" onClick={closeModal}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </TransportShell>
  )
}
