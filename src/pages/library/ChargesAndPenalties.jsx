import { useEffect, useState } from 'react'
import crestPrimary from '../../assets/media/images.png'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../store/ui'

const initialForm = {
  fineAmount: '100',
  depositAmount: '0'
}

export default function ChargesAndPenalties() {
  const [form, setForm] = useState(initialForm)
  const [settingsId, setSettingsId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editing, setEditing] = useState(false)

  const [customCharges, setCustomCharges] = useState([])
  const [newCharge, setNewCharge] = useState({ name: '', amount: '' })
  const [loadingCustom, setLoadingCustom] = useState(false)
  const [addingCustom, setAddingCustom] = useState(false)

  const parsed = {
    fine: Number(form.fineAmount || 0),
    deposit: Number(form.depositAmount || 0)
  }

  const loadCharges = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('global_settings')
        .select('id, fine_amount, deposit_amount')
        .order('id', { ascending: true })
        .limit(1)
        .single()

      if (error) {
        if (error.code !== 'PGRST116') throw error
        setForm(initialForm)
        setSettingsId(null)
        return
      }

      setSettingsId(data.id)
      setForm({
        fineAmount: data.fine_amount !== null && data.fine_amount !== undefined ? String(data.fine_amount) : initialForm.fineAmount,
        depositAmount:
          data.deposit_amount !== null && data.deposit_amount !== undefined
            ? String(data.deposit_amount)
            : initialForm.depositAmount
      })
    } catch (err) {
      console.error('Failed to load library charges', err)
      showToast('Unable to load charges right now.', { type: 'danger' })
    } finally {
      setLoading(false)
    }
  }

  const loadCustomCharges = async () => {
    setLoadingCustom(true)
    try {
      const { data, error } = await supabase
        .from('library_charge_categories')
        .select('*')
        .order('created_at', { ascending: true })

      if (error) throw error
      setCustomCharges(data || [])
    } catch (err) {
      // Silent error if table doesn't exist yet to avoid UI breakage
      console.log('Custom charges table might not exist yet:', err.message)
    } finally {
      setLoadingCustom(false)
    }
  }

  useEffect(() => {
    loadCharges()
    loadCustomCharges()
  }, [])

  const handleChange = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
  }

  const handleNewChargeChange = (key) => (event) => {
    setNewCharge((prev) => ({ ...prev, [key]: event.target.value }))
  }

  const handleAddCharge = async (e) => {
    e.preventDefault()
    if (!newCharge.name.trim() || !newCharge.amount.trim()) {
      showToast('Please enter both name and amount.', { type: 'warning' })
      return
    }
    setAddingCustom(true)
    try {
      const { data, error } = await supabase
        .from('library_charge_categories')
        .insert([{ name: newCharge.name.trim(), amount: Number(newCharge.amount) }])
        .select()
        .single()

      if (error) throw error
      setCustomCharges((prev) => [...prev, data])
      setNewCharge({ name: '', amount: '' })
      showToast('Category added.', { type: 'success' })
    } catch (err) {
      console.error('Failed to add custom charge', err)
      showToast('Unable to add category. Check database.', { type: 'danger' })
    } finally {
      setAddingCustom(false)
    }
  }

  const handleDeleteCharge = async (id) => {
    try {
      const { error } = await supabase.from('library_charge_categories').delete().eq('id', id)
      if (error) throw error
      setCustomCharges((prev) => prev.filter((c) => c.id !== id))
      showToast('Category removed.', { type: 'success' })
    } catch (err) {
      console.error('Failed to delete custom charge', err)
      showToast('Unable to delete category.', { type: 'danger' })
    }
  }

  const handleSave = async (event) => {
    event.preventDefault()
    if (!editing && settingsId) {
      setEditing(true)
      return
    }
    const fineAmount = Number(form.fineAmount || 0)
    const depositAmount = Number(form.depositAmount || 0)

    if ([fineAmount, depositAmount].some((v) => Number.isNaN(v) || v < 0)) {
      showToast('Enter valid non-negative amounts.', { type: 'warning' })
      return
    }

    setSaving(true)
    try {
      if (settingsId) {
        const { error } = await supabase
          .from('global_settings')
          .update({
            fine_amount: fineAmount,
            deposit_amount: depositAmount
          })
          .eq('id', settingsId)

        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('global_settings')
          .insert([
            {
              fine_amount: fineAmount,
              deposit_amount: depositAmount
            }
          ])
          .select()
          .single()

        if (error) throw error
        setSettingsId(data?.id || null)
      }

      showToast('Charges updated successfully.', { type: 'success' })
    } catch (err) {
      console.error('Failed to save library charges', err)
      showToast('Unable to save charges. Check schema for required columns.', { type: 'danger' })
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  const handleDelete = async () => {
    if (!settingsId) {
      showToast('No saved settings to delete.', { type: 'warning' })
      return
    }
    setDeleting(true)
    try {
      const { error } = await supabase.from('global_settings').delete().eq('id', settingsId)
      if (error) throw error
      setSettingsId(null)
      setForm(initialForm)
      showToast('Charges deleted.', { type: 'success' })
    } catch (err) {
      console.error('Failed to delete charges', err)
      showToast('Unable to delete charges.', { type: 'danger' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="desktop-container" style={{ overflowX: 'hidden' }}>
      <div className="row g-3 mb-4 justify-content-center">
        <div className="col-6 col-md-4">
          <div className="card card-soft p-3 h-100 text-center">
            <div className="text-muted small">Overdue Fine</div>
            <div className="fs-4 fw-bold">Rs. {Number.isFinite(parsed.fine) ? parsed.fine : 0}</div>
          </div>
        </div>
        <div className="col-6 col-md-4">
          <div className="card card-soft p-3 h-100 text-center">
            <div className="text-muted small">Security Deposit</div>
            <div className="fs-4 fw-bold">Rs. {Number.isFinite(parsed.deposit) ? parsed.deposit : 0}</div>
          </div>
        </div>
      </div>

      <div className="card card-soft border-info bg-light p-3 mb-3">
        <div className="d-flex gap-2 align-items-start">
          <div className="badge bg-info text-dark rounded-pill me-2 mt-1">Note</div>
          <div className="small mb-0 text-muted">
            <div>• Overdue fines trigger after due date.</div>
            <div>• Deposit is collected at issue time.</div>
            <div>• Missed and Damaged book charges are handled manually during reporting.</div>
            <div className="mt-1">Ensure these values match your library policy before issuing books.</div>
          </div>
        </div>
      </div>

      <div className="row g-4 justify-content-center mx-0">
        <div className="col-12">
          <div className="card card-soft p-4 mb-4">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div>
                <div className="text-muted text-uppercase small fw-bold">Charges & Penalties</div>
                <h4 className="mb-1 fw-bold text-dark">Set default amounts</h4>
                <p className="text-muted mb-0 small">
                  {settingsId && !editing ? 'Locked after save. Click Edit to modify.' : 'Update and save the active rates.'}
                </p>
              </div>
              <div className="d-flex gap-2">
                {settingsId && editing && (
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm"
                    onClick={handleDelete}
                    disabled={deleting || saving || loading}
                  >
                    {deleting ? 'Deleting...' : 'Delete'}
                  </button>
                )}
              </div>
            </div>
            <form className="row g-3 align-items-end" onSubmit={handleSave}>
              <div className="col-md-5">
                <label className="form-label fw-bold text-dark">Overdue Fine (Rs.)</label>
                <input
                  className="form-control"
                  type="number"
                  min="0"
                  value={form.fineAmount}
                  onChange={handleChange('fineAmount')}
                  disabled={loading || (settingsId && !editing)}
                />
              </div>
              <div className="col-md-5">
                <label className="form-label fw-bold text-dark">Security Deposit (Rs.)</label>
                <input
                  className="form-control"
                  type="number"
                  min="0"
                  value={form.depositAmount}
                  onChange={handleChange('depositAmount')}
                  disabled={loading || (settingsId && !editing)}
                />
              </div>
              <div className="col-md-2 d-flex justify-content-end gap-2">
                {settingsId && !editing && (
                  <button type="submit" className="btn btn-primary w-100" disabled={saving || loading}>
                    Edit
                  </button>
                )}
                {(!settingsId || editing) && (
                  <button type="submit" className="btn btn-primary w-100" disabled={saving || loading}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="card card-soft p-4">
            <div className="mb-3">
              <h4 className="mb-1 fw-bold text-dark">Custom Charge Categories</h4>
              <p className="text-muted mb-0 small">Define other fee types (e.g., Lost Card, Late Return).</p>
            </div>
            
            <div className="table-responsive mb-3">
              <table className="table table-sm table-hover align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Category Name</th>
                    <th>Default Amount</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingCustom ? (
                    <tr><td colSpan="3" className="text-center text-muted">Loading...</td></tr>
                  ) : customCharges.length === 0 ? (
                    <tr><td colSpan="3" className="text-center text-muted fst-italic">No custom categories defined.</td></tr>
                  ) : (
                    customCharges.map((charge) => (
                      <tr key={charge.id}>
                        <td className="fw-semibold">{charge.name}</td>
                        <td>Rs. {charge.amount}</td>
                        <td className="text-end">
                          <button 
                            className="btn btn-link text-danger p-0 text-decoration-none small"
                            onClick={() => handleDeleteCharge(charge.id)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <form className="row g-2 align-items-end" onSubmit={handleAddCharge}>
              <div className="col-md-5">
                <label className="form-label small fw-bold text-muted">New Category Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Lost ID Card"
                  value={newCharge.name}
                  onChange={handleNewChargeChange('name')}
                />
              </div>
              <div className="col-md-5">
                <label className="form-label small fw-bold text-muted">Amount (Rs.)</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="0"
                  min="0"
                  value={newCharge.amount}
                  onChange={handleNewChargeChange('amount')}
                />
              </div>
              <div className="col-md-2">
                <button 
                  type="submit" 
                  className="btn btn-primary w-100"
                  disabled={addingCustom}
                >
                  {addingCustom ? '...' : 'Add Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
