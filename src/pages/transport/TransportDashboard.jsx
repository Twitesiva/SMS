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
        const { data: vehiclesData, error: vehiclesError } = await supabase
          .from('transport_vehicles')
          .select('*')
          .order('created_at', { ascending: false })

        // 3. Get total boarding points
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

  const vehicleCount = useMemo(() => {
    if (vehicles.length > 0) return vehicles.length;
    const fromRoutes = new Set(routes.map(r => r.vehicle_register_no).filter(Boolean));
    return fromRoutes.size;
  }, [vehicles, routes]);

  const metrics = [
    {
      label: "Routes",
      value: loading ? '-' : routes.length,
      detail: "Active routes configured",
      icon: "bi-map",
      path: "/transport/routes"
    },
    {
      label: "Vehicles",
      value: loading ? '-' : vehicleCount,
      detail: "Total fleet size",
      icon: "bi-truck-front", // or bi-bus-front if available
      path: "/transport/vehicles" // Note: This route might need to be created/verified
    },
    {
      label: "Boarding Points",
      value: loading ? '-' : boardingPointsCount,
      detail: "Across all routes",
      icon: "bi-geo-alt",
      path: "/transport/routes"
    },
    {
      label: "Academic Years",
      value: loading ? '-' : academicYears,
      detail: "Distinct years",
      icon: "bi-calendar-event",
      path: "/transport/routes"
    }
  ]

  return (
    <TransportShell>
      <div className="desktop-container admin-content" style={{ overflowX: 'hidden' }}>
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
          <h4 className="mb-0">Transport Dashboard</h4>
          <div className="d-flex gap-2">
            <Link className="btn btn-primary" to="/transport/routes">
              <i className="bi bi-map me-2"></i>Manage Routes
            </Link>
          </div>
        </div>

        <section className="mb-5">
          <div className="dashboard-cards">
            {metrics.map((metric) => (
              <Link
                key={metric.label}
                to={metric.path}
                className="dashboard-card card-shadow dashboard-card-link"
                style={{ textDecoration: 'none' }}
              >
                <div className="dashboard-card-icon">
                  <i className={`bi ${metric.icon}`}></i>
                </div>
                <div>
                  <div className="dashboard-card-value">{metric.value}</div>
                  <div className="dashboard-card-label">{metric.label}</div>
                  <p className="mb-0 fw-bold">{metric.detail}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="mb-5">
          <div className="row g-4">
            {/* Recent Routes */}
            <div className="col-12 col-lg-8">
              <div className="dashboard-chart-card card-shadow h-100">
                <div className="dashboard-chart-header">
                  <h3>Recent Routes</h3>
                  <p className="mb-0 fw-bold">Latest route additions</p>
                </div>
                <div className="card-body px-0">
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

            {/* Recent Vehicles */}
            <div className="col-12 col-lg-4">
              <div className="dashboard-chart-card card-shadow h-100">
                <div className="dashboard-chart-header">
                  <h3>Recent Vehicles</h3>
                  <p className="mb-0 fw-bold">Fleet status overview</p>
                </div>
                <div className="card-body px-0">
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
        </section>
      </div>
    </TransportShell>
  )
}