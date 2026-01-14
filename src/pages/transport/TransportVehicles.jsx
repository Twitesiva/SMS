import { useEffect, useState } from 'react'
import TransportShell from '../../components/TransportShell'
import { api } from '../../lib/mockApi'
import { showToast } from '../../store/ui'

const initialForm = {
  vehicleNo: '',
  routeNo: ''
}

export default function TransportVehicles() {
  const [vehicles, setVehicles] = useState([])
  const [routes, setRoutes] = useState([])
  const [form, setForm] = useState(initialForm)
  const [editingVehicle, setEditingVehicle] = useState('')
  const [loading, setLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [vehicleRows, routeRows] = await Promise.all([
        api.listTransportVehicles(),
        api.listTransportRoutes()
      ])
      setVehicles(vehicleRows || [])
      setRoutes(routeRows || [])
    } catch (error) {
      console.error('Failed to load transport data', error)
      showToast('Unable to load data', { type: 'danger' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const upsertVehicle = async (event) => {
    event.preventDefault()
    const vehicleNo = form.vehicleNo.trim().toUpperCase()
    const routeNo = form.routeNo.trim()

    if (!vehicleNo) {
      showToast('Vehicle number is required', { type: 'warning' })
      return
    }
    if (!routeNo) {
      showToast('Please select a route', { type: 'warning' })
      return
    }

    setLoading(true)
    try {
      await api.upsertTransportVehicle({
        vehicleNo,
        routeNo
      })
      showToast(
        editingVehicle ? 'Vehicle updated successfully' : 'Vehicle added successfully',
        { type: 'success' }
      )
      setForm(initialForm)
      setEditingVehicle('')
      fetchData()
    } catch (error) {
      console.error('Failed to save vehicle', error)
      showToast(error.message || 'Failed to save vehicle', { type: 'danger' })
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (vehicle) => {
    setEditingVehicle(vehicle.vehicleNo)
    setForm({
      vehicleNo: vehicle.vehicleNo,
      routeNo: vehicle.routeNo
    })
  }

  const removeVehicle = async (vehicleNo) => {
    if (!window.confirm(`Are you sure you want to delete vehicle ${vehicleNo}?`)) return
    
    setLoading(true)
    try {
      await api.deleteTransportVehicle(vehicleNo)
      showToast('Vehicle removed successfully', { type: 'success' })
      if (editingVehicle === vehicleNo) {
        setForm(initialForm)
        setEditingVehicle('')
      }
      fetchData()
    } catch (error) {
      console.error('Failed to delete vehicle', error)
      showToast('Failed to delete vehicle', { type: 'danger' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <TransportShell brandTitle="Transport Management" brandSubtitle="Manage Fleet">
      <div className="container-fluid px-0">
        <div className="row g-4">
          <div className="col-12 col-xl-4">
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex align-items-start justify-content-between">
                  <div>
                    <h5 className="card-title mb-1">
                      {editingVehicle ? 'Update Vehicle' : 'Add Vehicle'}
                    </h5>
                    <p className="text-muted small mb-3">
                      Assign a vehicle to a specific route.
                    </p>
                  </div>
                  {editingVehicle && (
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => {
                        setForm(initialForm)
                        setEditingVehicle('')
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <form className="d-grid gap-3" onSubmit={upsertVehicle}>
                  <div>
                    <label className="form-label fw-semibold">Vehicle Number</label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.vehicleNo}
                      onChange={(event) => setForm((prev) => ({ ...prev, vehicleNo: event.target.value.toUpperCase() }))}
                      placeholder="e.g. AP 03 Z 1234"
                      required
                      disabled={loading || !!editingVehicle} // Vehicle No is PK, so maybe prevent edit or handle as delete+insert
                    />
                    {editingVehicle && <div className="form-text text-muted">Vehicle number cannot be changed. Delete and re-create if needed.</div>}
                  </div>

                  <div>
                    <label className="form-label fw-semibold">Assigned Route</label>
                    <select
                      className="form-select"
                      value={form.routeNo}
                      onChange={(event) => setForm((prev) => ({ ...prev, routeNo: event.target.value }))}
                      required
                      disabled={loading}
                    >
                      <option value="">Select Route</option>
                      {routes.map((route) => (
                        <option key={route.routeNo} value={route.routeNo}>
                          Route {route.routeNo} - {route.routeName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button type="submit" className="btn btn-success" disabled={loading}>
                    {loading ? 'Saving...' : (editingVehicle ? 'Update Assignment' : 'Save Vehicle')}
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-8">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h5 className="mb-0">Fleet Overview</h5>
              <span className="badge bg-primary rounded-pill">{vehicles.length} Vehicles</span>
            </div>

            {vehicles.length === 0 ? (
              <div className="alert alert-info">No vehicles found. Add one to get started.</div>
            ) : (
              <div className="card shadow-sm border-0">
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th className="ps-4">Vehicle Number</th>
                        <th>Route Number</th>
                        <th>Route Name</th>
                        <th className="text-end pe-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vehicles.map((vehicle) => {
                        const route = routes.find(r => r.routeNo === vehicle.routeNo)
                        return (
                          <tr key={vehicle.vehicleNo}>
                            <td className="ps-4 fw-semibold">{vehicle.vehicleNo}</td>
                            <td>
                              <span className="badge bg-light text-dark border">
                                {vehicle.routeNo}
                              </span>
                            </td>
                            <td className="text-muted small">
                              {route?.routeName || <span className="text-danger">Route not found</span>}
                            </td>
                            <td className="text-end pe-4">
                              <div className="btn-group">
                                <button 
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => startEdit(vehicle)}
                                  disabled={loading}
                                >
                                  Edit
                                </button>
                                <button 
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => removeVehicle(vehicle.vehicleNo)}
                                  disabled={loading}
                                >
                                  Remove
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </TransportShell>
  )
}
