import AdminShell from '../../components/AdminShell'
import { useEffect, useState, useRef } from 'react'
import { api } from '../../lib/mockApi'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../store/ui'
import { logActivity } from '../../lib/logger'
import { useAuth } from '../../store/auth'

export default function MarksEntry() {
  const { user } = useAuth()
  const [students, setStudents] = useState([])
  const [exams, setExams] = useState([])
  const [form, setForm] = useState({ student_id: '', exam_id: '', total: '', grade: '' })
  const [saving, setSaving] = useState(false)

  const [barcode, setBarcode] = useState('')
  const [decodeLoading, setDecodeLoading] = useState(false)
  const [decodeError, setDecodeError] = useState('')
  const [subject, setSubject] = useState(null)
  const [barcodeId, setBarcodeId] = useState(null)
  const [scanData, setScanData] = useState(null) // { student_id, exam_id, semester, subject_id }
  const [marksForm, setMarksForm] = useState({ marks_obtained: '' })
  const [savingMarks, setSavingMarks] = useState(false)
  const [marksError, setMarksError] = useState('')

  const barcodeInputRef = useRef(null)
  const marksInputRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => { (async () => { setStudents(await api.listStudents()); setExams(await api.listExams()) })() }, [])

  useEffect(() => {
    if (subject) {
      setTimeout(() => marksInputRef.current?.focus(), 100)
    } else {
      barcodeInputRef.current?.focus()
    }
  }, [subject])

  useEffect(() => {
    if (!exams.length) return
    setForm((prev) => {
      if (prev.exam_id) return prev
      const firstExamId = exams[0]?.id
      if (!firstExamId) return prev
      return { ...prev, exam_id: String(firstExamId) }
    })
  }, [exams, form.exam_id])

  const save = async () => { if (!form.student_id || !form.exam_id || !form.total || !form.grade) return; setSaving(true); await api.addResult({ student_id: form.student_id, exam_id: form.exam_id, total: Number(form.total), grade: form.grade }); setForm({ student_id: '', exam_id: '', total: '', grade: '' }); setSaving(false) }

  const fetchDecodeDetails = async (codeOverride) => {
    const code = typeof codeOverride === 'string' ? codeOverride : barcode
    const trimmed = code.trim()
    setSubject(null)
    setBarcodeId(null)
    setScanData(null)
    setMarksError('')

    if (!trimmed) {
      setDecodeError('Please enter a barcode')
      return
    }
    setDecodeError('')
    setDecodeLoading(true)
    try {
      // First get the subject_id from exam_registration_subjects
      const { data: decodeRow, error: decodeErr } = await supabase
        .from('barcodes')
        .select(`
          id,
          student_id,
          exam_registration_subject_id, 
          barcode,
          exam_registration_subjects:exam_registration_subject_id (
            subject_id,
            exam_registrations (
              exam_id,
              semester
            )
          )
        `)
        .eq('barcode', trimmed)
        .single()

      if (decodeErr) throw decodeErr
      if (!decodeRow) {
        setDecodeError('Barcode not found')
        return
      }

      if (!decodeRow.exam_registration_subjects?.subject_id) {
        setDecodeError('No subject found for this barcode')
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
      setBarcodeId(decodeRow.id)
      setScanData({
        student_id: decodeRow.student_id,
        exam_id: decodeRow.exam_registration_subjects?.exam_registrations?.exam_id,
        semester: decodeRow.exam_registration_subjects?.exam_registrations?.semester,
        subject_id: decodeRow.exam_registration_subjects?.subject_id
      })
    } catch (err) {
      console.error('Error fetching barcode details', err)
      setDecodeError('Failed to load details for this barcode')
    } finally {
      setDecodeLoading(false)
    }
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (barcode.trim()) {
      debounceRef.current = setTimeout(() => {
        fetchDecodeDetails(barcode)
      }, 500)
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [barcode])

  const saveMarks = async () => {
    const trimmed = barcode.trim()
    if (!trimmed) {
      setDecodeError('Please enter a barcode')
      return
    }
    if (!marksForm.marks_obtained) {
      return
    }
    const obtained = Number(marksForm.marks_obtained)
    const max = 70
    if (Number.isNaN(obtained)) {
      return
    }
    if (obtained > 70) {
      setMarksError('Please enter valid marks')
      return
    }
    setSavingMarks(true)
    setMarksError('')
    try {
      if (!scanData || !scanData.student_id || !scanData.subject_id) {
        setDecodeError('Missing student or subject information')
        return
      }

      // Check if marks exist for this barcode specifically (to prevent double scanning)
      const { data: existingMarks, error: existingErr } = await supabase
        .from('marks')
        .select('id')
        .eq('barcode_id', barcodeId)

      if (existingErr) throw existingErr
      if (existingMarks && existingMarks.length > 0) {
        setDecodeError('Marks already entered for this barcode')
        return
      }

      // 0. Fetch current internal marks for this student + subject
      const { data: currentMarkRow, error: markFetchErr } = await supabase
        .from('marks')
        .select('internal_marks')
        .eq('student_id', scanData.student_id)
        .eq('subject_id', scanData.subject_id)
        .maybeSingle() // Use maybeSingle to avoid error if no row exists

      if (markFetchErr) throw markFetchErr

      const currentInternal = currentMarkRow?.internal_marks || 0
      const newTotal = Number(currentInternal) + Number(obtained)

      // Upsert marks: match on student_id + subject_id
      // Update theory_marks and link the barcode_id
      const { error } = await supabase.from('marks').upsert({
        student_id: scanData.student_id,
        subject_id: scanData.subject_id,
        barcode_id: barcodeId,
        theory_marks: obtained,
        internal_marks: currentInternal, // Ensure internal marks are preserved/set
        max_marks: max
      }, { onConflict: 'student_id, subject_id' })

      if (error) throw error

      if (error) throw error

      await logActivity(supabase, {
        description: `${user?.role || 'User'} entered marks for Subject: ${subject.subject_code}-${subject.subject_name} Marks: ${obtained}`,
        action: 'UPDATE',
        page: 'Results Entry',
        user: user,
        role: user?.role
      })

      showToast('Marks saved successfully', { type: 'success' })
      setBarcode('')
      setSubject(null)
      setBarcodeId(null)
      setScanData(null)
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
      <div className="container-fluid px-4">
        <h1 className="mt-4">Marks Entry</h1>
        <div className="card card-soft p-4 mb-4">
          <div className="mb-3">
            <h5 className="fw-bold mb-1">Enter Barcode</h5>
            <p className="text-muted small mb-0">Scan or enter the barcode from the answer script.</p>
          </div>
          <div className="row g-3 align-items-end">
            <div className="col-md-5">
              <label className="form-label fw-semibold">Barcode</label>
              <input
                ref={barcodeInputRef}
                type="text"
                className="form-control"
                placeholder="Scan Barcode..."
                value={barcode}
                onChange={e => {
                  setBarcode(e.target.value)
                  setDecodeError('')
                  setSubject(null)
                  setBarcodeId(null)
                  setScanData(null)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (debounceRef.current) clearTimeout(debounceRef.current)
                    fetchDecodeDetails(e.currentTarget.value)
                  }
                }}
              />
            </div>
            <div className="col-md-2">
              <button
                type="button"
                className="btn btn-primary w-100"
                onClick={fetchDecodeDetails}
                disabled={decodeLoading}
              >
                {decodeLoading ? 'Loading...' : 'Submit'}
              </button>
            </div>
          </div>
          {decodeError && (
            <div className="alert alert-danger mt-3 mb-0 py-2">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              {decodeError}
            </div>
          )}
        </div>

        {subject && (
          <div className="card card-soft p-4 mt-4 animate__animated animate__fadeIn">
            <div className="mb-3 border-bottom pb-2">
              <h5 className="fw-bold mb-0">Subject Details</h5>
            </div>
            
            <div className="row g-4 align-items-stretch">
              <div className="col-md-6">
                <div className="p-3 bg-light rounded-3 border h-100 d-flex flex-column justify-content-center">
                  <label className="text-muted small text-uppercase fw-bold mb-1 d-block">Subject</label>
                  <div className="fs-5 fw-bold text-dark">
                    {subject.subject_code ? `${subject.subject_code} - ${subject.subject_name}` : subject.subject_name}
                  </div>
                </div>
              </div>

              <div className="col-md-6">
                <div className="p-3 bg-light rounded-3 border h-100 d-flex flex-column justify-content-center">
                  <label className="form-label fw-bold text-dark mb-2">Marks Obtained (Max: 70)</label>
                  <div className="d-flex gap-2">
                    <div className="flex-grow-1">
                      <input
                        ref={marksInputRef}
                        type="number"
                        className={`form-control form-control-lg ${marksError ? 'is-invalid' : ''}`}
                        value={marksForm.marks_obtained}
                        placeholder="00"
                        onChange={e => {
                          const value = e.target.value
                          setMarksForm(prev => ({ ...prev, marks_obtained: value }))
                          if (value === '') {
                            setMarksError('')
                          } else if (Number(value) > 70) {
                            setMarksError('Please enter valid marks')
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
                      {marksError && (
                        <div className="invalid-feedback">
                          {marksError}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn btn-success px-4"
                      onClick={saveMarks}
                      disabled={savingMarks || !marksForm.marks_obtained || !!marksError}
                    >
                      {savingMarks ? 'Saving...' : 'Save Marks'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  )
}
