import { useEffect, useState } from 'react'
import { api } from '../lib/mockApi'

export default function PublicTimeTable() {
  const [exams, setExams] = useState([])
  useEffect(()=>{ (async()=>{ setExams(await api.listExams()) })() },[])
  return (
    <div className="container py-5">
      <div className="row mb-4">
        <div className="col-12 text-center fw-bold">
          This page should be updated
        </div>
      </div>
      <div className="row justify-content-center">
        <div className="col-lg-8">
          <div className="card card-soft p-4">
            <h4 className="mb-3">Exam Time Table</h4>
            {exams.length===0 ? (
              <div className="text-muted">No exams published yet.</div>
            ) : (
              <div className="table-responsive">
                <table className="table mb-0">
                  <thead><tr><th>Title</th><th>Date</th><th>Session</th><th>Notes</th></tr></thead>
                  <tbody>
                    {exams.map(x=> (
                      <tr key={x.id}><td>{x.title}</td><td>{x.date}</td><td>{x.session || '-'}</td><td>{x.notes || '-'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

