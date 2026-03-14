import AdShellAdmin from '../../components/AdShellAdmin'
import { useEffect, useState } from 'react'
import { supabase } from '../../../supabaseClient'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import './Setup.css'
import './AdminContent.css'
import ConfirmationModal from '../../components/ConfirmationModal'

export default function ClassTimeTableCreation() {
  const [sessionName, setSessionName] = useState('')
  const [academicYear, setAcademicYear] = useState('')
  const [term, setTerm] = useState('')
  const [sessions, setSessions] = useState([])
  const [academicYears, setAcademicYears] = useState([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const [deleteConfirmation, setDeleteConfirmation] = useState({
    show: false,
    id: null,
    message: ''
  })

  useEffect(() => {
    fetchSessions()
    fetchAcademicYears()
  }, [])

  const fetchAcademicYears = async () => {
    try {
      const { data, error } = await supabase
        .from('academic_years')
        .select('id, year_name')
        .order('year_name', { ascending: true })
      if (error) throw error
      setAcademicYears(data || [])
    } catch (error) {
      console.error('Error fetching academic years:', error)
      toast.error('Failed to load academic years')
    }
  }

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('timetable_sessions')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setSessions(data || [])
    } catch (error) {
      console.error('Error fetching time table sessions:', error)
      toast.error('Failed to load time table sessions')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!sessionName.trim() || !academicYear || !term) {
      toast.warning('Enter session name, academic year and term')
      return
    }

    setLoading(true)
    try {
      if (editingId) {
        const { error } = await supabase
          .from('timetable_sessions')
          .update({
            session_name: sessionName,
            academic_year: academicYear,
            term: Number(term)
          })
          .eq('id', editingId)

        if (error) throw error
        toast.success('Time table session updated successfully')
      } else {
        const { error } = await supabase
          .from('timetable_sessions')
          .insert([{
            session_name: sessionName,
            academic_year: academicYear,
            term: Number(term),
            is_active: true
          }])

        if (error) throw error
        toast.success('Time table session created successfully')
      }

      setSessionName('')
      setAcademicYear('')
      setTerm('')
      setEditingId(null)
      fetchSessions()
    } catch (error) {
      console.error('Error saving time table session:', error)
      toast.error('Failed to save time table session')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (session) => {
    setSessionName(session.session_name || '')
    setAcademicYear(session.academic_year || '')
    setTerm(String(session.term || ''))
    setEditingId(session.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const confirmDelete = async () => {
    if (!deleteConfirmation.id) return

    try {
      const { error } = await supabase
        .from('timetable_sessions')
        .delete()
        .eq('id', deleteConfirmation.id)

      if (error) throw error
      toast.success('Time table session deleted')
      fetchSessions()
    } catch (error) {
      console.error('Error deleting time table session:', error)
      toast.error('Failed to delete time table session')
    }

    closeDeleteModal()
  }

  const closeDeleteModal = () => {
    setDeleteConfirmation({ show: false, id: null, message: '' })
  }

  const handleDelete = (id) => {
    setDeleteConfirmation({
      show: true,
      id,
      message: 'Are you sure you want to delete this time table session?'
    })
  }

  const handleReset = () => {
    setSessionName('')
    setAcademicYear('')
    setTerm('')
    setEditingId(null)
  }

  return (
    <AdShellAdmin
      brandTitle="ADMIN PORTAL"
      footerTitle="Admin Management Studio"
      footerSubtitle="Crafted for Vijayam College"
    >
      <div className="desktop-container" style={{ overflowX: 'hidden' }}>
        <h4 className="mb-4">Class Time Table Session Creation</h4>

        <div className="row g-4 justify-content-center mx-0">
          <div className="col-12">
            <div className="card card-soft p-4">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                <div>
                  <h4 className="mb-1">Time Table Sessions</h4>
                  <p className="mb-0">Create and manage timetable sessions for all 3 terms.</p>
                </div>
                <button type="button" className="btn btn-outline-secondary" onClick={handleReset}>Reset</button>
              </div>

              <form className="row g-3" onSubmit={handleSubmit}>
                <div className="col-md-5">
                  <label className="form-label">Session Name <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter session name"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    required
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Academic Year <span className="text-danger">*</span></label>
                  <select className="form-select" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} required>
                    <option value="">Select Academic Year</option>
                    {academicYears.map((row) => (
                      <option key={row.id} value={row.year_name}>{row.year_name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Term <span className="text-danger">*</span></label>
                  <select className="form-select" value={term} onChange={(e) => setTerm(e.target.value)} required>
                    <option value="">Select Term</option>
                    {[1, 2, 3].map((item) => (
                      <option key={item} value={item}>Term {item}</option>
                    ))}
                  </select>
                </div>
                <div className="col-12 d-flex justify-content-end">
                  <button type="submit" className="btn btn-primary" disabled={loading || !sessionName || !academicYear || !term}>
                    {loading ? 'Saving...' : (editingId ? 'Update Session' : 'Create Session')}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {sessions.length > 0 && (
            <div className="col-12">
              <div className="card card-soft p-4">
                <h4 className="mb-3">Saved Time Table Sessions</h4>
                <div className="table-responsive">
                  <table className="table table-hover align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>Session Name</th>
                        <th>Academic Year</th>
                        <th>Term</th>
                        <th>Created At</th>
                        <th className="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((session) => (
                        <tr key={session.id}>
                          <td className="fw-bold">{session.session_name}</td>
                          <td>{session.academic_year}</td>
                          <td>Term {session.term}</td>
                          <td>{new Date(session.created_at).toLocaleDateString('en-GB')}</td>
                          <td className="text-end">
                            <div className="d-flex justify-content-end gap-2">
                              <button className="btn btn-sm btn-outline-primary" onClick={() => handleEdit(session)}>
                                <i className="bi bi-pencil"></i>
                              </button>
                              <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(session.id)}>
                                <i className="bi bi-trash"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ToastContainer position="top-right" autoClose={3000} />
      <ConfirmationModal
        isOpen={deleteConfirmation.show}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        title="Confirm Delete"
        message={deleteConfirmation.message}
        confirmText="Confirm Delete"
        cancelText="Cancel"
      />
    </AdShellAdmin>
  )
}
