import React, { useEffect, useMemo, useState } from 'react'
import HostelShell from '../../components/HostelShell'
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
            phone_number, current_semester, status, admission_year,
            courses:course_id (course_name, course_code),
            groups:group_id (group_name, group_code)
          `)
          .eq('is_hostel', true)
          .order('created_at', { ascending: false })

        if (studentsError) throw studentsError

        const { data: hostelFees, error: feesError } = await supabase
          .from('hostel_fees')
          .select('id, academic_year, year_of_study, hostel_fee')

        if (feesError) throw feesError

        const feeLookup = new Map()
        hostelFees?.forEach((fee) => {
          const key = `${fee.academic_year || ''}-${fee.year_of_study || ''}`
          feeLookup.set(key, Number(fee.hostel_fee))
        })

        const studentIds = students?.map((s) => s.id) || []
        let payments = []

        if (studentIds.length > 0) {
          const { data: paymentRows, error: paymentsError } = await supabase
            .from('student_fee_payments')
            .select('student_id, amount_paid, payment_status, fee_type, payment_mode, created_at')
            .in('student_id', studentIds)
            .ilike('fee_type', '%hostel%')

          if (paymentsError) throw paymentsError
          payments = paymentRows || []
        }

        const merged = (students || []).map((student) => {
          const displayCourse =
            student?.courses?.course_name ||
            student?.courses?.course_code ||
            student.course_name ||
            '—'
          const displayGroup =
            student?.groups?.group_name ||
            student?.groups?.group_code ||
            student.group_name ||
            '—'
          const key = `${student.academic_year || ''}-${student.year_of_study || ''}`
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
            hasPaymentRecord: payments.some((pay) => pay.student_id === student.id)
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
    const totalExpected = residents.reduce((acc, r) => acc + (r.hostelFee || 0), 0)
    const totalCollected = residents.reduce((acc, r) => acc + (r.totalPaid || 0), 0)
    const outstanding = Math.max(totalExpected - totalCollected, 0)

    return { totalResidents, totalExpected, totalCollected, outstanding }
  }, [residents])

  return (
    <HostelShell>
      <div className="hostel-dashboard" aria-live="polite">
        <div className="hostel-dashboard__header">
          <div>
            <p className="hostel-dashboard__eyebrow">Hostel dashboard</p>
            <h1>Residents, fees, balances</h1>
          </div>
        </div>

        {error && <div className="hostel-alert" role="alert">{error}</div>}

        <section className="hostel-metrics" id="overview">
          {[{
            label: 'Total hostelers',
            value: metrics.totalResidents,
            icon: 'bi-people'
          }, {
            label: 'Expected hostel fee',
            value: currency(metrics.totalExpected),
            icon: 'bi-cash-stack'
          }, {
            label: 'Collected',
            value: currency(metrics.totalCollected),
            icon: 'bi-piggy-bank'
          }, {
            label: 'Outstanding',
            value: currency(metrics.outstanding),
            icon: 'bi-exclamation-octagon'
          }].map((item) => (
            <article key={item.label} className="hostel-metric-card">
              <div className="hostel-metric-icon"><i className={`bi ${item.icon}`}></i></div>
              <div>
                <p className="hostel-metric-label">{item.label}</p>
                <p className="hostel-metric-value">{item.value}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="hostel-panel" id="residents">
          <div className="hostel-panel__head">
            <div>
              <p className="hostel-panel__eyebrow">Residents</p>
              <h2>Hostel student ledger</h2>
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

          <div className="hostel-table" role="table" aria-busy={loading}>
            <div className="hostel-table__head" role="rowgroup">
              <div role="row" className="hostel-table__row hostel-table__row--head">
                <div role="columnheader">Student ID</div>
                <div role="columnheader">Name</div>
                <div role="columnheader">Course / Group</div>
                <div role="columnheader">Year</div>
                <div role="columnheader">Hostel fee</div>
                <div role="columnheader">Paid</div>
                <div role="columnheader">Balance</div>
                <div role="columnheader" className="text-end">Status</div>
              </div>
            </div>

            <div className="hostel-table__body" role="rowgroup">
              {loading ? (
                <div className="hostel-table__skeleton">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div key={idx} className="hostel-skeleton-row"></div>
                  ))}
                </div>
              ) : filteredResidents.length === 0 ? (
                <div className="hostel-empty">No hostel students found for the selected filters.</div>
              ) : (
                filteredResidents.slice(0, 40).map((resident) => {
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
                      <div role="cell">{currency(resident.balance)}</div>
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
        </section>

        <section className="hostel-panel" id="fees">
          <div className="hostel-panel__head">
            <div>
              <p className="hostel-panel__eyebrow">Fee setup</p>
              <h2>Hostel fee catalogue</h2>
            </div>
          </div>

          <div className="hostel-fees-grid">
            {residents.length === 0 ? (
              <div className="hostel-empty">Hostel fees will appear when residents data loads.</div>
            ) : (
              Array.from(
                residents.reduce((acc, res) => {
                  if (res.hostelFee !== null) {
                    const key = `${res.academic_year}-${res.year_of_study}`
                    acc.set(key, {
                      academic_year: res.academic_year,
                      year_of_study: res.year_of_study,
                      hostelFee: res.hostelFee,
                    })
                  }
                  return acc
                }, new Map())
              ).map(([key, fee]) => (
                <div key={key} className="hostel-fee-card">
                  <div className="hostel-fee-card__title">{fee.academic_year || 'Academic year N/A'}</div>
                  <div className="hostel-fee-card__meta">Year {fee.year_of_study || '—'}</div>
                  <div className="hostel-fee-card__value">{currency(fee.hostelFee)}</div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </HostelShell>
  )
}
