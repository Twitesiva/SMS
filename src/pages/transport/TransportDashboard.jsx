import React, { useEffect, useState, useMemo } from 'react'
import { useTransportAuth } from '../../store/transportAuth'
import TransportShell from '../../components/TransportShell'
import { Link } from 'react-router-dom'
import { api } from '../../lib/mockApi'
import { showToast } from '../../store/ui'

export default function TransportDashboard() {
  const { transportUser } = useTransportAuth()
  const [routes, setRoutes] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [routesData, vehiclesData] = await Promise.all([
          api.listTransportRoutes(),
          api.listTransportVehicles()
        ])
        setRoutes(routesData || [])
        setVehicles(vehiclesData || [])
      } catch (error) {
        console.error('Failed to load dashboard data', error)
        showToast('Unable to load dashboard data', { type: 'danger' })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const totalBoardingPoints = useMemo(() => 
    routes.reduce((sum, route) => sum + (route.boardingPoints?.length || 0), 0), 
    [routes]
  )

  const academicYears = useMemo(() => Array.from(
    new Set(routes.flatMap((route) => route.amounts?.map((a) => a.academicYear) || []))
  ), [routes])

  return (
    <TransportShell>
      <div className="container-fluid">
        <div className="row">
          <div className="col-12">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
              <div>
                <h1 className="h3 mb-1">Transport Dashboard</h1>
                <p className="text-muted mb-0">Welcome, {transportUser?.email}</p>
              </div>
              <div className="d-flex gap-2">
                <Link className="btn btn-outline-primary" to="/transport/vehicles">
                    <i className="bi bi-truck me-2"></i>Manage Vehicles
                </Link>
                <Link className="btn btn-primary" to="/transport/routes">
                  <i className="bi bi-map me-2"></i>Manage Routes
                </Link>
              </div>
            </div>

            <div className="row g-3">
              <div className="col-12 col-md-3">
                <div className="card shadow-sm border-0 h-100">
                  <div className="card-body">
                    <div className="text-muted text-uppercase small fw-semibold mb-1">Routes</div>
                    <div className="display-6 mb-0">{loading ? '-' : routes.length}</div>
                    <p className="text-muted small mb-0">Active routes configured</p>
                  </div>
                </div>
              </div>
              <div className="col-12 col-md-3">
                <div className="card shadow-sm border-0 h-100">
                  <div className="card-body">
                    <div className="text-muted text-uppercase small fw-semibold mb-1">Vehicles</div>
                    <div className="display-6 mb-0">{loading ? '-' : vehicles.length}</div>
                    <p className="text-muted small mb-0">Total fleet size</p>
                  </div>
                </div>
              </div>
              <div className="col-12 col-md-3">
                <div className="card shadow-sm border-0 h-100">
                  <div className="card-body">
                    <div className="text-muted text-uppercase small fw-semibold mb-1">Boarding Points</div>
                    <div className="display-6 mb-0">{loading ? '-' : totalBoardingPoints}</div>
                    <p className="text-muted small mb-0">Across all routes</p>
                  </div>
                </div>
              </div>
              <div className="col-12 col-md-3">
                <div className="card shadow-sm border-0 h-100">
                  <div className="card-body">
                    <div className="text-muted text-uppercase small fw-semibold mb-1">Academic Years</div>
                    <div className="display-6 mb-0">{loading ? '-' : academicYears.length}</div>
                    <p className="text-muted small mb-0">Fare variations tracked</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="row mt-4 g-4">
                <div className="col-12 col-lg-8">
                    <div className="card shadow-sm border-0 h-100">
                    <div className="card-body">
                        <h5 className="card-title mb-3">Recent Routes</h5>
                        {loading ? (
                            <p className="text-muted">Loading...</p>
                        ) : routes.length === 0 ? (
                        <p className="text-muted mb-0">No routes saved yet. Start by adding one.</p>
                        ) : (
                        <div className="d-flex flex-column gap-3">
                            {routes.slice(0, 5).map((route) => (
                            <div key={route.routeNo} className="d-flex align-items-center justify-content-between p-3 border rounded bg-light-subtle">
                                <div>
                                <div className="d-flex align-items-center gap-2 mb-1">
                                    <span className="badge bg-primary">Route {route.routeNo}</span>
                                    <span className="fw-semibold">{route.routeName}</span>
                                </div>
                                <div className="text-muted small">
                                    {route.boardingPoints?.length || 0} boarding points ·{' '}
                                    {(route.amounts && route.amounts.length > 0) 
                                        ? `Fees set for ${route.amounts.length} years` 
                                        : 'No fees set'}
                                </div>
                                </div>
                                <Link to="/transport/routes" className="btn btn-sm btn-outline-secondary">
                                View
                                </Link>
                            </div>
                            ))}
                        </div>
                        )}
                    </div>
                    </div>
                </div>
                <div className="col-12 col-lg-4">
                    <div className="card shadow-sm border-0 h-100">
                        <div className="card-body">
                            <h5 className="card-title mb-3">Recent Vehicles</h5>
                            {loading ? (
                                <p className="text-muted">Loading...</p>
                            ) : vehicles.length === 0 ? (
                                <p className="text-muted mb-0">No vehicles added yet.</p>
                            ) : (
                                <div className="d-flex flex-column gap-2">
                                    {vehicles.slice(0, 5).map(vehicle => (
                                        <div key={vehicle.vehicleNo} className="d-flex align-items-center justify-content-between border-bottom pb-2 mb-2 last-no-border">
                                            <div>
                                                <div className="fw-semibold">{vehicle.vehicleNo}</div>
                                                <div className="small text-muted">
                                                    Assigned to Route {vehicle.routeNo || 'N/A'}
                                                </div>
                                            </div>
                                            <span className="badge bg-success-subtle text-success border border-success-subtle">Active</span>
                                        </div>
                                    ))}
                                    {vehicles.length > 5 && (
                                        <Link to="/transport/vehicles" className="text-center small text-decoration-none mt-2">
                                            View all {vehicles.length} vehicles
                                        </Link>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

          </div>
        </div>
      </div>
    </TransportShell>
  )
}