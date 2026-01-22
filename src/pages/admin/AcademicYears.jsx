import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../../lib/mockApi'
import { supabase } from '../../../supabaseClient'
import AdShellAdmin from '../../components/AdShellAdmin'
import crestPrimary from '../../assets/media/images.png'
import '../exam/Dashboard.css'
import './Setup.css'
import './AdminContent.css'
import { showToast } from '../../store/ui'
import { validateRequiredFields } from '../../lib/validation'


function AcademicYears() {
  const [yearForm, setYearForm] = useState({ name: '', category: '', active: true })
  const [academicYears, setAcademicYears] = useState([])
  const [editingYearId, setEditingYearId] = useState('')

  useEffect(() => {
    const loadYears = async () => {
      try {
        const rows = await api.listAcademicYears?.()
        setAcademicYears(rows || [])
      } catch (error) {
        console.error('Failed to load academic years:', error)
        showToast(error?.message || 'Failed to load academic years', { type: 'danger' })
      }
    }

    loadYears()
  }, [])

  const addYear = async () => {
    if (!validateRequiredFields({ 'Academic year name': yearForm.name })) return

    try {
      if (editingYearId) {
        const updated = await api.updateAcademicYear?.(editingYearId, {
          name: yearForm.name,
          category: yearForm.category,
          active: yearForm.active
        })
        if (updated) {
          setAcademicYears((prev) =>
            prev.map((y) => (y.id === editingYearId ? updated : y))
          )
        }
        setEditingYearId('')
      } else {
        const created = await api.addAcademicYear({
          name: yearForm.name,
          category: yearForm.category,
          active: yearForm.active
        })
        if (created) {
          setAcademicYears((prev) => [...prev, created])
        }
      }
    } catch (error) {
      console.error('Failed to save academic year:', error)
      showToast(error?.message || 'Failed to save academic year', {
        type: 'danger'
      })
    }

    setYearForm({ name: '', category: '', active: true })
  }

  const editYear = (year) => {
    setYearForm({
      name: year.name || year.academic_year || '',
      category: year.category || '',
      active: year.active ?? true
    })
    setEditingYearId(year.id)
  }

  const deleteYear = async (id) => {
    setAcademicYears((prev) => prev.filter((y) => y.id !== id))
    try {
      await api.deleteAcademicYear?.(id)
    } catch (error) {
      console.error('Error deleting academic year:', error)
      showToast(error?.message || 'Error deleting academic year', { type: 'danger' })
    }
    if (editingYearId === id) {
      setYearForm({ name: '', category: '', active: true })
      setEditingYearId('')
    }
  }

  const cancelYearEdit = () => {
    setYearForm({ name: '', category: '', active: true })
    setEditingYearId('')
  }

  return (
    <AdShellAdmin
      brandTitle="Admin Management Console"
      footerTitle="Admin Management Studio"
      footerSubtitle="Crafted for Vijayam College"
    >
      <div className="desktop-container" style={{ overflowX: 'hidden' }}>
        <section className="setup-hero mb-4">
          <div className="setup-hero__inner">
            <div className="setup-hero__content">
              <div className="setup-hero__crest" aria-hidden="true">
                <img src={crestPrimary} alt="Vijayam crest" />
              </div>
              <div>
                <div className="setup-hero__eyebrow">Academic Years</div>
                <h1 className="setup-hero__title mb-1">Vijayam College of Arts & Science</h1>
                <p className="setup-hero__subtitle mb-0">
                  Define academic years to organize fee structures and batches.
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="row g-4 justify-content-center mx-0">
          <div className="col-12">
            <div className="card card-soft p-4">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                <div>
                  <h4 className="mb-1">Academic Years</h4>
                  <p className="mb-0">Manage academic year definitions and categories.</p>
                </div>
              </div>

              <form className="row g-3 mb-4 form-large-text" onSubmit={(e) => { e.preventDefault(); addYear(); }}>
                <div className="col-md-4">
                  <label className="form-label">Academic Year Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., 2024-2025"
                    value={yearForm.name}
                    onChange={(e) => setYearForm({ ...yearForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Category</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., Regular, Supplementary"
                    value={yearForm.category}
                    onChange={(e) => setYearForm({ ...yearForm, category: e.target.value })}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Status</label>
                  <div className="form-check form-switch mt-2">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={yearForm.active}
                      onChange={(e) => setYearForm({ ...yearForm, active: e.target.checked })}
                    />
                    <label className="form-check-label">Active</label>
                  </div>
                </div>
                <div className="col-12 d-flex gap-2">
                  <button type="submit" className="btn btn-primary">
                    {editingYearId ? 'Update Year' : 'Add Year'}
                  </button>
                  {editingYearId && (
                    <button type="button" className="btn btn-secondary" onClick={cancelYearEdit}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              <div className="table-responsive">
                <table className="table table-hover align-middle table-large-text">
                  <thead className="table-header-gradient">
                    <tr>
                      <th>Academic Year</th>
                      <th>Category</th>
                      <th>Status</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {academicYears.map((year) => (
                      <tr key={year.id}>
                        <td className="fw-bold">{year.name || year.academic_year}</td>
                        <td>{year.category || '-'}</td>
                        <td>
                          <span className={`badge ${year.active ? 'bg-success' : 'bg-secondary'}`}>
                            {year.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="text-end">
                          <div className="d-flex justify-content-end gap-2">
                            <button
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => editYear(year)}
                            >
                              <i className="bi bi-pencil"></i>
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => deleteYear(year.id)}
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
            </div>
          </div>
        </div>
      </div>
    </AdShellAdmin>
  )
}

export default AcademicYears





