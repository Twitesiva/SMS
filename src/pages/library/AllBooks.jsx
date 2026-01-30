import { useEffect, useMemo, useState } from 'react'
import crestPrimary from '../../assets/media/images.png'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../store/ui'
import ConfirmationModal from '../../components/ConfirmationModal'
import LibraryPreloader from '../../components/LibraryPreloader'

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return dateStr.slice(0, 10).split('-').reverse().join('/')
}

const emptyEditForm = {
  title: '',
  isbn: '',
  author: '',
  language: '',
  publisher: '',
  published_year: '',
  edition: '',
  shelf_code: '',
  arrival_date: '',
  status: 'PUBLIC'
}

export default function AllBooks() {
  const [books, setBooks] = useState([])
  const [copyCounts, setCopyCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingBook, setEditingBook] = useState(null)
  const [editForm, setEditForm] = useState(emptyEditForm)
  const [saving, setSaving] = useState(false)
  const [deleteModal, setDeleteModal] = useState({ show: false, book: null, loading: false })
  const [tableFilter, setTableFilter] = useState('all') // all | available | issued | damaged | missing

  const [selectedBook, setSelectedBook] = useState(null)
  const [modalTab, setModalTab] = useState('all') // 'all', 'issued', 'damaged'
  const [bookDetails, setBookDetails] = useState({ copies: [], loans: [], issueLoans: [] })
  const [loadingDetails, setLoadingDetails] = useState(false)
  const todayString = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const handleBookClick = async (book, tab = 'all') => {
    setSelectedBook(book)
    setModalTab(tab)
    setLoadingDetails(true)
    try {
      // Fetch all copies for this book
      const { data: copies, error: copiesError } = await supabase
        .from('library_book_copies')
        .select('*')
        .eq('book_id', book.id)
        .order('id')

      if (copiesError) throw copiesError

      // Fetch active loans for this book
      const { data: loans, error: loansError } = await supabase
        .from('library_loans')
        .select(`
          id,
          status,
          due_date,
          issued_at,
          students (full_name, student_id),
          library_book_copies!inner (id, book_id)
        `)
        .eq('status', 'ISSUED')
        .eq('library_book_copies.book_id', book.id)
        .order('issued_at', { ascending: false })

      if (loansError) throw loansError

      // Fetch loans for missing/damaged copies
      const { data: issueLoans, error: issueLoansError } = await supabase
        .from('library_loans')
        .select(`
          id,
          status,
          issued_at,
          book_copy_id,
          students (full_name, student_id),
          library_book_copies!inner (id, book_id)
        `)
        .in('status', ['MISSING', 'DAMAGED'])
        .eq('library_book_copies.book_id', book.id)
        .order('issued_at', { ascending: false })

      if (issueLoansError) throw issueLoansError

      setBookDetails({
        copies: copies || [],
        loans: loans || [],
        issueLoans: issueLoans || []
      })
    } catch (err) {
      console.error('Error fetching book details:', err)
      showToast('Failed to load book details.', { type: 'error' })
    } finally {
      setLoadingDetails(false)
    }
  }

  const loadBooks = async () => {
    setLoading(true)
    try {
      const { data: bookRows, error: bookError } = await supabase
        .from('library_books')
        .select('id, title, isbn, author, language, publisher, published_year, edition, shelf_code, arrival_date, status, created_at')
        .order('created_at', { ascending: false })

      if (bookError) throw bookError
      setBooks(bookRows || [])

      const bookIds = (bookRows || []).map((row) => row.id)
      if (bookIds.length === 0) {
        setCopyCounts({})
        return
      }

      const { data: copyRows, error: copyError } = await supabase
        .from('library_book_copies')
        .select('book_id, availability')
        .in('book_id', bookIds)

      if (copyError) throw copyError

      const counts = (copyRows || []).reduce(
        (acc, row) => {
          const key = String(row.book_id)
          acc[key] = acc[key] || { total: 0, available: 0, damaged: 0, missing: 0, issued: 0 }
          acc[key].total += 1
          const availability = (row.availability || '').toUpperCase()
          if (availability === 'AVAILABLE') acc[key].available += 1
          else if (availability === 'DAMAGED') acc[key].damaged += 1
          else if (availability === 'MISSING') acc[key].missing += 1
          else if (availability === 'ISSUED') acc[key].issued += 1
          return acc
        },
        {}
      )
      setCopyCounts(counts)
    } catch (error) {
      console.error('Failed to load books', error)
      setBooks([])
      setCopyCounts({})
      showToast('Unable to load books right now.', { type: 'danger' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBooks()
  }, [])

  const filteredBooks = useMemo(() => {
    let result = books
    const term = searchTerm.trim().toLowerCase()

    if (term) {
      result = result.filter((book) => {
        const haystack = [
          book.title,
          book.isbn,
          book.author,
          book.publisher,
          book.language,
          book.shelf_code,
          book.published_year
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(term)
      })
    }

    const applyFilter = (book) => {
      const info = copyCounts[String(book.id)] || { total: 0, available: 0, issued: 0, damaged: 0, missing: 0 }
      if (tableFilter === 'available') return info.available > 0
      if (tableFilter === 'issued') return info.issued > 0
      if (tableFilter === 'damaged') return info.damaged > 0
      if (tableFilter === 'missing') return info.missing > 0
      return true
    }

    return result.filter(applyFilter)
  }, [books, searchTerm, copyCounts, tableFilter])

  const stats = useMemo(() => {
    const totalTitles = books.length
    const totalCopies = Object.values(copyCounts).reduce((sum, count) => sum + (count?.total || 0), 0)
    const totalAvailable = Object.values(copyCounts).reduce((sum, count) => sum + (count?.available || 0), 0)
    const totalDamaged = Object.values(copyCounts).reduce((sum, count) => sum + (count?.damaged || 0), 0)
    const totalMissing = Object.values(copyCounts).reduce((sum, count) => sum + (count?.missing || 0), 0)
    const totalIssued = Object.values(copyCounts).reduce((sum, count) => sum + (count?.issued || 0), 0)
    const shelfSet = new Set(
      books
        .map((book) => String(book.shelf_code || '').trim())
        .filter((code) => code.length > 0)
    )
    const totalShelves = shelfSet.size
    return { totalTitles, totalCopies, totalAvailable, totalDamaged, totalMissing, totalIssued, totalShelves }
  }, [books, copyCounts])

  const openEdit = (book) => {
    setEditingBook(book)
    setEditForm({
      title: book.title || '',
      isbn: book.isbn || '',
      author: book.author || '',
      language: book.language || '',
      publisher: book.publisher || '',
      published_year: book.published_year ? String(book.published_year) : '',
      edition: book.edition || '',
      shelf_code: book.shelf_code || '',
      arrival_date:
        book.arrival_date ||
        (book.created_at ? new Date(book.created_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)),
      status: book.status || 'PUBLIC'
    })
  }

  const closeEdit = () => {
    setEditingBook(null)
    setEditForm(emptyEditForm)
  }

  const handleEditChange = (key) => (event) => {
    setEditForm((prev) => ({ ...prev, [key]: event.target.value }))
  }

  const handleEditSubmit = async (event) => {
    event.preventDefault()
    if (!editingBook) return

    if (!editForm.title.trim()) {
      showToast('Title is required.', { type: 'warning' })
      return
    }

    setSaving(true)
    try {
      const payload = {
        title: editForm.title.trim(),
        isbn: editForm.isbn.trim() || null,
        author: editForm.author.trim() || null,
        language: editForm.language.trim() || null,
        publisher: editForm.publisher.trim() || null,
        published_year: editForm.published_year ? Number(editForm.published_year) : null,
        edition: editForm.edition.trim() || null,
        shelf_code: editForm.shelf_code.trim() || null,
        arrival_date: editForm.arrival_date || null,
        status: editForm.status || 'PUBLIC'
      }

      const { data, error } = await supabase
        .from('library_books')
        .update(payload)
        .eq('id', editingBook.id)
        .select()
        .single()

      if (error) throw error

      setBooks((prev) => prev.map((item) => (item.id === editingBook.id ? { ...item, ...data } : item)))
      showToast('Book updated successfully.', { type: 'success' })
      closeEdit()
    } catch (error) {
      console.error('Failed to update book', error)
      showToast('Unable to update book.', { type: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  const openDeleteModal = (book) => {
    setDeleteModal({ show: true, book, loading: false })
  }

  const closeDeleteModal = () => {
    setDeleteModal({ show: false, book: null, loading: false })
  }

  const confirmDelete = async () => {
    if (!deleteModal.book) return
    setDeleteModal((prev) => ({ ...prev, loading: true }))
    try {
      // Fetch copies for this book
      const { data: copyRows, error: copyFetchError } = await supabase
        .from('library_book_copies')
        .select('id')
        .eq('book_id', deleteModal.book.id)
      if (copyFetchError) throw copyFetchError

      const copyIds = (copyRows || []).map((c) => c.id)

      // Fetch loans tied to these copies
      let loanIds = []
      if (copyIds.length > 0) {
        const { data: loanRows, error: loanFetchError } = await supabase
          .from('library_loans')
          .select('id')
          .in('book_copy_id', copyIds)
        if (loanFetchError) throw loanFetchError
        loanIds = (loanRows || []).map((l) => l.id)
      }

      // Delete fines linked to those loans
      if (loanIds.length > 0) {
        const { error: fineDeleteError } = await supabase
          .from('library_fines')
          .delete()
          .in('loan_id', loanIds)
        if (fineDeleteError) throw fineDeleteError
      }

      // Delete loans
      if (loanIds.length > 0) {
        const { error: loanDeleteError } = await supabase
          .from('library_loans')
          .delete()
          .in('id', loanIds)
        if (loanDeleteError) throw loanDeleteError
      }

      // Delete copies
      if (copyIds.length > 0) {
        const { error: copyDeleteError } = await supabase
          .from('library_book_copies')
          .delete()
          .in('id', copyIds)
        if (copyDeleteError) throw copyDeleteError
      }

      // Delete book
      const { error: bookError } = await supabase
        .from('library_books')
        .delete()
        .eq('id', deleteModal.book.id)

      if (bookError) throw bookError

      showToast('Book and related records deleted.', { type: 'success' })
      closeDeleteModal()
      loadBooks()
    } catch (error) {
      console.error('Failed to delete book', error)
      showToast('Unable to delete this book.', { type: 'danger' })
      setDeleteModal((prev) => ({ ...prev, loading: false }))
    }
  }

  if (loading && books.length === 0) {
    return (
      <LibraryPreloader
        title="Loading catalogue"
        subtitle="Preparing book inventory and copy status."
        statCount={6}
        panelCount={2}
        rowCount={6}
      />
    )
  }

  return (
    <div className="desktop-container library-catalogue-page" style={{ overflowX: 'hidden' }}>
      <div className="library-catalogue-stats row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-xl-6 g-3 mb-4">
        <div className="col">
          <div className="library-catalogue-stat">
            <div className="library-catalogue-stat__label">Total Titles</div>
            <div className="library-catalogue-stat__value">{stats.totalTitles}</div>
            <div className="library-catalogue-stat__meta">All catalogued books</div>
          </div>
        </div>
        <div className="col">
          <div className="library-catalogue-stat" style={{ cursor: 'pointer' }} onClick={() => setTableFilter('all')}>
            <div className="library-catalogue-stat__label">Total Copies</div>
            <div className="library-catalogue-stat__value">{stats.totalCopies}</div>
            <div className="library-catalogue-stat__meta">Across all shelves</div>
          </div>
        </div>
        <div className="col">
          <div className={`library-catalogue-stat ${tableFilter === 'available' ? 'border border-primary' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setTableFilter('available')}>
            <div className="library-catalogue-stat__label">Available</div>
            <div className="library-catalogue-stat__value">{stats.totalAvailable}</div>
            <div className="library-catalogue-stat__meta">Filter: available</div>
          </div>
        </div>
        <div className="col">
          <div className={`library-catalogue-stat ${tableFilter === 'issued' ? 'border border-primary' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setTableFilter('issued')}>
            <div className="library-catalogue-stat__label">Issued</div>
            <div className="library-catalogue-stat__value">{stats.totalIssued}</div>
            <div className="library-catalogue-stat__meta">Filter: issued</div>
          </div>
        </div>
        <div className="col">
          <div className={`library-catalogue-stat ${tableFilter === 'damaged' ? 'border border-primary' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setTableFilter('damaged')}>
            <div className="library-catalogue-stat__label">Damaged</div>
            <div className="library-catalogue-stat__value">{stats.totalDamaged}</div>
            <div className="library-catalogue-stat__meta">Filter: damaged</div>
          </div>
        </div>
        <div className="col">
          <div className={`library-catalogue-stat ${tableFilter === 'missing' ? 'border border-primary' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setTableFilter('missing')}>
            <div className="library-catalogue-stat__label">Missing</div>
            <div className="library-catalogue-stat__value">{stats.totalMissing}</div>
            <div className="library-catalogue-stat__meta">Filter: missing</div>
          </div>
        </div>
      </div>

      <div className="library-catalogue-toolbar">
        <div>
          <h4 className="mb-1">Catalogue Overview</h4>
          <p className="text-muted mb-0">
            Search by title, author, ISBN, shelf code, or year.
            {tableFilter !== 'all' && (
              <span className="ms-2 badge bg-primary">Filter: {tableFilter}</span>
            )}
          </p>
        </div>
        <div className="library-catalogue-toolbar__actions">
          <div className="library-catalogue-search">
            <span className="library-catalogue-search__icon">
              <i className="bi bi-search" aria-hidden="true"></i>
            </span>
            <input
              className="form-control"
              type="search"
              placeholder="Search books"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          {tableFilter !== 'all' && (
            <button className="btn btn-outline-primary" type="button" onClick={() => setTableFilter('all')}>
              Clear Filter
            </button>
          )}
        </div>
        <div className="library-catalogue-toolbar__meta">
          Showing {filteredBooks.length} of {books.length} titles
        </div>
      </div>

      <div className="library-catalogue-table-card">
        <div className="table-responsive">
          <table className="table library-catalogue-table mb-0">
            <thead>
              <tr>
                <th>Book Title</th>
                <th>Shelf</th>
                <th>Author</th>
                <th>Published Year</th>
                <th>Copies</th>
                <th>Issued</th>
                <th>Damaged</th>
                <th>Missed</th>
                <th>Available</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="10" className="text-center text-muted py-4">Loading books...</td>
                </tr>
              ) : filteredBooks.length === 0 ? (
                <tr>
                  <td colSpan="10" className="text-center text-muted py-4">No books found.</td>
                </tr>
              ) : (
                filteredBooks.map((book) => {
                  const copyInfo = copyCounts[String(book.id)] || { total: 0, available: 0, issued: 0, damaged: 0, missing: 0 }
                  return (
                    <tr
                      key={book.id}
                      onClick={() => handleBookClick(book)}
                      style={{ cursor: 'pointer' }}
                      className="library-book-row"
                    >
                      <td>
                        <div className="library-catalogue-title">{book.title || 'Untitled'}</div>
                      </td>
                      <td>{book.shelf_code || '-'}</td>
                      <td>{book.author || 'Unknown'}</td>
                      <td>{book.published_year || '-'}</td>
                      <td>
                        <span className="library-catalogue-count">{copyInfo.total}</span>
                      </td>
                      <td>
                        <span className="library-catalogue-count">
                          {copyInfo.issued}
                        </span>
                      </td>
                      <td>
                        <span className="library-catalogue-count">
                          {copyInfo.damaged}
                        </span>
                      </td>
                      <td>
                        <span className="library-catalogue-count">
                          {copyInfo.missing}
                        </span>
                      </td>
                      <td>
                        <span className="library-catalogue-count">
                          {copyInfo.available}
                        </span>
                      </td>
                      <td className="text-end">
                        <div className="library-catalogue-actions">
                          <button
                            type="button"
                            className="library-action-button library-action-button--edit"
                            onClick={(e) => {
                              e.stopPropagation()
                              openEdit(book)
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="library-action-button library-action-button--delete"
                            onClick={(e) => {
                              e.stopPropagation()
                              openDeleteModal(book)
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingBook && (
        <div className="library-edit-modal modal d-block" tabIndex="-1">
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold">Edit Book</h5>
                <button type="button" className="btn-close" onClick={closeEdit} aria-label="Close" />
              </div>
              <div className="modal-body">
                <form className="row g-3" onSubmit={handleEditSubmit}>
                  <div className="col-md-8">
                    <label className="form-label">Title</label>
                    <input
                      className="form-control"
                      type="text"
                      value={editForm.title}
                      onChange={handleEditChange('title')}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">ISBN</label>
                    <input
                      className="form-control"
                      type="text"
                      value={editForm.isbn}
                      onChange={handleEditChange('isbn')}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Author</label>
                    <input
                      className="form-control"
                      type="text"
                      value={editForm.author}
                      onChange={handleEditChange('author')}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Language</label>
                    <input
                      className="form-control"
                      type="text"
                      placeholder="Select or type language"
                      list="all-books-language-list"
                      value={editForm.language}
                      onChange={handleEditChange('language')}
                    />
                    <datalist id="all-books-language-list">
                      <option value="English" />
                      <option value="Tamil" />
                      <option value="Hindi" />
                      <option value="Telugu" />
                      <option value="Malayalam" />
                      <option value="Kannada" />
                      <option value="Urdu" />
                      <option value="Sanskrit" />
                      <option value="Arabic" />
                      <option value="Assamese" />
                      <option value="Bengali" />
                      <option value="Chinese" />
                      <option value="Dutch" />
                      <option value="French" />
                      <option value="German" />
                      <option value="Gujarati" />
                      <option value="Italian" />
                      <option value="Japanese" />
                      <option value="Korean" />
                      <option value="Marathi" />
                      <option value="Oriya" />
                      <option value="Persian" />
                      <option value="Portuguese" />
                      <option value="Punjabi" />
                      <option value="Russian" />
                      <option value="Spanish" />
                      <option value="Turkish" />
                    </datalist>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Publisher</label>
                    <input
                      className="form-control"
                      type="text"
                      value={editForm.publisher}
                      onChange={handleEditChange('publisher')}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label">Published Year</label>
                    <input
                      className="form-control"
                      type="number"
                      value={editForm.published_year}
                      onChange={handleEditChange('published_year')}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Arrival Date</label>
                    <input
                      className="form-control"
                      type="date"
                      value={editForm.arrival_date}
                      onChange={handleEditChange('arrival_date')}
                      required
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Edition</label>
                    <input
                      className="form-control"
                      type="text"
                      value={editForm.edition}
                      onChange={handleEditChange('edition')}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Shelf</label>
                    <input
                      className="form-control"
                      type="text"
                      value={editForm.shelf_code}
                      onChange={handleEditChange('shelf_code')}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Status</label>
                    <select className="form-select" value={editForm.status} onChange={handleEditChange('status')}>
                      <option value="PUBLIC">Public</option>
                      <option value="PRIVATE">Private</option>
                    </select>
                  </div>
                  <div className="col-12 d-flex justify-content-end gap-2">
                    <button type="button" className="btn btn-outline-secondary" onClick={closeEdit} disabled={saving}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={deleteModal.show}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        title="Delete Book"
        message={`Are you sure you want to delete ${deleteModal.book?.title || 'this book'}?`}
        confirmText={deleteModal.loading ? 'Deleting...' : 'Delete'}
        isLoading={deleteModal.loading}
      />

      {selectedBook && (
        <>
          <div className="modal-backdrop fade show"></div>
          <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1">
            <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
              <div className="modal-content">
                <div className="modal-header d-flex flex-column align-items-center border-bottom-0 pt-4 pb-0 position-relative">
                  <div className="text-center w-100">
                    <div className="mb-4 px-4">
                      <div className="text-uppercase fw-bold text-muted mb-1" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                        Book Title
                      </div>
                      <h3 className="fw-bold text-dark mb-0 fs-4">
                        {selectedBook.title}
                      </h3>
                    </div>

                    <div className="row g-0 border-top border-bottom py-3 bg-light w-100">
                      <div className="col-6 border-end px-2">
                        <div className="text-uppercase fw-bold text-muted mb-1" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                          Author
                        </div>
                        <div className="fw-bold text-primary fs-5">
                          {selectedBook.author || 'Unknown'}
                        </div>
                      </div>
                      <div className="col-6 px-2">
                        <div className="text-uppercase fw-bold text-muted mb-1" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                          Shelf Reference
                        </div>
                        <div className="fw-bold text-dark fs-5">
                          {selectedBook.shelf_code || '--'}
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-close position-absolute"
                    style={{ right: '1.25rem', top: '1.25rem' }}
                    onClick={() => setSelectedBook(null)}
                  ></button>
                </div>
                <div className="modal-body">
                  {loadingDetails ? (
                    <div className="text-center py-4">
                      <div className="spinner-border text-primary" role="status"></div>
                      <p className="mt-2 text-muted">Loading details...</p>
                    </div>
                  ) : (
                    <div className="d-flex flex-column gap-4">
                      {/* Stats Row */}
                      <div className="row g-2 justify-content-center">
                        <div className="col-4 col-sm">
                          <div
                            className={`p-2 border rounded text-center h-100 d-flex flex-column justify-content-center ${modalTab === 'all' ? 'bg-primary text-white' : 'bg-light'}`}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setModalTab('all')}
                          >
                            <div className={`small text-uppercase fw-bold ${modalTab === 'all' ? 'text-white-50' : 'text-muted'}`} style={{ fontSize: '0.7rem' }}>Total</div>
                            <div className="fs-4 fw-bold">{bookDetails.copies.length}</div>
                          </div>
                        </div>
                        <div className="col-4 col-sm">
                          <div
                            className={`p-2 border rounded text-center h-100 d-flex flex-column justify-content-center ${modalTab === 'issued' ? 'bg-primary text-white' : 'bg-light'}`}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setModalTab('issued')}
                          >
                            <div className={`small text-uppercase fw-bold ${modalTab === 'issued' ? 'text-white-50' : 'text-muted'}`} style={{ fontSize: '0.7rem' }}>Issued</div>
                            <div className={`fs-4 fw-bold ${modalTab === 'issued' ? 'text-white' : 'text-primary'}`}>{bookDetails.loans.length}</div>
                          </div>
                        </div>
                        <div className="col-4 col-sm">
                          <div
                            className={`p-2 border rounded text-center h-100 d-flex flex-column justify-content-center ${modalTab === 'missed' ? 'bg-primary text-white' : 'bg-light'}`}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setModalTab('missed')}
                          >
                            <div className={`small text-uppercase fw-bold ${modalTab === 'missed' ? 'text-white-50' : 'text-muted'}`} style={{ fontSize: '0.7rem' }}>Missed</div>
                            <div className={`fs-4 fw-bold ${modalTab === 'missed' ? 'text-white' : 'text-danger'}`}>
                              {bookDetails.copies.filter(c => (c.availability || '').toUpperCase() === 'MISSING').length}
                            </div>
                          </div>
                        </div>
                        <div className="col-4 col-sm">
                          <div
                            className={`p-2 border rounded text-center h-100 d-flex flex-column justify-content-center ${modalTab === 'damaged' ? 'bg-primary text-white' : 'bg-light'}`}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setModalTab('damaged')}
                          >
                            <div className={`small text-uppercase fw-bold ${modalTab === 'damaged' ? 'text-white-50' : 'text-muted'}`} style={{ fontSize: '0.7rem' }}>Damaged</div>
                            <div className={`fs-4 fw-bold ${modalTab === 'damaged' ? 'text-white' : 'text-warning text-dark'}`}>
                              {bookDetails.copies.filter(c => (c.availability || '').toUpperCase() === 'DAMAGED').length}
                            </div>
                          </div>
                        </div>
                        <div className="col-4 col-sm">
                          <div className="p-2 border rounded bg-light text-center h-100 d-flex flex-column justify-content-center">
                            <div className="small text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Balance</div>
                            <div className="fs-4 fw-bold text-success">
                              {bookDetails.copies.length - bookDetails.loans.length - bookDetails.copies.filter(c => ['MISSING', 'DAMAGED'].includes((c.availability || '').toUpperCase())).length}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Filtered Sections */}
                      {(modalTab === 'all' || modalTab === 'issued') && (
                        <div>
                          <h6 className="text-uppercase fw-bold text-secondary mb-3 pt-2 border-bottom pb-2">Active Loans</h6>
                          {bookDetails.loans.length > 0 ? (
                            <div className="table-responsive">
                              <table className="table table-sm table-hover align-middle library-issue-details-table">
                                <thead className="table-light text-uppercase small text-muted">
                                  <tr>
                                    <th>Student ID</th>
                                    <th>Student Name</th>
                                    <th>Loan Date</th>
                                    <th>Due Date</th>
                                    <th>Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {bookDetails.loans.map(loan => (
                                    <tr key={loan.id}>
                                      <td className="fw-bold text-primary">{loan.students?.student_id}</td>
                                      <td className="fw-semibold">{loan.students?.full_name || 'Unknown'}</td>
                                      <td>{formatDate(loan.issued_at)}</td>
                                      <td className={loan.due_date < todayString ? 'text-danger fw-bold' : 'fw-semibold'}>
                                        {formatDate(loan.due_date)}
                                      </td>
                                      <td>
                                        <span className="badge bg-primary bg-opacity-10 text-primary">ISSUED</span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-muted small fst-italic mb-0">No active loans for this title.</p>
                          )}
                        </div>
                      )}

                      {(modalTab === 'all' || modalTab === 'missed') && (
                        <div className="mb-2">
                          <h6 className="text-uppercase fw-bold text-danger mb-3 pt-2 border-bottom pb-2">Missed Copies</h6>
                          {bookDetails.copies.filter(c => (c.availability || '').toUpperCase() === 'MISSING').length > 0 ? (
                            <div className="table-responsive">
                              <table className="table table-sm table-hover align-middle library-issue-details-table">
                                <thead className="table-light text-uppercase small text-muted">
                                  <tr>
                                    <th>Student ID</th>
                                    <th>Student Name</th>
                                    <th>Copy ID</th>
                                    <th>Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {bookDetails.copies
                                    .filter((c) => (c.availability || '').toUpperCase() === 'MISSING')
                                    .map((copy) => {
                                      const issueLoan = bookDetails.issueLoans?.find(
                                        (l) => l.book_copy_id === copy.id
                                      )
                                      return (
                                        <tr key={copy.id}>
                                          <td className="fw-bold text-primary">{issueLoan?.students?.student_id || '-'}</td>
                                          <td className="fw-semibold">{issueLoan?.students?.full_name || '-'}</td>
                                          <td className="font-monospace fw-bold">{copy.id}</td>
                                          <td>
                                            <span className="badge bg-danger fs-6">
                                              {copy.availability}
                                            </span>
                                          </td>
                                        </tr>
                                      )
                                    })}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-muted small fst-italic mb-0">No missed copies reported.</p>
                          )}
                        </div>
                      )}

                      {(modalTab === 'all' || modalTab === 'damaged') && (
                        <div>
                          <h6 className="text-uppercase fw-bold text-warning text-dark mb-3 pt-2 border-bottom pb-2">Damaged Copies</h6>
                          {bookDetails.copies.filter(c => (c.availability || '').toUpperCase() === 'DAMAGED').length > 0 ? (
                            <div className="table-responsive">
                              <table className="table table-sm table-hover align-middle">
                                <thead className="table-light text-uppercase small text-muted">
                                  <tr>
                                    <th>Student ID</th>
                                    <th>Student Name</th>
                                    <th>Copy ID</th>
                                    <th>Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {bookDetails.copies
                                    .filter((c) => (c.availability || '').toUpperCase() === 'DAMAGED')
                                    .map((copy) => {
                                      const issueLoan = bookDetails.issueLoans?.find(
                                        (l) => l.book_copy_id === copy.id
                                      )
                                      return (
                                        <tr key={copy.id}>
                                          <td className="fw-bold text-primary">{issueLoan?.students?.student_id || '-'}</td>
                                          <td className="fw-semibold">{issueLoan?.students?.full_name || '-'}</td>
                                          <td className="font-monospace fw-bold">{copy.id}</td>
                                          <td>
                                            <span className="badge bg-warning text-dark fs-6">
                                              {copy.availability}
                                            </span>
                                          </td>
                                        </tr>
                                      )
                                    })}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-muted small fst-italic mb-0">No damaged copies reported.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setSelectedBook(null)}>Close</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
