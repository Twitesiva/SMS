import React, { useEffect, useMemo, useState } from 'react'
import HostelShell from '../../components/HostelShell'
import HostelPreloader from '../../components/HostelPreloader'
import { supabase } from '../../../supabaseClient'
import './HostelDashboard.css'

const currency = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`
}

export default function HostelDashboard() {
  const [residents, setResidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    const loadHostelData = async () => {
      setLoading(true)
      setError('')

      try {
        const { data: students, error: studentsError } = await supabase
          .from('students')
          .select(`
            id, student_id, full_name, academic_year, year_of_study,
            group_name, course_name, course_id, group_id,
            phone_number, current_semester, status, admission_year, hostel_ac,
            courses:course_id (course_name, course_code),
            groups:group_id (group_name, group_code)
          `)
          .eq('is_hostel', true)
          .order('created_at', { ascending: false })

        if (studentsError) throw studentsError

        const [{ data: courses }, { data: groups }] = await Promise.all([
          supabase.from('courses').select('course_id, course_name, course_code'),
          supabase.from('groups').select('group_id, group_name, group_code')
        ])

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

        const { data: hostelFees, error: feesError } = await supabase
          .from('hostel_fees')
          .select('id, academic_year, hostel_type, hostel_fee')

        if (feesError) throw feesError

        const feeLookup = new Map()
        hostelFees?.forEach((fee) => {
          const key = `${fee.academic_year || ''}-${fee.hostel_type || 'NON_AC'}`
          feeLookup.set(key, Number(fee.hostel_fee))
        })

        const studentIds = students?.map((s) => s.id) || []
        let payments = []
        let allocations = []

        if (studentIds.length > 0) {
          const { data: paymentRows, error: paymentsError } = await supabase
            .from('student_fee_payments')
            .select('student_id, amount_paid, payment_status, fee_type, payment_mode, created_at')
            .in('student_id', studentIds)
            .ilike('fee_type', '%hostel%')

          if (paymentsError) throw paymentsError
          payments = paymentRows || []

          const { data: allocationRows, error: allocationsError } = await supabase
            .from('hostel_allocations')
            .select('student_id, status')
            .in('student_id', studentIds)
            .eq('status', 'ACTIVE')

          if (allocationsError) throw allocationsError
          allocations = allocationRows || []
        }

        const allocatedStudentIds = new Set(
          allocations.map((alloc) => alloc.student_id).filter(Boolean)
        )

        const merged = (students || []).map((student) => {
          const courseCodeKey = (student.course_name || student.courses?.course_code || '').toString().toLowerCase()
          const groupCodeKey = (student.group_name || student.groups?.group_code || '').toString().toLowerCase()

          const displayCourse =
            courseById.get(student.course_id) ||
            courseByCode.get(courseCodeKey) ||
            student?.courses?.course_name ||
            student.course_name ||
            '—'

          const displayGroup =
            groupById.get(student.group_id) ||
            groupByCode.get(groupCodeKey) ||
            student?.groups?.group_name ||
            student.group_name ||
            '—'
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
            hasPaymentRecord: payments.some((pay) => pay.student_id === student.id),
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

    return { totalResidents, allocated, unallocated }
  }, [residents])

  return (
    <HostelShell>
      <div className="hostel-dashboard" aria-live="polite">
        <h1 className="mb-4">Hostel dashboard</h1>

        {error && <div className="hostel-alert" role="alert">{error}</div>}

        {loading ? (
          <HostelPreloader
            title="Loading hostel dashboard"
            subtitle="Syncing residents, fees, and balances."
            cardCount={4}
          />
        ) : (
          <>
            <section className="hostel-metrics dashboard-cards" id="overview">
              {[{
                label: 'Total hostelers',
                value: metrics.totalResidents,
                icon: 'bi-people'
              }, {
                label: 'Bed allocated',
                value: metrics.allocated,
                icon: 'bi-house-check'
              }, {
                label: 'Non allocated',
                value: metrics.unallocated,
                icon: 'bi-house-dash'
              }].map((item) => (
                <article key={item.label} className="dashboard-card card-shadow dashboard-card-link hostel-metric-card">
                  <div className="dashboard-card-icon"><i className={`bi ${item.icon}`}></i></div>
                  <div>
                    <p className="hostel-metric-label dashboard-card-label">{item.label}</p>
                    <p className="hostel-metric-value dashboard-card-value">{item.value}</p>
                  </div>
                </article>
              ))}
            </section>

            <section className="hostel-panel dashboard-chart-card card-shadow" id="residents">
              <div className="hostel-panel__head">
                <div>
                  <h2 className="mb-0">Hostel Students</h2>
                </div>
                <div className="hostel-panel__controls">
                  <input
                    type="search"
                    className="hostel-input"
                    placeholder="Search name, ID, course"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <select
                    className="hostel-select"
                    value={yearFilter}
                    onChange={(e) => setYearFilter(e.target.value)}
                  >
                    <option value="">Year of study</option>
                    {[1, 2, 3, 4, 5, 6].map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="hostel-table" role="table">
                <div className="hostel-table__head" role="rowgroup">
                  <div role="row" className="hostel-table__row hostel-table__row--head">
                    <div role="columnheader">Student ID</div>
                    <div role="columnheader">Name</div>
                    <div role="columnheader">Course / Group</div>
                    <div role="columnheader">Year</div>
                    <div role="columnheader">Hostel fee</div>
                    <div role="columnheader">Paid</div>
                    <div role="columnheader" className="text-end">Status</div>
                  </div>
                </div>

                <div className="hostel-table__body" role="rowgroup">
                  {filteredResidents.length === 0 ? (
                    <div className="hostel-empty">No hostel students found for the selected filters.</div>
                  ) : (
                    filteredResidents.slice(0, showAll ? undefined : 2).map((resident) => {
                      const feeStatus = resident.balance === null
                        ? 'Missing fee config'
                        : resident.balance === 0
                          ? 'Cleared'
                          : resident.totalPaid > 0
                            ? 'Partial'
                            : 'Pending'

                      return (
                        <div role="row" className="hostel-table__row" key={resident.id}>
                          <div role="cell" className="mono">{resident.student_id}</div>
                          <div role="cell">
                            <div className="fw-semibold">{resident.full_name || '—'}</div>
                            <div className="hostel-subtle">{resident.phone_number || '—'}</div>
                          </div>
                          <div role="cell">
                            <div>{resident.displayCourse}</div>
                            <div className="hostel-subtle">{resident.displayGroup}</div>
                          </div>
                          <div role="cell">{resident.year_of_study || '—'}</div>
                          <div role="cell">{currency(resident.hostelFee)}</div>
                          <div role="cell">{currency(resident.totalPaid)}</div>
                          <div role="cell" className="text-end">
                            <span className={`hostel-status hostel-status--${feeStatus.toLowerCase().replace(' ', '-')}`}>
                              {feeStatus}
                            </span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
              {filteredResidents.length > 2 && (
                <div className="text-center p-3 border-top">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setShowAll(!showAll)}
                  >
                    {showAll ? 'Show Less' : 'View All Students'}
                  </button>
                </div>
              )}
            </section>

            <section className="hostel-panel dashboard-chart-card card-shadow" id="fees">
              <div className="hostel-panel__head">
                <div>
                  <h2 className="mb-0">Hostel Fees</h2>
                </div>
              </div>

              <div className="hostel-fees-grid">
                {residents.length === 0 ? (
                  <div className="hostel-empty">Hostel fees will appear when residents data loads.</div>
                ) : (
                  Array.from(
                    residents.reduce((acc, res) => {
                      if (res.hostelFee !== null) {
                        const studentType = res.hostel_ac ? 'AC' : 'NON_AC'
                        const key = `${res.academic_year}-${studentType}`
                        acc.set(key, {
                          academic_year: res.academic_year,
                          hostel_type: studentType,
                          hostelFee: res.hostelFee,
                        })
                      }
                      return acc
                    }, new Map())
                  ).map(([key, fee]) => (
                    <div key={key} className="hostel-fee-card">
                      <div className="hostel-fee-card__title">{fee.academic_year || 'Academic year N/A'}</div>
                      <div className="hostel-fee-card__meta">{fee.hostel_type === 'AC' ? 'AC' : 'Non AC'}</div>
                      <div className="hostel-fee-card__value">{currency(fee.hostelFee)}</div>
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
