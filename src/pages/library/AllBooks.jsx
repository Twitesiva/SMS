import { useEffect, useMemo, useState } from 'react'
import crestPrimary from '../../assets/media/images.png'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../store/ui'
import ConfirmationModal from '../../components/ConfirmationModal'

const emptyEditForm = {
  title: '',
  isbn: '',
  author: '',
  language: '',
  publisher: '',
  published_year: '',
  edition: '',
  shelf_code: '',
  status: 'PUBLIC'
}

export default function AllBooks() {
  const [books, setBooks] = useState([])
  const [copyCounts, setCopyCounts] = useState({})
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingBook, setEditingBook] = useState(null)
  const [editForm, setEditForm] = useState(emptyEditForm)
  const [saving, setSaving] = useState(false)
  const [deleteModal, setDeleteModal] = useState({ show: false, book: null, loading: false })

  const loadBooks = async () => {
    setLoading(true)
    try {
      const { data: bookRows, error: bookError } = await supabase
        .from('library_books')
        .select('id, title, isbn, author, language, publisher, published_year, edition, shelf_code, status, created_at')
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

    return result
  }, [books, searchTerm])

  const stats = useMemo(() => {
    const totalTitles = books.length
    const totalCopies = Object.values(copyCounts).reduce((sum, count) => sum + count, 0)
    const shelfSet = new Set(
      books
        .map((book) => String(book.shelf_code || '').trim())
        .filter((code) => code.length > 0)
    )
    const totalShelves = shelfSet.size
    return { totalTitles, totalCopies, totalShelves }
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
      const { error: copyError } = await supabase
        .from('library_book_copies')
        .delete()
        .eq('book_id', deleteModal.book.id)

      if (copyError) throw copyError

      const { error: bookError } = await supabase
        .from('library_books')
        .delete()
        .eq('id', deleteModal.book.id)

      if (bookError) throw bookError

      showToast('Book deleted successfully.', { type: 'success' })
      closeDeleteModal()
      loadBooks()
    } catch (error) {
      console.error('Failed to delete book', error)
      showToast('Unable to delete this book.', { type: 'danger' })
      setDeleteModal((prev) => ({ ...prev, loading: false }))
    }
  }

  return (
    <div className="desktop-container library-catalogue-page" style={{ overflowX: 'hidden' }}>
      <section className="library-catalogue-hero">
        <div className="library-catalogue-hero__content">
          <div className="library-catalogue-hero__brand">
            <div className="library-catalogue-hero__crest" aria-hidden="true">
              <img src={crestPrimary} alt="Vijayam crest" />
            </div>
            <div>
              <div className="library-catalogue-hero__eyebrow">Library Console</div>
              <h2 className="library-catalogue-hero__title">All Books Catalogue</h2>
              <p className="library-catalogue-hero__subtitle">
                Review every title, update metadata, and manage inventory status.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="library-catalogue-stats row g-3 mb-4">
        <div className="col-12 col-md-4">
          <div className="library-catalogue-stat">
            <div className="library-catalogue-stat__label">Total Titles</div>
            <div className="library-catalogue-stat__value">{stats.totalTitles}</div>
            <div className="library-catalogue-stat__meta">All catalogued books</div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="library-catalogue-stat">
            <div className="library-catalogue-stat__label">Total Copies</div>
            <div className="library-catalogue-stat__value">{stats.totalCopies}</div>
            <div className="library-catalogue-stat__meta">Across all shelves</div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="library-catalogue-stat">
            <div className="library-catalogue-stat__label">Total Shelves</div>
            <div className="library-catalogue-stat__value">{stats.totalShelves}</div>
            <div className="library-catalogue-stat__meta">Distinct shelf codes</div>
          </div>
        </div>
      </div>

      <div className="library-catalogue-toolbar">
        <div>
          <h4 className="mb-1">Catalogue Overview</h4>
          <p className="text-muted mb-0">Search by title, author, ISBN, shelf code, or year.</p>
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
          
          <button className="btn btn-outline-secondary" type="button" onClick={() => { setSearchTerm(''); loadBooks(); }}>
            Reset
          </button>
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
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center text-muted py-4">Loading books...</td>
                </tr>
              ) : filteredBooks.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center text-muted py-4">No books found.</td>
                </tr>
              ) : (
                filteredBooks.map((book) => {
                  const copies = copyCounts[String(book.id)] || 0
                  return (
                    <tr key={book.id}>
                      <td>
                        <div className="library-catalogue-title">{book.title || 'Untitled'}</div>
                      </td>
                      <td>{book.shelf_code || '-'}</td>
                      <td>{book.author || 'Unknown'}</td>
                      <td>{book.published_year || '-'}</td>
                      <td>
                        <span className="library-catalogue-count">{copies}</span>
                      </td>
                      <td className="text-end">
                        <div className="library-catalogue-actions">
                          <button
                            type="button"
                            className="library-action-button library-action-button--edit"
                            onClick={() => openEdit(book)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="library-action-button library-action-button--delete"
                            onClick={() => openDeleteModal(book)}
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
    </div>
  )
}
