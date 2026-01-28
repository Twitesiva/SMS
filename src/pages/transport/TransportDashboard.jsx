import React, { useEffect, useState, useMemo } from 'react'
import { useTransportAuth } from '../../store/transportAuth'
import TransportShell from '../../components/TransportShell'
import { Link, useNavigate } from 'react-router-dom' // Added useNavigate
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../store/ui'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
)

export default function TransportDashboard() {
  const { transportUser } = useTransportAuth()
  const navigate = useNavigate() // Initialize hook
  const [routes, setRoutes] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [boardingPointsCount, setBoardingPointsCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        // 1. Fetch Routes
        const { data: routesData, error: routesError } = await supabase
          .from('transport_routes')
          .select(`
            *,
            transport_route_boarding_points (count)
          `)
          .order('route_no', { ascending: true })

        if (routesError) throw routesError

        // 2. Fetch Vehicles
        const { data: vehiclesData, error: vehiclesError } = await supabase
          .from('transport_vehicles')
          .select('*')
          .order('created_at', { ascending: false })

        // 3. Fetch Confirmed Students Count
        const { data: confirmedStudents, error: studentsError } = await supabase
          .from('student_transport')
          .select('route_id')
          .eq('status', 'CONFIRMED')

        if (studentsError) throw studentsError

        // Calculate reserved count per route
        const reservedCounts = {}
        if (confirmedStudents) {
          confirmedStudents.forEach(s => {
            reservedCounts[s.route_id] = (reservedCounts[s.route_id] || 0) + 1
          })
        }

        // 4. Get total boarding points
        const { count: bpCount, error: bpError } = await supabase
          .from('transport_route_boarding_points')
          .select('*', { count: 'exact', head: true })

        const processedRoutes = (routesData || []).map(route => ({
          ...route,
          reserved_count: reservedCounts[route.id] || 0
        }))

        setRoutes(processedRoutes)
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

  const totalReserved = useMemo(() => {
    return routes.reduce((sum, route) => sum + (route.reserved_count || 0), 0)
  }, [routes])

  const totalSeats = useMemo(() => {
    return routes.reduce((sum, route) => sum + (route.seats_available || 0), 0)
  }, [routes])

  const vehicleCount = useMemo(() => {
    if (vehicles.length > 0) return vehicles.length;
    const fromRoutes = new Set(routes.map(r => r.vehicle_register_no).filter(Boolean));
    return fromRoutes.size;
  }, [vehicles, routes]);

  const handleChartClick = (event, elements) => {
    if (elements && elements.length > 0) {
      navigate('/transport/vehicles')
    }
  }

  // Chart Data Preparation
  const barChartData = {

    labels: routes.map(r => r.route_no),
    datasets: [
      {
        label: 'Reserved',
        data: routes.map(r => r.reserved_count || 0),
        backgroundColor: '#4e73df', // Admin dashboard blue
        maxBarThickness: 50,
      },
      {
        label: 'Available',
        data: routes.map(r => Math.max(0, (r.seats_available || 0) - (r.reserved_count || 0))),
        backgroundColor: '#e2e6ea', // Light gray 
        maxBarThickness: 50,
      },
    ],
  }

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: handleChartClick, // Added click handler
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        align: 'center',
        labels: {
          boxWidth: 10,
          usePointStyle: true,
          pointStyle: 'circle',
          color: '#000'
        }
      },
      title: {
        display: false,
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      }
    },
    scales: {
      y: {
        stacked: true,
        beginAtZero: true,
        grid: {
          borderDash: [2],
          drawBorder: false,
        },
        ticks: {
          stepSize: 1,
          precision: 0,
          color: '#000'
        }
      },
      x: {
        stacked: true,
        grid: {
          display: false,
        },
        ticks: {
          color: '#000'
        }
      }
    },
  }

  const pieChartData = {

    labels: ['Reserved Seats', 'Available Seats'],
    datasets: [
      {
        data: [totalReserved, Math.max(0, totalSeats - totalReserved)],
        backgroundColor: [
          '#606c88', // Darker theme color for used
          '#e9ecef', // Light gray for available
        ],
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  }

  const pieChartOptions = {
    cutout: '70%',
    onClick: handleChartClick, // Added click handler
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          padding: 20,
          color: '#000'
        }
      }
    },
    maintainAspectRatio: false,
  }

  const metrics = [
    {
      label: "Total Routes",
      value: loading ? '-' : routes.length,
      icon: "bi-map",
      path: "/transport/view-routes",
    },
    {
      label: "Total Vehicles",
      value: loading ? '-' : vehicleCount,
      icon: "bi-truck-front",
      path: "/transport/view-routes",
    },
    {
      label: "Total Reserved",
      value: loading ? '-' : totalReserved,
      icon: "bi-person-check",
      path: "/transport/allocation",
    }
  ]

  return (
    <TransportShell>
      <div className="desktop-container admin-content" style={{ overflowX: 'hidden' }}>
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
          <h4 className="mb-0">Transport Dashboard</h4>
        </div>

        {/* Metrics Section */}
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

        {/* Analytics Section */}
        <section className="mb-5">
          <div className="row g-4">
            {/* Bar Chart: Students per Route */}
            <div className="col-12 col-lg-7">
              <div className="card shadow-sm border-0 h-100">
                <div className="card-header bg-white py-3">
                  <h6 className="m-0 fw-bold text-primary">Reserved Seats Routwise</h6>
                </div>
                <div className="card-body">
                  <div style={{ height: '300px' }}>
                    <Bar data={barChartData} options={barChartOptions} />
                  </div>
                </div>
              </div>
            </div>

            {/* Pie Chart: Overall Seat Usage */}
            <div className="col-12 col-lg-5">
              <div className="card shadow-sm border-0 h-100">
                <div className="card-header bg-white py-3">
                  <h6 className="m-0 fw-bold text-primary">Overall Reserved Seats</h6>
                </div>
                <div className="card-body">
                  <div style={{ height: '250px', position: 'relative' }}>
                    <Doughnut data={pieChartData} options={pieChartOptions} />
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -60%)',
                      textAlign: 'center'
                    }}>
                      <div className="h3 mb-0 fw-bold">{Math.round((totalReserved / (totalSeats || 1)) * 100)}%</div>
                      <div className="small text-muted"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>



          </div>
        </section>

      </div>
    </TransportShell>
  )
}