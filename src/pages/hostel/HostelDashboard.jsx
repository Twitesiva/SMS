import React, { useEffect, useMemo, useState } from 'react'
import HostelShell from '../../components/HostelShell'
import HostelPreloader from '../../components/HostelPreloader'
import { supabase } from '../../../supabaseClient'
import { Link, useNavigate } from 'react-router-dom'
import './HostelDashboard.css'
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

const currency = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`
}

export default function HostelDashboard() {
  const navigate = useNavigate()
  const [residents, setResidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [fees, setFees] = useState([]) // New state for fees

  // New state for charts
  const [blocks, setBlocks] = useState([])
  const [blockStats, setBlockStats] = useState({})
  const [totalCapacity, setTotalCapacity] = useState(0)

  useEffect(() => {
    const loadHostelData = async () => {
      setLoading(true)
      setError('')

      try {
        // Parallel fetching
        const [
          { data: students, error: studentsError },
          { data: blocksData, error: blocksError },
          { data: roomsData, error: roomsError },
          { data: allocsData, error: allocsError },
          { data: courses },
          { data: groups },
          { data: hostelFees }
        ] = await Promise.all([
          supabase.from('students').select(`
            id, student_id, full_name, academic_year, year_of_study,
            group_name, course_name, course_id, group_id,
            phone_number, current_semester, status, admission_year, hostel_ac,
            courses:course_id (course_name, course_code),
            groups:group_id (group_name, group_code)
          `).eq('is_hostel', true).order('created_at', { ascending: false }),

          supabase.from('hostel_blocks').select('id, block_name'),

          supabase.from('hostel_rooms').select('id, block_id, bed_count').eq('status', 'AVAILABLE'),

          supabase.from('hostel_allocations').select(`
            student_id, 
            status,
            hostel_beds!inner (
                hostel_rooms!inner (
                    block_id
                )
            )
          `).eq('status', 'ACTIVE'),

          supabase.from('courses').select('course_id, course_name, course_code'),
          supabase.from('groups').select('group_id, group_name, group_code'),
          supabase.from('hostel_fees').select('id, academic_year, hostel_type, hostel_fee')
        ])

        if (studentsError) throw studentsError
        if (blocksError) throw blocksError
        if (roomsError) throw roomsError
        if (allocsError) throw allocsError

        setFees(hostelFees || [])

        // Process Chart Data
        const stats = {}
        let capacitySum = 0

        // Initialize stats for each block
        blocksData?.forEach(b => {
          stats[b.id] = { name: b.block_name, allocated: 0, capacity: 0 }
        })

        // Sum Capacity
        roomsData?.forEach(r => {
          if (stats[r.block_id]) {
            const caps = Number(r.bed_count || 0)
            stats[r.block_id].capacity += caps
            capacitySum += caps
          }
        })
        setTotalCapacity(capacitySum)

        // Sum Allocations
        const allocatedStudentIds = new Set()
        allocsData?.forEach(a => {
          allocatedStudentIds.add(a.student_id)
          const blockId = a.hostel_beds?.hostel_rooms?.block_id
          if (blockId && stats[blockId]) {
            stats[blockId].allocated += 1
          }
        })

        setBlocks(blocksData || [])
        setBlockStats(stats)

        // Maps for Students Table
        const courseById = new Map()
        const courseByCode = new Map()
        courses?.forEach((c) => {
          if (c.course_id !== undefined) courseById.set(c.course_id, c.course_name || c.course_code || '—')
          if (c.course_code) courseByCode.set(String(c.course_code).toLowerCase(), c.course_name || c.course_code || '—')
        })

        const groupById = new Map()
        const groupByCode = new Map()
        groups?.forEach((g) => {
          if (g.group_id !== undefined) groupById.set(g.group_id, g.group_name || g.group_code || '—')
          if (g.group_code) groupByCode.set(String(g.group_code).toLowerCase(), g.group_name || g.group_code || '—')
        })

        const feeLookup = new Map()
        hostelFees?.forEach((fee) => {
          const key = `${fee.academic_year || ''}-${fee.hostel_type || 'NON_AC'}`
          feeLookup.set(key, Number(fee.hostel_fee))
        })

        // Fetch Payments
        const studentIds = students?.map((s) => s.id) || []
        let payments = []
        if (studentIds.length > 0) {
          const { data: paymentRows } = await supabase
            .from('student_fee_payments')
            .select('student_id, amount_paid, payment_status, fee_type')
            .in('student_id', studentIds)
            .ilike('fee_type', '%hostel%')
          payments = paymentRows || []
        }

        const merged = (students || []).map((student) => {
          const courseCodeKey = (student.course_name || student.courses?.course_code || '').toString().toLowerCase()
          const groupCodeKey = (student.group_name || student.groups?.group_code || '').toString().toLowerCase()

          const displayCourse = courseById.get(student.course_id) || courseByCode.get(courseCodeKey) || student?.courses?.course_name || student.course_name || '—'
          const displayGroup = groupById.get(student.group_id) || groupByCode.get(groupCodeKey) || student?.groups?.group_name || student.group_name || '—'
          const studentType = student.hostel_ac ? 'AC' : 'NON_AC'
          const key = `${student.academic_year || ''}-${studentType}`
          const hostelFee = feeLookup.get(key) ?? null
          const totalPaid = payments
            .filter((pay) => pay.student_id === student.id && (pay.payment_status || '').toLowerCase() === 'success')
            .reduce((acc, pay) => acc + Number(pay.amount_paid || 0), 0)
          const balance = hostelFee === null ? null : Math.max(hostelFee - totalPaid, 0)

          return {
            ...student,
            displayCourse,
            displayGroup,
            hostelFee,
            totalPaid,
            balance,
            isAllocated: allocatedStudentIds.has(student.id)
          }
        })

        setResidents(merged)
      } catch (err) {
        console.error('Failed to load hostel dashboard', err)
        setError(err?.message || 'Unable to load hostel data right now.')
      } finally {
        setLoading(false)
      }
    }

    loadHostelData()
  }, [])

  const filteredResidents = useMemo(() => {
    return residents.filter((resident) => {
      const matchesSearch = [resident.full_name, resident.student_id, resident.displayCourse, resident.displayGroup]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(search.toLowerCase()))

      const matchesYear = !yearFilter || `${resident.year_of_study}` === yearFilter
      return matchesSearch && matchesYear
    })
  }, [residents, search, yearFilter])

  const metrics = useMemo(() => {
    const totalResidents = residents.length
    const allocated = residents.filter((r) => r.isAllocated).length
    const unallocated = Math.max(totalResidents - allocated, 0)
    return [
      {
        label: 'Total Hostelers',
        value: totalResidents,
        icon: 'bi-people',

      },
      {
        label: 'Bed Allocated',
        value: allocated,
        icon: 'bi-house-check',

      },
      {
        label: 'Non Allocated',
        value: unallocated,
        icon: 'bi-house-dash',

      }
    ]
  }, [residents])

  // Chart Logic
  const labels = blocks.map(b => b.block_name)
  const allocatedData = blocks.map(b => blockStats[b.id]?.allocated || 0)
  const availableData = blocks.map(b => Math.max(0, (blockStats[b.id]?.capacity || 0) - (blockStats[b.id]?.allocated || 0)))

  const totalAllocated = allocatedData.reduce((a, b) => a + b, 0)
  const totalAvailable = Math.max(0, totalCapacity - totalAllocated)

  const barChartData = {
    labels: labels,
    datasets: [
      {
        label: 'Allocated',
        data: allocatedData,
        backgroundColor: '#4e73df',
        maxBarThickness: 50,
      },
      {
        label: 'Available',
        data: availableData,
        backgroundColor: '#e2e6ea',
        maxBarThickness: 50,
      },
    ],
  }

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'bottom', labels: { usePointStyle: true, boxWidth: 10, pointStyle: 'circle' } },
      tooltip: { mode: 'index', intersect: false }
    },
    scales: {
      y: { stacked: true, beginAtZero: true, grid: { borderDash: [2], drawBorder: false }, ticks: { stepSize: 1, precision: 0 } },
      x: { stacked: true, grid: { display: false } }
    }
  }

  const pieChartData = {
    labels: ['Allocated Beds', 'Empty Beds'],
    datasets: [
      {
        data: [totalAllocated, totalAvailable],
        backgroundColor: ['#606c88', '#e9ecef'],
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  }

  const pieChartOptions = {
    cutout: '70%',
    plugins: {
      legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } }
    },
    maintainAspectRatio: false,
  }

  const handleChartClick = () => {
    navigate('/hostel/allocations')
  }

  return (
    <HostelShell>
      <div className="desktop-container admin-content" aria-live="polite">
        <h4 className="mb-4">Hostel Dashboard</h4>

        {error && <div className="alert alert-danger" role="alert">{error}</div>}

        {loading ? (
          <HostelPreloader title="Loading hostel dashboard" subtitle="Fetching insights..." cardCount={3} />
        ) : (
          <>
            {/* Metrics Section */}
            <section className="mb-5">
              <div className="dashboard-cards">
                {metrics.map((metric) => (
                  <div key={metric.label} className="dashboard-card card-shadow dashboard-card-link" onClick={() => navigate('/hostel/reports')}>
                    <div className="dashboard-card-icon"><i className={`bi ${metric.icon}`}></i></div>
                    <div>
                      <div className="dashboard-card-value">{metric.value}</div>
                      <div className="dashboard-card-label">{metric.label}</div>
                      <p className="mb-0 fw-bold small text-muted">{metric.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Charts Section */}
            <section className="mb-5">
              <div className="row g-4">
                <div className="col-12 col-lg-7">
                  <div className="card shadow-sm border-0 h-100">
                    <div className="card-header bg-white py-3">
                      <h6 className="m-0 fw-bold text-primary">Reserved Beds Blockwise</h6>
                    </div>
                    <div className="card-body">
                      <div style={{ height: '300px' }}>
                        <Bar data={barChartData} options={{ ...barChartOptions, onClick: handleChartClick }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-5">
                  <div className="card shadow-sm border-0 h-100">
                    <div className="card-header bg-white py-3">
                      <h6 className="m-0 fw-bold text-primary">Overall Bed Allocation</h6>
                    </div>
                    <div className="card-body">
                      <div style={{ height: '250px', position: 'relative' }}>
                        <Doughnut data={pieChartData} options={{ ...pieChartOptions, onClick: handleChartClick }} />
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -60%)', textAlign: 'center' }}>
                          <div className="h3 mb-0 fw-bold">{totalCapacity > 0 ? Math.round((totalAllocated / totalCapacity) * 100) : 0}%</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Existing Table Section */}


            <section className="hostel-panel dashboard-chart-card card-shadow" id="fees">
              <div
                className="hostel-panel__head"
                style={{
                  background: 'linear-gradient(180deg, #606c88 0%, #3f4c6b 50%, #606c88 100%)',
                  borderRadius: '14px',
                  padding: '14px 18px',
                  color: '#ffffff'
                }}
              >
                <div><h2 className="mb-0 text-white">Hostel Fees</h2></div>
              </div>
              <div className="hostel-fees-grid mt-3">
                {fees.length === 0 ? (
                  <div className="hostel-empty">No fee structures found.</div>
                ) : (
                  Object.entries(fees.reduce((acc, fee) => {
                    const year = fee.academic_year || 'Unknown Year'
                    if (!acc[year]) acc[year] = { AC: 0, NON_AC: 0 }
                    // Check exact string or normalize
                    const type = (fee.hostel_type || '').toUpperCase().includes('NON') ? 'NON_AC' : 'AC'
                    acc[year][type] = fee.hostel_fee
                    return acc
                  }, {})).map(([year, amounts]) => (
                    <div key={year} className="hostel-fee-group">
                      <div className="hostel-fee-group__header">
                        <span className="text-uppercase fw-bold small">Academic Year</span>
                        <span className="fw-semibold">{year}</span>
                      </div>
                      <div className="hostel-fee-group__cards">
                        <div className="hostel-fee-tile">
                          <div className="hostel-fee-tile__label">AC</div>
                          <div className="hostel-fee-tile__value">{currency(amounts.AC || 0)}</div>
                        </div>
                        <div className="hostel-fee-tile">
                          <div className="hostel-fee-tile__label">NON AC</div>
                          <div className="hostel-fee-tile__value">{currency(amounts.NON_AC || 0)}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </HostelShell>
  )
}
