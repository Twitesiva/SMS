import { useEffect, useState } from 'react'
import AdminShell from '../../components/AdminShell'
import crestPrimary from '../../assets/media/images.png'
import { libraryNavGroups } from './nav'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../store/ui'

export default function Books() {
  const [recentBooks, setRecentBooks] = useState([])
  const [copyCounts, setCopyCounts] = useState({})
  const [form, setForm] = useState({
    title: '',
    isbn: '',
    author: '',
    category: '',
    categoryCustom: '',
    language: '',
    publisher: '',
    published_year: '',
    edition: '',
    copies: '',
    shelf_code: '',
    status: 'ACTIVE'
  })
  const [saving, setSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  const loadBooks = async () => {
    try {
      const { data: bookRows, error: bookError } = await supabase
        .from('library_books')
        .select('id, title, category, created_at')
        .order('created_at', { ascending: false })
        .limit(10)

      if (bookError) throw bookError
      setRecentBooks(bookRows || [])

      const bookIds = (bookRows || []).map((row) => row.id)
      if (bookIds.length === 0) {
        setCopyCounts({})
        return
      }

      const { data: copyRows, error: copyError } = await supabase
        .from('library_book_copies')
        .select('book_id')
        .in('book_id', bookIds)

      if (copyError) throw copyError

      const counts = (copyRows || []).reduce((acc, row) => {
        const key = String(row.book_id)
        acc[key] = (acc[key] || 0) + 1
        return acc
      }, {})
      setCopyCounts(counts)
    } catch (error) {
      console.error('Failed to load books', error)
      setRecentBooks([])
      setCopyCounts({})
    }
  }

  useEffect(() => {
    loadBooks()
  }, [])

  const handleChange = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
  }

  const resetForm = () => {
    setForm({
      title: '',
      isbn: '',
      author: '',
      category: '',
      categoryCustom: '',
      language: '',
      publisher: '',
      published_year: '',
      edition: '',
      copies: '',
      shelf_code: '',
      status: 'ACTIVE'
    })
    setStatusMessage('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatusMessage('')

    if (!form.title.trim()) {
      setStatusMessage('Title is required.')
      showToast('Title is required.', { type: 'warning' })
      return
    }

    const categoryValue = form.categoryCustom.trim() || form.category.trim() || null
    const copiesCount = Math.max(0, Number(form.copies || 0))

    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        isbn: form.isbn.trim() || null,
        author: form.author.trim() || null,
        category: categoryValue,
        language: form.language.trim() || null,
        publisher: form.publisher.trim() || null,
        published_year: form.published_year ? Number(form.published_year) : null,
        edition: form.edition.trim() || null,
        shelf_code: form.shelf_code.trim() || null,
        status: form.status || 'ACTIVE'
      }

      const { data: bookRow, error: bookError } = await supabase
        .from('library_books')
        .insert([payload])
        .select()
        .single()

      if (bookError) throw bookError

      if (copiesCount > 0 && bookRow?.id) {
        const copyRows = Array.from({ length: copiesCount }, (_, index) => ({
          book_id: bookRow.id,
          copy_code: `LIB-${bookRow.id}-${index + 1}`,
          availability: 'AVAILABLE'
        }))
        const { error: copyError } = await supabase.from('library_book_copies').insert(copyRows)
        if (copyError) throw copyError
      }

      setStatusMessage('Book added successfully.')
      showToast('Book added successfully.', { type: 'success' })
      resetForm()
      loadBooks()
    } catch (error) {
      console.error('Failed to save book', error)
      setStatusMessage('Unable to add book right now.')
      showToast('Unable to add book right now.', { type: 'danger' })
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
            <h3 className="setup-hero-title mb-2">Library Book Entry</h3>
            <p className="setup-hero-copy mb-3">Track inventory, metadata, and shelf location details.</p>
            <div className="setup-hero-chips d-flex flex-wrap gap-2 justify-content-center">
              <span className="setup-hero-chip text-uppercase">CATALOGUE</span>
              <span className="setup-hero-chip text-uppercase">INVENTORY</span>
              <span className="setup-hero-chip text-uppercase">METADATA</span>
            </div>
          </div>
        </section>

        <div className="row g-4 justify-content-center mx-0">
          <div className="col-12 col-lg-7">
            <div className="card card-soft p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h4 className="mb-1">Book Details</h4>
                  <p className="text-muted mb-0">Add or update catalog information.</p>
                </div>
                <button type="button" className="btn btn-outline-secondary">Reset</button>
              </div>
              <form className="row g-3" onSubmit={handleSubmit}>
                <div className="col-md-8">
                  <label className="form-label">Title</label>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="Enter book title"
                    value={form.title}
                    onChange={handleChange('title')}
                    required
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">ISBN</label>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="ISBN number"
                    value={form.isbn}
                    onChange={handleChange('isbn')}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Author</label>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="Author name"
                    value={form.author}
                    onChange={handleChange('author')}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Category</label>
                  <select className="form-select" value={form.category} onChange={handleChange('category')}>
                    <option value="">Select</option>
                    <option>Computer Science</option>
                    <option>Management</option>
                    <option>Commerce</option>
                    <option>Literature</option>
                  </select>
                  <input
                    className="form-control mt-2"
                    type="text"
                    placeholder="Add new category"
                    value={form.categoryCustom}
                    onChange={handleChange('categoryCustom')}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Language</label>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="Search language"
                    list="library-language-list"
                    value={form.language}
                    onChange={handleChange('language')}
                  />
                  <datalist id="library-language-list">
                    <option value="English" />
                    <option value="Tamil" />
                    <option value="Hindi" />
                    <option value="Telugu" />
                    <option value="Malayalam" />
                    <option value="Kannada" />
                    <option value="Urdu" />
                    <option value="Sanskrit" />
                    <option value="French" />
                    <option value="German" />
                  </datalist>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Publisher</label>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="Publisher name"
                    value={form.publisher}
                    onChange={handleChange('publisher')}
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label">Year</label>
                  <input
                    className="form-control"
                    type="number"
                    placeholder="2025"
                    value={form.published_year}
                    onChange={handleChange('published_year')}
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label">Edition</label>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="2nd"
                    value={form.edition}
                    onChange={handleChange('edition')}
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label">Copies</label>
                  <input
                    className="form-control"
                    type="number"
                    placeholder="10"
                    value={form.copies}
                    onChange={handleChange('copies')}
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label">Shelf</label>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="A-12"
                    value={form.shelf_code}
                    onChange={handleChange('shelf_code')}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={form.status} onChange={handleChange('status')}>
                    <option value="ACTIVE">Available</option>
                    <option value="REFERENCE">Reference Only</option>
                    <option value="RESTRICTED">Restricted</option>
                  </select>
                </div>
                <div className="col-12 d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-outline-secondary" onClick={resetForm}>Clear</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : 'Add Book'}
                  </button>
                </div>
                {statusMessage && (
                  <div className="col-12">
                    <div className="alert alert-info mb-0">{statusMessage}</div>
                  </div>
                )}
              </form>
            </div>
          </div>

          <div className="col-12 col-lg-5" />
        </div>

        <div className="card card-soft p-4 mt-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h5 className="mb-1">Recent Book Entries</h5>
              <p className="text-muted mb-0">Track last updated titles and availability.</p>
            </div>
            <button type="button" className="btn btn-outline-secondary btn-sm">View All</button>
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Copies</th>
                  <th className="text-end">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentBooks.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center text-muted py-4">No book entries loaded.</td>
                  </tr>
                ) : (
                  recentBooks.map((book) => {
                    const count = copyCounts[String(book.id)] || 0
                    const statusLabel = count > 0 ? 'Available' : 'Out'
                    const badgeClass = count > 0 ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'
                    return (
                      <tr key={book.id}>
                        <td>{book.title || 'Untitled'}</td>
                        <td>{book.category || '--'}</td>
                        <td>{count}</td>
                        <td className="text-end"><span className={`badge ${badgeClass}`}>{statusLabel}</span></td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminShell>
  )
}
