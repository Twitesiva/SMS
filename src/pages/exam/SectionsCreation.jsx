import { useEffect, useState } from 'react'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../../store/ui'
import ConfirmationModal from '../../components/ConfirmationModal'

export default function SectionsCreation({ onSectionsChange }) {
  const [sectionForm, setSectionForm] = useState({ id: '', name: '' })
  const [editingSectionId, setEditingSectionId] = useState('')
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState({ show: false, id: null })

  const loadSections = async () => {
    const { data, error } = await supabase
      .from('sections')
      .select('id, section_name')
      .order('section_name')
    if (!error) setSections(data || [])
    onSectionsChange && onSectionsChange(data || [])
  }

  useEffect(() => {
    loadSections()
  }, [])

  const saveSection = async () => {
    if (!sectionForm.name.trim()) {
      showToast('Section name required', { type: 'warning' })
      return
    }

    setLoading(true)
    try {
      if (editingSectionId) {
        const { error } = await supabase
          .from('sections')
          .update({ section_name: sectionForm.name.trim() })
          .eq('id', editingSectionId)
        showToast('Section updated', { type: 'success' })
      } else {
        const { error } = await supabase
          .from('sections')
          .insert([{ section_name: sectionForm.name.trim() }])
        showToast('Section created', { type: 'success' })
      }
      setSectionForm({ id: '', name: '' })
      setEditingSectionId('')
      await loadSections()
    } catch (error) {
      showToast(error.message, { type: 'danger' })
    } finally {
      setLoading(false)
    }
  }

  const editSection = (section) => {
    setSectionForm({ id: section.id, name: section.section_name })
    setEditingSectionId(section.id)
  }

  const deleteSection = (id) => {
    setDeleteConfirmation({ show: true, id })
  }

  const confirmDelete = async () => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('sections')
        .delete()
        .eq('id', deleteConfirmation.id)
      showToast('Section deleted', { type: 'success' })
      setDeleteConfirmation({ show: false, id: null })
      await loadSections()
    } catch (error) {
      showToast(error.message, { type: 'danger' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card card-soft mb-4">
      <div className="card-header bg-light">
        <h5 className="mb-0">Sections Creation (A-F)</h5>
      </div>
      <div className="card-body">
        <div className="row g-3 mb-4">
          <div className="col-md-6">
            <label className="form-label fw-bold">Section Name</label>
            <input
              className="form-control"
              placeholder="e.g. A, B, C"
              value={sectionForm.name}
              onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
            />
          </div>
          <div className="col-md-3 d-flex align-items-end">
            <button
              className="btn btn-primary w-100"
              onClick={saveSection}
              disabled={!sectionForm.name.trim() || loading}
            >
              {editingSectionId ? 'Update' : 'Add'} Section
            </button>
          </div>
          {editingSectionId && (
            <div className="col-md-3 d-flex align-items-end">
              <button
                className="btn btn-outline-secondary w-100"
                onClick={() => {
                  setSectionForm({ id: '', name: '' })
                  setEditingSectionId('')
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {sections.length > 0 && (
          <div>
            <h6>Sections List</h6>
            <div className="row g-2">
              {sections.map((section) => (
                <div key={section.id} className="col-md-3 col-sm-4 col-6">
                  <div className="card h-100 border shadow-sm">
                    <div className="card-body p-3 text-center">
                      <div className="fw-bold h5 mb-0">{section.section_name}</div>
                      <div className="btn-group btn-group-sm mt-2">
                        <button
                          className="btn btn-outline-primary"
                          onClick={() => editSection(section)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-outline-danger"
                          onClick={() => deleteSection(section.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={deleteConfirmation.show}
        onClose={() => setDeleteConfirmation({ show: false, id: null })}
        onConfirm={confirmDelete}
        title="Confirm Delete"
        message="Delete this section? It will be removed from all mappings."
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  )
}

