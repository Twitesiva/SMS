import { useEffect, useState } from 'react'
import crestPrimary from '../../assets/media/images.png'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../store/ui'

const initialForm = {
  fineAmount: '100',
  missingAmount: '500',
  damagedAmount: '500',
  depositAmount: '0'
}

export default function ChargesAndPenalties() {
  const [form, setForm] = useState(initialForm)
  const [settingsId, setSettingsId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadCharges = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('global_settings')
        .select('id, fine_amount, missing_amount, damaged_amount, deposit_amount')
        .order('id', { ascending: true })
        .limit(1)
        .single()

      if (error) {
        // If no row found, keep defaults without error noise
        if (error.code !== 'PGRST116') throw error
        setForm(initialForm)
        setSettingsId(null)
        return
      }

      setSettingsId(data.id)
      setForm({
        fineAmount: data.fine_amount !== null && data.fine_amount !== undefined ? String(data.fine_amount) : initialForm.fineAmount,
        missingAmount:
          data.missing_amount !== null && data.missing_amount !== undefined
            ? String(data.missing_amount)
            : initialForm.missingAmount,
        damagedAmount:
          data.damaged_amount !== null && data.damaged_amount !== undefined
            ? String(data.damaged_amount)
            : initialForm.damagedAmount,
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

  useEffect(() => {
    loadCharges()
  }, [])

  const handleChange = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
  }

  const handleSave = async (event) => {
    event.preventDefault()
    const fineAmount = Number(form.fineAmount || 0)
    const missingAmount = Number(form.missingAmount || 0)
    const damagedAmount = Number(form.damagedAmount || 0)
    const depositAmount = Number(form.depositAmount || 0)

    if ([fineAmount, missingAmount, damagedAmount, depositAmount].some((v) => Number.isNaN(v) || v < 0)) {
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
            missing_amount: missingAmount,
            damaged_amount: damagedAmount,
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
              missing_amount: missingAmount,
              damaged_amount: damagedAmount,
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
    }
  }

  return (
    <div className="desktop-container" style={{ overflowX: 'hidden' }}>
      <section className="setup-hero mb-4 text-center">
        <div className="setup-hero-copywrap mx-auto text-center" style={{ maxWidth: '640px' }}>
          <div className="admin-applications__crest mx-auto" aria-hidden="true">
            <img src={crestPrimary} alt="Vijayam crest" />
          </div>
          <h3 className="setup-hero-title mb-2 fw-bold text-white">Charges & Penalties</h3>
          <p className="setup-hero-copy mb-3 text-white">Configure default amounts for fines and deposits.</p>
          <div className="setup-hero-chips d-flex flex-wrap gap-2 justify-content-center">
            <span className="setup-hero-chip text-uppercase">FINES</span>
            <span className="setup-hero-chip text-uppercase">DEPOSITS</span>
            <span className="setup-hero-chip text-uppercase">POLICY</span>
          </div>
        </div>
      </section>

      <div className="row g-4 justify-content-center mx-0">
        <div className="col-12 col-lg-8">
          <div className="card card-soft p-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h4 className="mb-1 fw-bold text-dark">Charges & Penalties</h4>
                <p className="fw-bold text-dark mb-0">Set default amounts for library charges.</p>
              </div>
            </div>
            <form className="row g-3" onSubmit={handleSave}>
              <div className="col-md-6">
                <label className="form-label fw-bold text-dark">Overdue Fine (Rs.)</label>
                <input
                  className="form-control"
                  type="number"
                  min="0"
                  value={form.fineAmount}
                  onChange={handleChange('fineAmount')}
                  disabled={loading}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-bold text-dark">Missing Book Charge (Rs.)</label>
                <input
                  className="form-control"
                  type="number"
                  min="0"
                  value={form.missingAmount}
                  onChange={handleChange('missingAmount')}
                  disabled={loading}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-bold text-dark">Damaged Book Charge (Rs.)</label>
                <input
                  className="form-control"
                  type="number"
                  min="0"
                  value={form.damagedAmount}
                  onChange={handleChange('damagedAmount')}
                  disabled={loading}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-bold text-dark">Security Deposit (Rs.)</label>
                <input
                  className="form-control"
                  type="number"
                  min="0"
                  value={form.depositAmount}
                  onChange={handleChange('depositAmount')}
                  disabled={loading}
                />
              </div>
              <div className="col-12 d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setForm(initialForm)} disabled={loading || saving}>
                  Reset
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving || loading}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
