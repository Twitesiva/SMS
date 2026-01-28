import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import TransportShell from '../../components/TransportShell'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../store/ui'


const initialForm = {
  routeNo: '',
  routeName: '',
  academicYear: '',
  vehicleRegisterNo: '',
  seatsAvailable: '',
  boardingPoints: [] // Array of { name: '', time: '' }
}

export default function TransportRoutes() {
  const [form, setForm] = useState(initialForm)
  const [academicYears, setAcademicYears] = useState([])
  const [loading, setLoading] = useState(false)
  const [recentRoutes, setRecentRoutes] = useState([])
  const navigate = useNavigate()
  const location = useLocation()

  const [editingRouteId, setEditingRouteId] = useState(null)

  // Boarding point input state
  const [bpName, setBpName] = useState('')
  const [bpTime, setBpTime] = useState('')
  const [editingBpIndex, setEditingBpIndex] = useState(-1)



  useEffect(() => {
    fetchAcademicYears()
    fetchRecentRoutes()
  }, [])

  useEffect(() => {
    if (location.state?.editRoute) {
      loadForEdit(location.state.editRoute)
    }
  }, [location.state])

  const loadForEdit = async (route) => {
    setEditingRouteId(route.id)
    setForm(prev => ({
      ...prev,
      routeNo: route.route_no,
      routeName: route.route_name,
      academicYear: route.academic_year,
      vehicleRegisterNo: route.vehicle_register_no || '',
      seatsAvailable: route.seats_available || '',
      boardingPoints: []
    }))

    try {
      const { data, error } = await supabase
        .from('transport_route_boarding_points')
        .select('*')
        .eq('route_id', route.id)
        .order('stop_order', { ascending: true })

      if (error) throw error

      if (data) {
        const points = data.map(p => ({ name: p.name, time: p.departure_time }))
        setForm(prev => ({ ...prev, boardingPoints: points }))
      }
    } catch (error) {
      console.error('Error loading boarding points:', error)
      showToast('Error loading boarding points', 'error')
    }
  }

  const fetchRecentRoutes = async () => {
    try {
      const { data, error } = await supabase
        .from('transport_routes')
        .select('*')
        .order('id', { ascending: false })
        .limit(3)

      if (error) throw error
      setRecentRoutes(data || [])
    } catch (error) {
      console.error('Error fetching recent routes:', error)
    }
  }

  const fetchAcademicYears = async () => {
    try {
      const { data, error } = await supabase
        .from('academic_year')
        .select('academic_year')
        .order('academic_year', { ascending: false })

      if (error) throw error
      setAcademicYears(data || [])

      const defaultYear = (data || []).find(y => y.academic_year === '2025-2026')
      if (defaultYear) {
        setForm(prev => ({ ...prev, academicYear: defaultYear.academic_year }))
      }

    } catch (error) {
      console.error('Error fetching academic years:', error)
      showToast('Failed to load academic years', 'error')
    }
  }

  const handleAddBoardingPoint = () => {
    if (!bpName.trim() || !bpTime) {
      showToast('Please enter both stop name and departure time', 'warning')
      return
    }

    // Check for duplicate name only if adding new or changing name
    const isDuplicate = form.boardingPoints.some((bp, idx) =>
      idx !== editingBpIndex && bp.name.toLowerCase() === bpName.trim().toLowerCase()
    )

    if (isDuplicate) {
      showToast('This stop name already exists in the list', 'warning')
      return
    }

    if (editingBpIndex > -1) {
      // Update existing
      setForm(prev => {
        const updated = [...prev.boardingPoints]
        updated[editingBpIndex] = { name: bpName.trim(), time: bpTime }
        return { ...prev, boardingPoints: updated }
      })
      setEditingBpIndex(-1)
      showToast('Boarding point updated', 'success')
    } else {
      // Add new
      setForm(prev => ({
        ...prev,
        boardingPoints: [...prev.boardingPoints, { name: bpName.trim(), time: bpTime }]
      }))
    }

    setBpName('')
    setBpTime('')
  }

  const handleEditBoardingPoint = (index) => {
    const bp = form.boardingPoints[index]
    setBpName(bp.name)
    setBpTime(bp.time)
    setEditingBpIndex(index)
  }

  const handleRemoveBoardingPoint = (index) => {
    setForm(prev => ({
      ...prev,
      boardingPoints: prev.boardingPoints.filter((_, i) => i !== index)
    }))
    if (editingBpIndex === index) {
      setEditingBpIndex(-1)
      setBpName('')
      setBpTime('')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.routeNo || !form.routeName || !form.academicYear) {
      showToast('Please fill in all required route details', 'warning')
      return
    }

    if (form.boardingPoints.length === 0) {
      showToast('Please add at least one boarding point', 'warning')
      return
    }

    setLoading(true)
    try {
      let routeId = editingRouteId

      if (editingRouteId) {
        // Update existing route
        const { error: routeError } = await supabase
          .from('transport_routes')
          .update({
            route_no: form.routeNo,
            route_name: form.routeName,
            academic_year: form.academicYear,
            vehicle_register_no: form.vehicleRegisterNo || null,
            seats_available: form.seatsAvailable ? parseInt(form.seatsAvailable) : null
          })
          .eq('id', editingRouteId)

        if (routeError) throw routeError

        // Delete existing points to replace them
        const { error: deleteError } = await supabase
          .from('transport_route_boarding_points')
          .delete()
          .eq('route_id', editingRouteId)

        if (deleteError) throw deleteError

      } else {
        // 1. Insert New Route
        const { data: routeData, error: routeError } = await supabase
          .from('transport_routes')
          .insert({
            route_no: form.routeNo,
            route_name: form.routeName,
            academic_year: form.academicYear,
            vehicle_register_no: form.vehicleRegisterNo || null,
            seats_available: form.seatsAvailable ? parseInt(form.seatsAvailable) : null,
            is_active: true
          })
          .select()
          .single()

        if (routeError) throw routeError
        routeId = routeData.id
      }

      // 2. Insert Boarding Points (for both create and update)
      const pointsToInsert = form.boardingPoints.map((bp, index) => ({
        route_id: routeId,
        name: bp.name,
        departure_time: bp.time,
        stop_order: index + 1
      }))

      const { error: bpError } = await supabase
        .from('transport_route_boarding_points')
        .insert(pointsToInsert)

      if (bpError) {
        if (!editingRouteId) {
          // Rollback route creation if points fail (only for new routes)
          await supabase.from('transport_routes').delete().eq('id', routeId)
        }
        throw bpError
      }

      showToast(`Route ${editingRouteId ? 'updated' : 'created'} successfully!`, 'success')
      setForm({ ...initialForm, academicYear: form.academicYear }) // Reset form but keep selected year
      setEditingRouteId(null)
      fetchRoutes()

      showToast(`Route ${form.routeNo} created successfully!`, 'success')
      setForm({ ...initialForm, academicYear: form.academicYear }) // Reset form but keep selected year
      fetchRecentRoutes()

    } catch (error) {
      console.error('Error creating route:', error)
      if (error.code === '23505') { // Unique constraint violation code
        showToast('A route with this number already exists', 'error')
      } else {
        showToast('Failed to create route: ' + error.message, 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <TransportShell brandTitle="Transport Management" brandSubtitle="Create & Manage Routes">
      <div className="container-fluid px-0">
        <div className="row justify-content-center">
          <div className="col-12">
            <div className="transport-card shadow-sm border-0">
              <div className="card-body p-4">
                <h5 className="mb-4 fw-bold text-dark">{editingRouteId ? 'Edit Transport Route' : 'Add New Transport Route'}</h5>
                <form onSubmit={handleSubmit}>
                  {/* Route Details Section */}
                  <div className="transport-card__header py-3 px-4 mb-4 rounded-3">
                    <h5 className="mb-0 fw-bold text-white">Route Details</h5>
                  </div>
                  <div className="row g-3 mb-4">
                    <div className="col-md-3">
                      <label className="form-label fw-semibold text-secondary small">Academic Year <span className="text-danger">*</span></label>
                      <select
                        className="form-select"
                        value={form.academicYear}
                        onChange={e => setForm({ ...form, academicYear: e.target.value })}
                        disabled={loading}
                      >
                        <option value="">Select Year</option>
                        {academicYears.map(ay => (
                          <option key={ay.academic_year} value={ay.academic_year}>{ay.academic_year}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label fw-semibold text-secondary small">Route No <span className="text-danger">*</span></label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. 10A"
                        value={form.routeNo}
                        onChange={e => setForm({ ...form, routeNo: e.target.value })}
                        disabled={loading}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label fw-semibold text-secondary small">Vehicle No</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. TN-01-AB-1234"
                        value={form.vehicleRegisterNo}
                        onChange={e => setForm({ ...form, vehicleRegisterNo: e.target.value })}
                        disabled={loading}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label fw-semibold text-secondary small">Seats</label>
                      <input
                        type="number"
                        className="form-control"
                        placeholder="e.g. 40"
                        value={form.seatsAvailable}
                        onChange={e => setForm({ ...form, seatsAvailable: e.target.value })}
                        disabled={loading}
                      />
                    </div>
                    <div className="col-md-12">
                      <label className="form-label fw-semibold text-secondary small">Route Name <span className="text-danger">*</span></label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Central Station to Campus"
                        value={form.routeName}
                        onChange={e => setForm({ ...form, routeName: e.target.value })}
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <hr className="my-4 text-muted opacity-25" />

                  {/* Boarding Points Section */}
                  <div className="transport-card__header py-3 px-4 mb-4 rounded-3">
                    <h5 className="mb-0 fw-bold text-white">Boarding Points Configuration</h5>
                  </div>

                  <div className="bg-light p-3 rounded-3 mb-3 border">
                    <div className="row g-2 align-items-end">
                      <div className="col-md-5">
                        <label className="form-label fw-semibold text-secondary small mb-1">Boarding Point Name</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. Main Bus Stand"
                          value={bpName}
                          onChange={e => setBpName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddBoardingPoint())}
                          disabled={loading}
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fw-semibold text-secondary small mb-1">Departure Time</label>
                        <input
                          type="time"
                          className="form-control"
                          value={bpTime}
                          onChange={e => setBpTime(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddBoardingPoint())}
                          disabled={loading}
                        />
                      </div>
                      <div className="col-md-3">
                        <button
                          type="button"
                          className={`btn ${editingBpIndex > -1 ? 'btn-warning' : 'btn-dark'} w-100`}
                          onClick={handleAddBoardingPoint}
                          disabled={loading}
                        >
                          <i className={`bi ${editingBpIndex > -1 ? 'bi-pencil-square' : 'bi-plus-lg'} me-2`}></i>
                          {editingBpIndex > -1 ? 'Update Stop' : 'Add Stop'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Added Points List */}
                  {form.boardingPoints.length > 0 ? (
                    <div className="table-responsive border rounded-3 mb-4">
                      <table className="table table-hover mb-0 align-middle">
                        <thead className="table-light text-secondary">
                          <tr>
                            <th className="ps-3 py-2 small text-uppercase">S NO:</th>
                            <th className="py-2 small text-uppercase">Boarding Point</th>
                            <th className="py-2 small text-uppercase">Departure Time</th>
                            <th className="pe-3 py-2 small text-uppercase text-end">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {form.boardingPoints.map((bp, idx) => (
                            <tr key={idx} className={editingBpIndex === idx ? 'table-active' : ''}>
                              <td className="ps-3 fw-bold text-muted" style={{ width: '80px' }}>
                                {String(idx + 1).padStart(2, '0')}
                              </td>
                              <td className="fw-medium text-dark">{bp.name}</td>
                              <td className="text-secondary font-monospace">{bp.time}</td>
                              <td className="pe-3 text-end">
                                <div className="d-flex justify-content-end gap-2">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary border-0"
                                    onClick={() => handleEditBoardingPoint(idx)}
                                    title="Edit stop"
                                    disabled={loading}
                                  >
                                    <i className="bi bi-pencil"></i>
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger border-0"
                                    onClick={() => handleRemoveBoardingPoint(idx)}
                                    title="Remove stop"
                                    disabled={loading}
                                  >
                                    <i className="bi bi-trash"></i>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}

                  <div className="d-flex justify-content-end gap-3 mt-4">
                    <button
                      type="button"
                      className="btn btn-light border px-4"
                      onClick={() => {
                        setForm(initialForm)
                        setEditingRouteId(null)
                      }}
                      disabled={loading}
                    >
                      {editingRouteId ? 'Cancel Edit' : 'Reset Form'}
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary px-5 fw-bold shadow-sm"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          Saving...
                        </>
                      ) : (
                        <>
                          <i className={`bi ${editingRouteId ? 'bi-save' : 'bi-check-lg'} me-2`}></i>
                          {editingRouteId ? 'Update Route' : 'Create Route'}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>


        </div>

        {/* Recent Routes Section */}
        {recentRoutes.length > 0 && (
          <div className="row justify-content-center mt-4">
            <div className="col-12">
              <div className="transport-card shadow-sm border-0">
                <div className="transport-card__header py-3 px-4 d-flex justify-content-between align-items-center rounded-top">
                  <h5 className="mb-0 fw-bold text-white">Recently Created Routes</h5>
                  {recentRoutes.length > 2 && (
                    <button
                      className="btn btn-sm btn-light text-primary fw-bold"
                      onClick={() => navigate('/transport/view-routes')}
                    >
                      View All
                    </button>
                  )}
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-hover mb-0 align-middle">
                      <thead className="table-light">
                        <tr>
                          <th className="ps-4 py-3 text-secondary small text-uppercase">Route No</th>
                          <th className="py-3 text-secondary small text-uppercase">Route Name</th>
                          <th className="py-3 text-secondary small text-uppercase">Vehicle No</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentRoutes.slice(0, 2).map((route) => (
                          <tr key={route.id}>
                            <td className="ps-4 fw-bold text-dark">{route.route_no}</td>
                            <td className="text-dark">{route.route_name}</td>
                            <td className="text-muted small">{route.vehicle_register_no || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

    </TransportShell>
  )
}