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
    dueDate: ''
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
      dueDate: ''
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
            status: 'ISSUED'
          }
        ])

      if (insertError) throw insertError

      const { error: copyUpdateError } = await supabase
        .from('library_book_copies')
        .update({ availability: 'ISSUED' })
        .eq('id', resolved.copy.id)

      if (copyUpdateError) throw copyUpdateError

      showToast('Book issued successfully.', { type: 'success' })

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
                <div className="col-12">
                  <label className="form-label">Due Date</label>
                  <input
                    className="form-control"
                    type="date"
                    value={form.dueDate}
                    onChange={handleChange('dueDate')}
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
