import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../store/ui'
import LibraryPreloader from '../../components/LibraryPreloader'
import ToastStack from '../../components/ToastStack'
import ConfirmationModal from '../../components/ConfirmationModal'

const initialForm = { name: '' }

const formatDate = (value) => {
  if (!value) return '-'
  return new Date(value).toLocaleDateString()
}

export default function BookCategories() {
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [updating, setUpdating] = useState(false)
  const [deleteModal, setDeleteModal] = useState({ show: false, category: null, loading: false })

  const loadCategories = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('library_book_categories')
        .select('id, name, created_at')
        .order('name', { ascending: true })

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error('Failed to load book categories', error)
      showToast('Unable to load categories.', { type: 'danger' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])

  const handleChange = (event) => {
    setForm({ name: event.target.value })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const trimmed = form.name.trim()
    if (!trimmed) {
      showToast('Category name is required.', { type: 'warning' })
      return
    }
    const exists = categories.some((cat) => (cat.name || '').toLowerCase() === trimmed.toLowerCase())
    if (exists) {
      showToast('Category already exists.', { type: 'warning' })
      return
    }

    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('library_book_categories')
        .insert([{ name: trimmed }])
        .select()
        .single()

      if (error) throw error
      setCategories((prev) => [...prev, data].sort((a, b) => (a.name || '').localeCompare(b.name || '')))
      setForm(initialForm)
      showToast('Category added.', { type: 'success' })
    } catch (error) {
      console.error('Failed to add book category', error)
      showToast('Unable to add category.', { type: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  const openDeleteModal = (category) => {
    if (!category?.id) return
    setDeleteModal({ show: true, category, loading: false })
  }

  const closeDeleteModal = () => {
    setDeleteModal({ show: false, category: null, loading: false })
  }

  const confirmDelete = async () => {
    if (!deleteModal.category?.id) return
    setDeleteModal((prev) => ({ ...prev, loading: true }))
    try {
      const { error } = await supabase
        .from('library_book_categories')
        .delete()
        .eq('id', deleteModal.category.id)

      if (error) throw error
      setCategories((prev) => prev.filter((item) => item.id !== deleteModal.category.id))
      showToast('Category removed.', { type: 'success' })
      closeDeleteModal()
    } catch (error) {
      console.error('Failed to delete book category', error)
      showToast('Unable to delete category.', { type: 'danger' })
      setDeleteModal((prev) => ({ ...prev, loading: false }))
    } finally {
      setDeleteModal((prev) => ({ ...prev, loading: false }))
    }
  }

  const startEdit = (category) => {
    setEditingId(category.id)
    setEditName(category.name || '')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
  }

  const handleUpdate = async () => {
    if (!editingId) return
    const trimmed = editName.trim()
    if (!trimmed) {
      showToast('Category name is required.', { type: 'warning' })
      return
    }
    const exists = categories.some(
      (cat) => cat.id !== editingId && (cat.name || '').toLowerCase() === trimmed.toLowerCase()
    )
    if (exists) {
      showToast('Category already exists.', { type: 'warning' })
      return
    }
    setUpdating(true)
    try {
      const { data, error } = await supabase
        .from('library_book_categories')
        .update({ name: trimmed })
        .eq('id', editingId)
        .select()
        .single()

      if (error) throw error
      setCategories((prev) =>
        prev
          .map((item) => (item.id === editingId ? { ...item, name: data?.name || trimmed } : item))
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      )
      showToast('Category updated.', { type: 'success' })
      cancelEdit()
    } catch (error) {
      console.error('Failed to update book category', error)
      showToast('Unable to update category.', { type: 'danger' })
    } finally {
      setUpdating(false)
    }
  }

  if (loading && categories.length === 0) {
    return (
      <LibraryPreloader
        title="Loading book categories"
        subtitle="Syncing catalog categories."
        statCount={2}
        panelCount={1}
        rowCount={4}
      />
    )
  }

  return (
    <>
      <div className="desktop-container" style={{ overflowX: 'hidden' }}>
      <div className="row g-4 justify-content-center mx-0">
        <div className="col-12">
          <div className="card card-soft p-4 mb-4">
            <div className="mb-3">
              <h4 className="mb-1 fw-bold text-dark">Book Categories</h4>
            </div>

            <form className="row g-2 align-items-end mb-3" onSubmit={handleSubmit}>
              <div className="col-md-8">
                <label className="form-label small fw-bold text-muted">New Category Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. IT, Biology"
                  value={form.name}
                  onChange={handleChange}
                />
              </div>
              <div className="col-md-4">
                <button
                  type="submit"
                  className="btn btn-primary w-100"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Add Category'}
                </button>
              </div>
            </form>

            <div className="table-responsive mb-3">
              <table className="table table-sm table-hover align-middle library-charges-table">
                <thead className="table-light">
                  <tr>
                    <th>Category Name</th>
                    <th>Created On</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="3" className="text-center text-muted">Loading...</td></tr>
                  ) : categories.length === 0 ? (
                    <tr><td colSpan="3" className="text-center text-muted fst-italic">No categories defined.</td></tr>
                  ) : (
                    categories.map((category) => (
                      <tr key={category.id}>
                        <td className="fw-semibold">
                          {editingId === category.id ? (
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              value={editName}
                              onChange={(event) => setEditName(event.target.value)}
                            />
                          ) : (
                            category.name
                          )}
                        </td>
                        <td>{formatDate(category.created_at)}</td>
                        <td className="text-end">
                          {editingId === category.id ? (
                            <div className="library-catalogue-actions">
                              <button
                                className="library-action-button library-action-button--edit"
                                onClick={handleUpdate}
                                disabled={updating}
                              >
                                {updating ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                className="library-action-button library-action-button--neutral"
                                onClick={cancelEdit}
                                disabled={updating}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="library-catalogue-actions">
                              <button
                                className="library-action-button library-action-button--edit"
                                onClick={() => startEdit(category)}
                                disabled={deleteModal.loading && deleteModal.category?.id === category.id}
                              >
                                Edit
                              </button>
                              <button
                                className="library-action-button library-action-button--delete"
                                onClick={() => openDeleteModal(category)}
                                disabled={deleteModal.loading && deleteModal.category?.id === category.id}
                              >
                                {deleteModal.loading && deleteModal.category?.id === category.id ? 'Removing...' : 'Delete'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      </div>
      </div>
      <ToastStack />
      <ConfirmationModal
        isOpen={deleteModal.show}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        title="Delete Category"
        message={`Are you sure you want to delete ${deleteModal.category?.name || 'this category'}?`}
        confirmText={deleteModal.loading ? 'Deleting...' : 'Delete'}
        isLoading={deleteModal.loading}
      />
    </>
  )
}
