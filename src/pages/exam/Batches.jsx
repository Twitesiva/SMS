import AdminShell from '../../components/AdminShell'
import { useEffect, useState } from 'react'
import { api } from '../../lib/mockApi'
import { validateRequiredFields } from '../../lib/validation'
export default function Batches() {
  const [batches, setBatches] = useState([])
  const [name, setName] = useState('')
  const load = async () => setBatches(await api.listBatches())
  useEffect(()=>{ load() }, [])
  const add = async () => {
    if (!validateRequiredFields({ 'Batch name': name })) return
    await api.addBatch({ name: name.trim() })
    setName('')
    load()
  }
  return (
    <AdminShell>
      <h2 className="fw-bold mb-3">Batches</h2>
      <div className="row g-3">
        <div className="col-lg-4"><div className="card card-soft p-3"><label className="form-label">Batch Name</label><input className="form-control mb-2" value={name} required onChange={e=>setName(e.target.value)} placeholder="e.g., 2025-CS-A" /><button className="btn btn-brand" onClick={add}>Add Batch</button></div></div>
        <div className="col-lg-8"><div className="card card-soft p-0"><table className="table mb-0"><thead><tr><th>Name</th><th>Created</th></tr></thead><tbody>{batches.map(b=> (<tr key={b.id}><td>{b.name}</td><td>{new Date(b.created_at).toLocaleString()}</td></tr>))}</tbody></table></div></div>
      </div>
    </AdminShell>
  )
}
