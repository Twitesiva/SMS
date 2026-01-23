import React, { useEffect, useState, useMemo } from 'react'
import { useTransportAuth } from '../../store/transportAuth'
import TransportShell from '../../components/TransportShell'
import { Link } from 'react-router-dom'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../store/ui'

export default function TransportDashboard() {
  const { transportUser } = useTransportAuth()
  const [routes, setRoutes] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [boardingPointsCount, setBoardingPointsCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        // 1. Fetch Routes with Boarding Points Count
        const { data: routesData, error: routesError } = await supabase
          .from('transport_routes')
          .select('*, transport_route_boarding_points(count)')
          .order('created_at', { ascending: false })

        if (routesError) throw routesError

        // 2. Fetch Vehicles (try independent table first, fall back to extracting from routes if empty/error?)
        // The schema shows transport_vehicles table exists.
        const { data: vehiclesData, error: vehiclesError } = await supabase
          .from('transport_vehicles')
          .select('*')
          .order('created_at', { ascending: false })

        // Note: if vehiclesError, we might just ignore it or show 0 vehicles. 
        // Or if the table is empty, we check transport_routes.vehicle_register_no? 
        // For now, let's assume the table is the source of truth for "Fleet".

        // 3. Get total boarding points
        // We can sum the counts from routesData or do a separate count query.
        // Doing a separate count query is cleaner for global total.
        const { count: bpCount, error: bpError } = await supabase
          .from('transport_route_boarding_points')
          .select('*', { count: 'exact', head: true })

        setRoutes(routesData || [])
        setVehicles(vehiclesData || [])
        setBoardingPointsCount(bpCount || 0)

      } catch (error) {
        console.error('Failed to load dashboard data', error)
        showToast('Unable to load dashboard data', { type: 'error' })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const academicYears = useMemo(() => {
    const years = new Set(routes.map(r => r.academic_year).filter(Boolean))
    return years.size
  }, [routes])

  // If transport_vehicles table is empty but routes have vehicle numbers, we count those?
  // User asked to fix based on database. The provided schema has transport_vehicles table. 
  // But previously user added vehicle_register_no to transport_routes.
  // I will mix: If vehicles array is empty, I'll check routes for unique vehicle_register_no for the count.
  const vehicleCount = useMemo(() => {
    if (vehicles.length > 0) return vehicles.length;
    const fromRoutes = new Set(routes.map(r => r.vehicle_register_no).filter(Boolean));
    return fromRoutes.size;
  }, [vehicles, routes]);


  return (
    <TransportShell>
      <div className="container-fluid">
        <div className="row">
          <div className="col-12">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
              <div>
                <h1 className="h3 mb-1">Transport Dashboard</h1>
              </div>
              <div className="d-flex gap-2">
                {/* Manage Vehicles button removed as requested */}
                <Link className="btn btn-primary" to="/transport/routes">
                  <i className="bi bi-map me-2"></i>Manage Routes
                </Link>
              </div>
            </div>

            {/* Stats Request */}
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
                    <div className="display-6 mb-0">{loading ? '-' : vehicleCount}</div>
                    <p className="text-muted small mb-0">Total fleet size</p>
                  </div>
                </div>
              </div>
              <div className="col-12 col-md-3">
                <div className="card shadow-sm border-0 h-100">
                  <div className="card-body">
                    <div className="text-muted text-uppercase small fw-semibold mb-1">Boarding Points</div>
                    <div className="display-6 mb-0">{loading ? '-' : boardingPointsCount}</div>
                    <p className="text-muted small mb-0">Across all routes</p>
                  </div>
                </div>
              </div>
              <div className="col-12 col-md-3">
                <div className="card shadow-sm border-0 h-100">
                  <div className="card-body">
                    <div className="text-muted text-uppercase small fw-semibold mb-1">Academic Years</div>
                    <div className="display-6 mb-0">{loading ? '-' : academicYears}</div>
                    <p className="text-muted small mb-0">Distinct years</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="row mt-4 g-4">
              {/* Recent Routes */}
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
                          <div key={route.id} className="d-flex align-items-center justify-content-between p-3 border rounded bg-light-subtle">
                            <div>
                              <div className="d-flex align-items-center gap-2 mb-1">
                                <span className="badge bg-primary">Route {route.route_no}</span>
                                <span className="fw-semibold">{route.route_name}</span>
                              </div>
                              <div className="text-muted small">
                                {route.transport_route_boarding_points?.[0]?.count || 0} boarding points ·{' '}
                                <span className="text-dark">{route.academic_year}</span>
                                {route.vehicle_register_no && ` · Vehicle: ${route.vehicle_register_no}`}
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

              {/* Recent Vehicles - Simplified if fleet table is empty but routes have vehicles */}
              <div className="col-12 col-lg-4">
                <div className="card shadow-sm border-0 h-100">
                  <div className="card-body">
                    <h5 className="card-title mb-3">Recent Vehicles</h5>
                    {loading ? (
                      <p className="text-muted">Loading...</p>
                    ) : (vehicles.length === 0 && vehicleCount === 0) ? (
                      <p className="text-muted mb-0">No vehicles added yet.</p>
                    ) : (
                      <div className="d-flex flex-column gap-2">
                        {vehicles.length > 0 ? (
                          // Display from transport_vehicles table
                          vehicles.slice(0, 5).map(vehicle => (
                            <div key={vehicle.id} className="d-flex align-items-center justify-content-between border-bottom pb-2 mb-2 last-no-border">
                              <div>
                                <div className="fw-semibold">{vehicle.vehicle_no}</div>
                                <div className="small text-muted">
                                  {vehicle.status}
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          // Display from routes logic if table is empty
                          routes.filter(r => r.vehicle_register_no).slice(0, 5).map(route => (
                            <div key={`v-${route.id}`} className="d-flex align-items-center justify-content-between border-bottom pb-2 mb-2 last-no-border">
                              <div>
                                <div className="fw-semibold">{route.vehicle_register_no}</div>
                                <div className="small text-muted">
                                  Assigned to Route {route.route_no}
                                </div>
                              </div>
                              <span className="badge bg-success-subtle text-success border border-success-subtle">Active</span>
                            </div>
                          ))
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