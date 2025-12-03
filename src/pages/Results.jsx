import AdminShell from '../components/AdminShell'
import { useEffect, useState } from 'react'
import { api } from '../lib/mockApi'
import { supabase } from '../../supabaseClient'

export default function Results(){
  const [students,setStudents]=useState([])
  const [exams,setExams]=useState([])
  const [form,setForm]=useState({student_id:'',exam_id:'',total:'',grade:''})
  const [saving,setSaving]=useState(false)

  const [decodeNo, setDecodeNo] = useState('')
  const [decodeLoading, setDecodeLoading] = useState(false)
  const [decodeError, setDecodeError] = useState('')
  const [subject, setSubject] = useState(null)
  const [marksForm, setMarksForm] = useState({ marks_obtained: '' })
  const [savingMarks, setSavingMarks] = useState(false)
  const [marksSuccess, setMarksSuccess] = useState('')
  const [marksError, setMarksError] = useState('')

  useEffect(()=>{(async()=>{setStudents(await api.listStudents()); setExams(await api.listExams())})()},[])

  useEffect(() => {
    if (!exams.length) return
    setForm((prev) => {
      if (prev.exam_id) return prev
      const firstExamId = exams[0]?.id
      if (!firstExamId) return prev
      return { ...prev, exam_id: String(firstExamId) }
    })
  }, [exams, form.exam_id])

  const save=async()=>{ if(!form.student_id||!form.exam_id||!form.total||!form.grade) return; setSaving(true); await api.addResult({ student_id:form.student_id, exam_id:form.exam_id, total:Number(form.total), grade:form.grade }); setForm({student_id:'',exam_id:'',total:'',grade:''}); setSaving(false) }

  const fetchDecodeDetails = async () => {
    const trimmed = decodeNo.trim()
    setSubject(null)
    setMarksSuccess('')
    setMarksError('')

    if (!trimmed) {
      setDecodeError('Please enter a decode number')
      return
    }
    setDecodeError('')
    setDecodeLoading(true)
    try {
      // First get the subject_id from exam_registration_subjects
      const { data: decodeRow, error: decodeErr } = await supabase
        .from('decode_numbers')
        .select(`
          id, 
          exam_registration_subject_id, 
          decode_no,
          exam_registration_subjects:exam_registration_subject_id (
            subject_id
          )
        `)
        .eq('decode_no', trimmed)
        .single()

      if (decodeErr) throw decodeErr
      if (!decodeRow) {
        setDecodeError('Decode number not found')
        return
      }

      if (!decodeRow.exam_registration_subjects?.subject_id) {
        setDecodeError('No subject found for this decode number')
        return
      }

      // Then get the subject details from the subjects table
      const { data: subjectData, error: subjectErr } = await supabase
        .from('subjects')
        .select('subject_name, subject_code')
        .eq('subject_id', decodeRow.exam_registration_subjects.subject_id)
        .single()

      if (subjectErr) throw subjectErr
      if (!subjectData) {
        setDecodeError('Subject details not found')
        return
      }

      setSubject(subjectData)
    } catch (err) {
      console.error('Error fetching decode details', err)
      setDecodeError('Failed to load details for this decode number')
    } finally {
      setDecodeLoading(false)
    }
  }

  const saveMarks = async () => {
    const trimmed = decodeNo.trim()
    if (!trimmed) {
      setDecodeError('Please enter a decode number')
      return
    }
    if (!marksForm.marks_obtained) {
      return
    }
    const obtained = Number(marksForm.marks_obtained)
    const max = 100
    if (Number.isNaN(obtained)) {
      return
    }
    if (obtained >= 100) {
      setMarksError('please enter valid marks')
      return
    }
    setSavingMarks(true)
    setMarksSuccess('')
    setMarksError('')
    try {
      const { data: existingMarks, error: existingErr } = await supabase
        .from('marks')
        .select('id')
        .eq('decode_no', trimmed)

      if (existingErr) throw existingErr
      if (existingMarks && existingMarks.length > 0) {
        setDecodeError('Marks already entered for this decode number')
        return
      }

      const { error } = await supabase.from('marks').insert({
        decode_no: trimmed,
        marks_obtained: obtained,
        max_marks: max
      })
      if (error) throw error
      setMarksSuccess('Marks saved successfully')
      setDecodeNo('')
      setSubject(null)
      setMarksForm({ marks_obtained: '' })
      setMarksError('')
      setDecodeError('')
    } catch (err) {
      console.error('Error saving marks', err)
      setDecodeError('Failed to save marks')
    } finally {
      setSavingMarks(false)
    }
  }
  return (
    <AdminShell>
      <div className="card card-soft p-3" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h5 className="mb-3">Enter Decode Number</h5>
        <div className="row g-2 align-items-end">
          <div className="col-md-8">
            <input
              type="text"
              className="form-control"
              placeholder="Decode Number"
              value={decodeNo}
              onChange={e => {
                setDecodeNo(e.target.value)
                setDecodeError('')
                setSubject(null)
                setMarksSuccess('')
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  fetchDecodeDetails()
                }
              }}
            />
          </div>
          <div className="col-md-4 d-grid">
            <button
              type="button"
              className="btn btn-brand"
              onClick={fetchDecodeDetails}
              disabled={decodeLoading}
            >
              {decodeLoading ? 'Loading...' : 'Submit'}
            </button>
          </div>
        </div>
        {decodeError && (
          <div className="alert alert-danger mt-3 mb-0 py-2">
            {decodeError}
          </div>
        )}
      </div>

      {subject && (
        <div className="card card-soft p-3 mt-4" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h5 className="mb-2">Subject Details</h5>
          <p className="mb-1">
            <strong>{subject.subject_name}</strong>
          </p>
          <p className="text-muted mb-3">
            Code: {subject.subject_code || '-'}
          </p>

          <div className="row g-2 align-items-end">
            <div className="col-md-6">
              <label className="form-label">Marks Obtained</label>
              <input
                type="number"
                className="form-control"
                value={marksForm.marks_obtained}
                onChange={e => {
                  const value = e.target.value
                  setMarksForm(prev => ({ ...prev, marks_obtained: value }))
                  if (value === '') {
                    setMarksError('')
                  } else if (Number(value) >= 100) {
                    setMarksError('please enter valid marks')
                  } else {
                    setMarksError('')
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    saveMarks()
                  }
                }}
              />
            </div>
          </div>

          {marksError && (
            <div className="text-danger mt-2">
              {marksError}
            </div>
          )}

          <div className="mt-3 d-flex justify-content-end">
            <button
              type="button"
              className="btn btn-success"
              onClick={saveMarks}
              disabled={savingMarks || !marksForm.marks_obtained || !!marksError}
            >
              {savingMarks ? 'Saving...' : 'Save Marks'}
            </button>
          </div>

          {marksSuccess && (
            <div className="alert alert-success mt-3 mb-0 py-2">
              {marksSuccess}
            </div>
          )}
        </div>
      )}
      {/* Original functionality preserved but commented out
      <h2 className="fw-bold mb-3">Publish Results</h2>
      <div className="card card-soft p-3">
        <div className="row g-2">
          <div className="col-md-4">
            <select className="form-select" value={form.student_id} onChange={e=>setForm({...form,student_id:e.target.value})}>
              <option value="">Select Student</option>
              {students.map(s=> (<option key={s.student_id} value={s.student_id}>{s.student_id} — {s.full_name}</option>))}
            </select>
          </div>
          <div className="col-md-4">
            <select className="form-select" value={form.exam_id} onChange={e=>setForm({...form,exam_id:e.target.value})}>
              <option value="">Select Exam</option>
              {exams.map(x=> (<option key={x.id} value={x.id}>{x.title} ({x.date})</option>))}
            </select>
          </div>
          <div className="col-md-2"><input type="number" className="form-control" placeholder="Total" value={form.total} onChange={e=>setForm({...form,total:e.target.value})} /></div>
          <div className="col-md-2"><input className="form-control" placeholder="Grade (e.g., A)" value={form.grade} onChange={e=>setForm({...form,grade:e.target.value})} /></div>
        </div>
        <div className="mt-3 d-flex justify-content-end">
          <button className="btn btn-brand" disabled={saving} onClick={save}>{saving?'Saving...':'Add Result'}</button>
        </div>
      </div>
      */}
    </AdminShell>
  )
}
