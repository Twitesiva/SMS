import { useEffect, useState } from 'react'
import AdminShell from '../../components/AdminShell'
import crestPrimary from '../../assets/media/images.png'
import { libraryNavGroups } from './nav'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../store/ui'

export default function Circulation() {
  const [activeLoans, setActiveLoans] = useState([])
  const [form, setForm] = useState({
    studentId: '',
    bookRef: '',
    action: 'Issue',
    dueDate: '',
    remarks: ''
  })
  const [saving, setSaving] = useState(false)

  const loadLoans = async () => {
    try {
      const { data, error } = await supabase
        .from('library_loans')
        .select(
          'id, status, due_date, students(full_name,student_id), library_book_copies(book_id, library_books(title))'
        )
        .eq('status', 'ISSUED')
        .order('due_date', { ascending: true })

      if (error) throw error
      setActiveLoans(data || [])
    } catch (err) {
      console.error('Failed to load active loans', err)
      setActiveLoans([])
    }
  }

  useEffect(() => {
    loadLoans()
  }, [])

  const handleChange = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
  }

  const resetForm = () => {
    setForm({
      studentId: '',
      bookRef: '',
      action: 'Issue',
      dueDate: '',
      remarks: ''
    })
  }

  const resolveBookCopy = async (bookRef) => {
    const trimmed = bookRef.trim()
    if (!trimmed) return null

    const numericId = Number(trimmed)
    let bookQuery = supabase.from('library_books').select('id, title')

    if (Number.isFinite(numericId) && String(numericId) === trimmed) {
      bookQuery = bookQuery.eq('id', numericId)
    } else {
      bookQuery = bookQuery.or(`isbn.eq.${trimmed},title.ilike.%${trimmed}%`)
    }

    const { data: bookRows, error: bookError } = await bookQuery.limit(1)
    if (bookError) throw bookError
    const bookRow = (bookRows || [])[0]
    if (!bookRow) return null

    const { data: copyRows, error: copyError } = await supabase
      .from('library_book_copies')
      .select('id, availability')
      .eq('book_id', bookRow.id)
      .eq('availability', 'AVAILABLE')
      .order('id', { ascending: true })
      .limit(1)

    if (copyError) throw copyError
    const copyRow = (copyRows || [])[0]
    if (!copyRow) return { book: bookRow, copy: null }

    return { book: bookRow, copy: copyRow }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.studentId.trim()) {
      showToast('Enter a student ID.', { type: 'warning' })
      return
    }
    if (!form.bookRef.trim()) {
      showToast('Enter a book ID or ISBN.', { type: 'warning' })
      return
    }

    setSaving(true)
    try {
      const { data: studentRows, error: studentError } = await supabase
        .from('students')
        .select('student_id')
        .eq('student_id', form.studentId.trim())
        .limit(1)

      if (studentError) throw studentError
      const studentRow = (studentRows || [])[0]
      if (!studentRow) {
        showToast('Student not found.', { type: 'warning' })
        setSaving(false)
        return
      }

      const resolved = await resolveBookCopy(form.bookRef)
      if (!resolved || !resolved.book) {
        showToast('Book not found.', { type: 'warning' })
        setSaving(false)
        return
      }

      if (form.action === 'Issue') {
        if (!resolved.copy) {
          showToast('No available copies for this book.', { type: 'warning' })
          setSaving(false)
          return
        }

        const dueDate = form.dueDate ? form.dueDate : null
        if (!dueDate) {
          showToast('Select a due date.', { type: 'warning' })
          setSaving(false)
          return
        }

        const { error: insertError } = await supabase
          .from('library_loans')
          .insert([
            {
              student_id: studentRow.student_id,
              book_copy_id: resolved.copy.id,
              due_date: dueDate,
              status: 'ISSUED',
              remarks: form.remarks || null
            }
          ])

        if (insertError) throw insertError

        const { error: copyUpdateError } = await supabase
          .from('library_book_copies')
          .update({ availability: 'ISSUED' })
          .eq('id', resolved.copy.id)

        if (copyUpdateError) throw copyUpdateError

        showToast('Book issued successfully.', { type: 'success' })
      } else if (form.action === 'Return') {
        const { data: loanRows, error: loanError } = await supabase
          .from('library_loans')
          .select('id, book_copy_id, due_date, library_book_copies!inner(book_id)')
          .eq('student_id', studentRow.student_id)
          .eq('status', 'ISSUED')
          .eq('library_book_copies.book_id', resolved.book.id)
          .order('issued_at', { ascending: false })
          .limit(1)

        if (loanError) throw loanError
        const loanRow = (loanRows || [])[0]
        if (!loanRow) {
          showToast('No active loan found for this student and book.', { type: 'warning' })
          setSaving(false)
          return
        }

        const { error: updateError } = await supabase
          .from('library_loans')
          .update({ status: 'RETURNED', returned_at: new Date().toISOString() })
          .eq('id', loanRow.id)

        if (updateError) throw updateError

        const { error: copyUpdateError } = await supabase
          .from('library_book_copies')
          .update({ availability: 'AVAILABLE' })
          .eq('id', loanRow.book_copy_id)

        if (copyUpdateError) throw copyUpdateError

        const dueDateValue = loanRow.due_date ? new Date(loanRow.due_date) : null
        const todayValue = new Date()
        if (dueDateValue && todayValue > dueDateValue) {
          const { data: existingFines, error: fineCheckError } = await supabase
            .from('library_fines')
            .select('id')
            .eq('loan_id', loanRow.id)
            .limit(1)

          if (fineCheckError) throw fineCheckError
          const existingFine = (existingFines || [])[0]
          if (!existingFine) {
            const { error: fineError } = await supabase
              .from('library_fines')
              .insert([
                {
                  loan_id: loanRow.id,
                  student_id: studentRow.student_id,
                  amount: 100,
                  status: 'PENDING'
                }
              ])

            if (fineError) throw fineError
            showToast('Book returned with overdue fine applied.', { type: 'warning' })
          }
        }

        showToast('Book returned successfully.', { type: 'success' })
      } else if (form.action === 'Renew') {
        const dueDate = form.dueDate ? form.dueDate : null
        if (!dueDate) {
          showToast('Select a new due date.', { type: 'warning' })
          setSaving(false)
          return
        }

        const { data: loanRows, error: loanError } = await supabase
          .from('library_loans')
          .select('id, library_book_copies!inner(book_id)')
          .eq('student_id', studentRow.student_id)
          .eq('status', 'ISSUED')
          .eq('library_book_copies.book_id', resolved.book.id)
          .order('issued_at', { ascending: false })
          .limit(1)

        if (loanError) throw loanError
        const loanRow = (loanRows || [])[0]
        if (!loanRow) {
          showToast('No active loan found for this student and book.', { type: 'warning' })
          setSaving(false)
          return
        }

        const { error: renewError } = await supabase
          .from('library_loans')
          .update({ due_date: dueDate })
          .eq('id', loanRow.id)

        if (renewError) throw renewError

        showToast('Loan renewed successfully.', { type: 'success' })
      }

      resetForm()
      loadLoans()
    } catch (err) {
      console.error('Failed to update circulation', err)
      showToast('Unable to update circulation right now.', { type: 'danger' })
    } finally {
      setSaving(false)
    }
  }
  return (
    <AdminShell
      navGroups={libraryNavGroups}
      brandTitle="Library Management Console"
      brandSubtitle="Vijayam"
      footerTitle="Library Management Studio"
      footerSubtitle="Crafted for Vijayam College"
    >
      <div className="desktop-container" style={{ overflowX: 'hidden' }}>
        <section className="setup-hero mb-4 text-center">
          <div className="setup-hero-copywrap mx-auto text-center" style={{ maxWidth: '640px' }}>
            <div className="admin-applications__crest mx-auto" aria-hidden="true">
              <img src={crestPrimary} alt="Vijayam crest" />
            </div>
            <h3 className="setup-hero-title mb-2">Book Outgoing</h3>
            <p className="setup-hero-copy mb-3">Issue, return, and renew books seamlessly.</p>
            <div className="setup-hero-chips d-flex flex-wrap gap-2 justify-content-center">
              <span className="setup-hero-chip text-uppercase">ISSUE DESK</span>
              <span className="setup-hero-chip text-uppercase">RETURNS</span>
              <span className="setup-hero-chip text-uppercase">RENEWALS</span>
            </div>
          </div>
        </section>

        <div className="row g-4 justify-content-center mx-0">
          <div className="col-12 col-lg-5">
            <div className="card card-soft p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h4 className="mb-1">Issue / Return</h4>
                  <p className="text-muted mb-0">Process member transactions quickly.</p>
                </div>
                <button type="button" className="btn btn-outline-secondary">Reset</button>
              </div>
              <form className="row g-3" onSubmit={handleSubmit}>
                <div className="col-12">
                  <label className="form-label">Student ID</label>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="STU-1001"
                    value={form.studentId}
                    onChange={handleChange('studentId')}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label">Book ID / ISBN</label>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="Enter Book ID or ISBN"
                    value={form.bookRef}
                    onChange={handleChange('bookRef')}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Action</label>
                  <select className="form-select" value={form.action} onChange={handleChange('action')}>
                    <option>Issue</option>
                    <option>Return</option>
                    <option>Renew</option>
                  </select>
                </div>
                {form.action !== 'Return' && (
                  <div className="col-md-6">
                    <label className="form-label">Due Date</label>
                    <input
                      className="form-control"
                      type="date"
                      value={form.dueDate}
                      onChange={handleChange('dueDate')}
                    />
                  </div>
                )}
                <div className="col-12">
                  <label className="form-label">Remarks</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    placeholder="Optional notes"
                    value={form.remarks}
                    onChange={handleChange('remarks')}
                  />
                </div>
                <div className="col-12 d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-outline-secondary" onClick={resetForm}>Clear</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : 'Submit'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="col-12 col-lg-7">
            <div className="card card-soft p-4 h-100">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h4 className="mb-1">Active Loans</h4>
                  <p className="text-muted mb-0">Monitor currently issued books.</p>
                </div>
                <button type="button" className="btn btn-outline-secondary btn-sm">Export</button>
              </div>
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Student</th>
                      <th>Book</th>
                      <th>Status</th>
                      <th className="text-end">Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeLoans.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="text-center text-muted py-4">No active loans loaded.</td>
                      </tr>
                    ) : (
                      activeLoans.map((loan) => {
                        const student = loan.students
                        const book = loan.library_book_copies?.library_books
                        return (
                          <tr key={loan.id}>
                            <td>{student?.full_name || 'Unknown'} ({student?.student_id || '--'})</td>
                            <td>{book?.title || 'Unknown'}</td>
                            <td>
                              <span className="badge bg-success-subtle text-success">Issued</span>
                            </td>
                            <td className="text-end">{loan.due_date || '--'}</td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  )
}
