import { useEffect, useMemo, useState } from 'react'
import TransportShell from '../../components/TransportShell'
import { api } from '../../lib/mockApi'
import { showToast } from '../../store/ui'

const initialForm = {
  routeNo: '',
  routeName: '',
  academicYear: '',
  amount: '',
  boardingPointInput: '',
  boardingPoints: []
}

export default function TransportRoutes() {
  const [routes, setRoutes] = useState([])
  const [form, setForm] = useState(initialForm)
  const [editingRoute, setEditingRoute] = useState('')
  const [academicYears, setAcademicYears] = useState([])
  const [yearFilter, setYearFilter] = useState('')
  const [loading, setLoading] = useState(false)

  const fetchRoutes = async () => {
    try {
      const rows = await api.listTransportRoutes()
      setRoutes(rows || [])
    } catch (error) {
      console.error('Failed to load transport routes', error)
      showToast('Unable to load routes', { type: 'danger' })
    }
  }

  useEffect(() => {
    const fetchYears = async () => {
      try {
        const rows = await api.listAcademicYears?.()
        if (rows?.length) {
          setAcademicYears(rows)
          // default the form to the latest year
          const latestYear = rows[rows.length - 1]
          if (!form.academicYear && latestYear?.academic_year) {
            setForm((prev) => ({ ...prev, academicYear: latestYear.academic_year }))
          }
        }
      } catch (error) {
        console.error('Failed to fetch academic years', error)
        showToast(error?.message || 'Unable to load academic years', { type: 'danger' })
      }
    }

    fetchYears()
    fetchRoutes()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const totalBoardingPoints = useMemo(
    () => routes.reduce((sum, route) => sum + (route.boardingPoints?.length || 0), 0),
    [routes]
  )

  const upsertRoute = async (event) => {
    event.preventDefault()
    const routeNo = form.routeNo.trim()
    const routeName = form.routeName.trim()
    const academicYear = form.academicYear.trim()
    const boardingPoints = form.boardingPoints.map((point) => point.trim()).filter(Boolean)
    const amountValue = Number(form.amount)

    if (!routeNo || !routeName || !academicYear) {
      showToast('Route number, name, and academic year are required', { type: 'warning' })
      return
    }
    if (!boardingPoints.length) {
      showToast('Add at least one boarding point', { type: 'warning' })
      return
    }
    if (!amountValue || Number.isNaN(amountValue) || amountValue <= 0) {
      showToast('Enter a valid route amount greater than zero', { type: 'warning' })
      return
    }

    setLoading(true)
    try {
      // Logic for managing multiple years for same route (if backend supports complex object)
      // For now, we fetch existing route to merge amounts array if possible, 
      // or we assume the backend handles merging based on the implementation in mockApi.
      // Based on mockApi logic: we send the full object. So we need to construct it carefully.
      
      let updatedAmounts = []
      const existing = routes.find((r) => r.routeNo === routeNo)
      
      if (existing) {
        updatedAmounts = [...(existing.amounts || [])]
        const amountIndex = updatedAmounts.findIndex((entry) => entry.academicYear === academicYear)
        if (amountIndex !== -1) {
          updatedAmounts[amountIndex] = { academicYear, amount: amountValue }
        } else {
          updatedAmounts.push({ academicYear, amount: amountValue })
        }
      } else {
        updatedAmounts = [{ academicYear, amount: amountValue }]
      }

      await api.upsertTransportRoute({
        routeNo,
        routeName,
        boardingPoints,
        amounts: updatedAmounts
      })

      showToast(
        editingRoute ? 'Route updated successfully' : 'Route added successfully',
        { type: 'success' }
      )
      setForm(initialForm)
      setEditingRoute('')
      fetchRoutes()
    } catch (error) {
      console.error('Failed to save route', error)
      showToast('Failed to save route', { type: 'danger' })
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (route) => {
    setEditingRoute(route.routeNo)
    setForm({
      routeNo: route.routeNo,
      routeName: route.routeName,
      academicYear:
        route.amounts?.[route.amounts.length - 1]?.academicYear || academicYears[0]?.academic_year || '',
      amount: route.amounts?.[route.amounts.length - 1]?.amount || '',
      boardingPointInput: '',
      boardingPoints: route.boardingPoints || []
    })
  }

  const removeRoute = async (routeNo) => {
    if (!window.confirm('Are you sure you want to delete this route?')) return
    
    setLoading(true)
    try {
      await api.deleteTransportRoute(routeNo)
      showToast('Route removed successfully', { type: 'success' })
      if (editingRoute === routeNo) {
        setForm(initialForm)
        setEditingRoute('')
      }
      fetchRoutes()
    } catch (error) {
      console.error('Failed to delete route', error)
      showToast('Failed to delete route', { type: 'danger' })
    } finally {
      setLoading(false)
    }
  }

  const addBoardingPoint = () => {
    const value = form.boardingPointInput.trim()
    if (!value) return
    if (form.boardingPoints.some((point) => point.toLowerCase() === value.toLowerCase())) {
      showToast('Boarding point already added', { type: 'info' })
      return
    }
    setForm((prev) => ({
      ...prev,
      boardingPoints: [...prev.boardingPoints, value],
      boardingPointInput: ''
    }))
  }

  const removeBoardingPoint = (point) => {
    setForm((prev) => ({
      ...prev,
      boardingPoints: prev.boardingPoints.filter((bp) => bp !== point)
    }))
  }

  const filteredRoutes = useMemo(() => {
    if (!yearFilter) return routes
    return routes.filter((route) => route.amounts?.some((entry) => entry.academicYear === yearFilter))
  }, [routes, yearFilter])

  const activeAcademicYears =
    academicYears.length > 0
      ? academicYears.map((y) => y.academic_year)
      : Array.from(
          new Set(routes.flatMap((route) => route.amounts?.map((a) => a.academicYear) || []))
        )
  const hasYearOptions = activeAcademicYears.length > 0

  return (
    <TransportShell brandTitle="Transport Management" brandSubtitle="Admin routes & fares">
      <div className="container-fluid px-0">
        <div className="row g-4">
          <div className="col-12 col-xl-4">
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex align-items-start justify-content-between">
                  <div>
                    <h5 className="card-title mb-1">
                      {editingRoute ? `Update Route ${editingRoute}` : 'Add a Route'}
                    </h5>
                    <p className="text-muted small mb-3">
                      Route amount is shared by every boarding point for the selected academic year.
                    </p>
                  </div>
                  {editingRoute && (
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => {
                        setForm(initialForm)
                        setEditingRoute('')
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <form className="d-grid gap-3" onSubmit={upsertRoute}>
                  <div className="row g-3">
                    <div className="col-12 col-md-4">
                      <label className="form-label fw-semibold">Route No</label>
                      <input
                        type="text"
                        className="form-control"
                        value={form.routeNo}
                        onChange={(event) => setForm((prev) => ({ ...prev, routeNo: event.target.value }))}
                        placeholder="e.g. 7A"
                        required
                        disabled={loading}
                      />
                    </div>
                    <div className="col-12 col-md-8">
                      <label className="form-label fw-semibold">Route Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={form.routeName}
                        onChange={(event) => setForm((prev) => ({ ...prev, routeName: event.target.value }))}
                        placeholder="Chittoor to Campus"
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Academic Year</label>
                      {hasYearOptions ? (
                        <select
                          className="form-select"
                          value={form.academicYear}
                          onChange={(event) => setForm((prev) => ({ ...prev, academicYear: event.target.value }))}
                          required
                          disabled={loading}
                        >
                          <option value="">Select academic year</option>
                          {activeAcademicYears.map((year) => (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. 2025-2026"
                          value={form.academicYear}
                          onChange={(event) => setForm((prev) => ({ ...prev, academicYear: event.target.value }))}
                          required
                          disabled={loading}
                        />
                      )}
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Route Amount</label>
                      <div className="input-group">
                        <span className="input-group-text">
                          <i className="bi bi-currency-rupee" aria-hidden="true"></i>
                        </span>
                        <input
                          type="number"
                          min="0"
                          className="form-control"
                          value={form.amount}
                          onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                          placeholder="12000"
                          required
                          disabled={loading}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="form-label fw-semibold">Boarding Points</label>
                    <div className="d-flex gap-2 mb-2">
                      <input
                        type="text"
                        className="form-control"
                        value={form.boardingPointInput}
                        placeholder="Add a stop"
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, boardingPointInput: event.target.value }))
                        }
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            addBoardingPoint()
                          }
                        }}
                        disabled={loading}
                      />
                      <button type="button" className="btn btn-primary" onClick={addBoardingPoint} disabled={loading}>
                        Add
                      </button>
                    </div>
                    {form.boardingPoints.length > 0 ? (
                      <div className="d-flex flex-wrap gap-2">
                        {form.boardingPoints.map((point) => (
                          <span key={point} className="badge bg-light text-dark border px-3 py-2 d-flex align-items-center gap-2">
                            {point}
                            <button
                              type="button"
                              className="btn-close btn-close-white"
                              aria-label={`Remove ${point}`}
                              onClick={() => removeBoardingPoint(point)}
                              disabled={loading}
                            />
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted small mb-0">No boarding points added yet.</p>
                    )}
                  </div>

                  <button type="submit" className="btn btn-success" disabled={loading}>
                    {loading ? 'Saving...' : (editingRoute ? 'Update Route' : 'Save Route')}
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-8">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
              <div>
                <h5 className="mb-1">Route Catalogue</h5>
                <p className="text-muted small mb-0">
                  {routes.length} active routes · {totalBoardingPoints} total boarding points
                </p>
              </div>
              <div className="d-flex align-items-center gap-2">
                <label className="text-muted small mb-0">Filter by academic year</label>
                <select
                  className="form-select form-select-sm"
                  style={{ minWidth: 180 }}
                  value={yearFilter}
                  onChange={(event) => setYearFilter(event.target.value)}
                >
                  <option value="">All years</option>
                  {activeAcademicYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filteredRoutes.length === 0 ? (
              <div className="alert alert-info">
                {routes.length === 0 ? 'No routes found. Add a route to get started.' : 'No routes to display for the selected filter.'}
              </div>
            ) : (
              <div className="d-grid gap-3">
                {filteredRoutes.map((route) => (
                  <div key={route.routeNo} className="card shadow-sm border-0">
                    <div className="card-body">
                      <div className="d-flex align-items-start justify-content-between flex-wrap gap-3">
                        <div>
                          <div className="text-uppercase text-muted fw-semibold small">Route {route.routeNo}</div>
                          <h6 className="mb-1">{route.routeName}</h6>
                          <div className="d-flex flex-wrap gap-2 mt-2">
                            {route.amounts?.map((entry) => (
                              <span key={entry.academicYear} className="badge rounded-pill text-bg-light border">
                                {entry.academicYear}: ₹{entry.amount?.toLocaleString?.() || entry.amount}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="d-flex gap-2">
                          <button className="btn btn-outline-primary btn-sm" onClick={() => startEdit(route)} disabled={loading}>
                            Edit
                          </button>
                          <button className="btn btn-outline-danger btn-sm" onClick={() => removeRoute(route.routeNo)} disabled={loading}>
                            Remove
                          </button>
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="text-muted small mb-1">Boarding points (same fare per route)</div>
                        <div className="d-flex flex-wrap gap-2">
                          {route.boardingPoints?.map((point) => (
                            <span key={point} className="badge bg-primary-subtle text-primary px-3 py-2">
                              {point}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </TransportShell>
  )
}