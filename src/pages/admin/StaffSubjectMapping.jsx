import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../supabaseClient'
import AdShellAdmin from '../../components/AdShellAdmin'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import './AdminContent.css'

export default function StaffSubjectMapping() {
  const [sections, setSections] = useState([])
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [staff, setStaff] = useState([])

  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedClassName, setSelectedClassName] = useState('')
  const [selectedSectionId, setSelectedSectionId] = useState('')
  const [selectedSectionCode, setSelectedSectionCode] = useState('')
  const [selectedTerm, setSelectedTerm] = useState('')

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    if (selectedClassName) {
      fetchSections(selectedClassName)
    } else {
      setSections([])
      setSelectedSectionId('')
      setSelectedSectionCode('')
    }
  }, [selectedClassName])

  useEffect(() => {
    if (selectedSectionCode && selectedTerm) {
      fetchSubjectsAndMappings()
    } else {
      setSubjects([])
    }
  }, [selectedSectionCode, selectedTerm, selectedClassId, selectedSectionId])

  const fetchInitialData = async () => {
    try {
      setLoading(true)
      const [{ data: classRows, error: classError }, { data: staffRows, error: staffError }] = await Promise.all([
        supabase.from('groups').select('group_id, group_name').order('group_name'),
        supabase.from('staff').select('id, full_name, staff_id').eq('status', 'ACTIVE').order('full_name')
      ])

      if (classError) throw classError
      if (staffError) throw staffError

      setClasses(classRows || [])
      setStaff(staffRows || [])
    } catch (error) {
      console.error('Error fetching initial data', error)
      toast.error('Failed to load initial data')
    } finally {
      setLoading(false)
    }
  }

  const fetchSections = async (className) => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('course_id, course_code, course_name, group_name')
        .eq('group_name', className)
        .order('course_code')
      if (error) throw error
      setSections(data || [])
    } catch (error) {
      console.error('Error fetching sections', error)
      toast.error('Unable to load sections')
    }
  }

  const fetchSubjectsAndMappings = async () => {
    try {
      setLoading(true)

      const { data: subjectData, error: subjectError } = await supabase
        .from('subjects')
        .select('subject_id, subject_name, subject_code, subject_type, course_name, semester_number')
        .eq('course_name', selectedSectionCode)
        .eq('semester_number', Number(selectedTerm))
        .order('subject_name')

      if (subjectError) throw subjectError

      if (!subjectData || subjectData.length === 0) {
        setSubjects([])
        return
      }

      const { data: mappingData, error: mappingError } = await supabase
        .from('class_subjects')
        .select('subject_id, staff_id')
        .eq('class_id', Number(selectedClassId))
        .eq('section_id', Number(selectedSectionId))
        .eq('term', Number(selectedTerm))

      if (mappingError) throw mappingError

      const mappingMap = new Map()
      ;(mappingData || []).forEach((row) => {
        mappingMap.set(row.subject_id, row.staff_id)
      })

      setSubjects(
        subjectData.map((sub, index) => ({
          ...sub,
          staff_id: mappingMap.get(sub.subject_id) || '',
          sNo: index + 1,
        }))
      )
    } catch (error) {
      console.error('Error fetching subjects/mappings', error)
      toast.error('Failed to load subjects and mappings')
    } finally {
      setLoading(false)
    }
  }

  const handleStaffAssignment = (subjectId, staffId) => {
    setSubjects((prev) =>
      prev.map((sub) =>
        sub.subject_id === subjectId ? { ...sub, staff_id: staffId } : sub
      )
    )
  }

  const saveAssignments = async () => {
    if (!selectedClassId || !selectedSectionId || !selectedTerm) {
      toast.error('Please select class, section and term first')
      return
    }

    try {
      setSaving(true)

      const { error: deleteError } = await supabase
        .from('class_subjects')
        .delete()
        .eq('class_id', Number(selectedClassId))
        .eq('section_id', Number(selectedSectionId))
        .eq('term', Number(selectedTerm))

      if (deleteError) throw deleteError

      const rows = subjects
        .filter((sub) => sub.staff_id)
        .map((sub) => ({
          class_id: Number(selectedClassId),
          section_id: Number(selectedSectionId),
          term: Number(selectedTerm),
          subject_id: sub.subject_id,
          staff_id: sub.staff_id,
        }))

      if (rows.length > 0) {
        const { error: insertError } = await supabase
          .from('class_subjects')
          .insert(rows)
        if (insertError) throw insertError
      }

      toast.success('Class subject mapping saved successfully')
    } catch (error) {
      console.error('Error saving assignments', error)
      toast.error(`Failed to save assignments: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const selectedClassOptions = useMemo(() => classes, [classes])

  return (
    <AdShellAdmin
      brandTitle="ADMIN PORTAL"
      footerTitle="Admin Management Studio"
      footerSubtitle="Crafted for Vijayam College"
    >
      <div className="desktop-container">
        <h4 className="mb-4">Subject Mapping for Staff</h4>

        <div className="card card-soft p-4 mb-4">
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label fw-semibold">Class</label>
              <select
                className="form-select"
                value={selectedClassId}
                onChange={(e) => {
                  const selectedId = e.target.value
                  const selected = classes.find((row) => String(row.group_id) === String(selectedId))
                  setSelectedClassId(selectedId)
                  setSelectedClassName(selected?.group_name || '')
                  setSelectedSectionId('')
                  setSelectedSectionCode('')
                }}
              >
                <option value="">Select Class</option>
                {selectedClassOptions.map((row) => (
                  <option key={row.group_id} value={row.group_id}>{row.group_name}</option>
                ))}
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label fw-semibold">Section</label>
              <select
                className="form-select"
                value={selectedSectionId}
                onChange={(e) => {
                  const selectedId = e.target.value
                  const selected = sections.find((row) => String(row.course_id) === String(selectedId))
                  setSelectedSectionId(selectedId)
                  setSelectedSectionCode(selected?.course_code || '')
                }}
                disabled={!selectedClassId}
              >
                <option value="">Select Section</option>
                {sections.map((row) => (
                  <option key={row.course_id} value={row.course_id}>{row.course_name || row.course_code}</option>
                ))}
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label fw-semibold">Term</label>
              <select
                className="form-select"
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
                disabled={!selectedSectionId}
              >
                <option value="">Select Term</option>
                {[1, 2, 3].map((term) => (
                  <option key={term} value={term}>Term {term}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {subjects.length > 0 ? (
          <div className="card card-soft p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h5 className="mb-0">Subject List</h5>
              <button className="btn btn-primary" onClick={saveAssignments} disabled={saving}>
                {saving ? 'Saving...' : 'Click to Save'}
              </button>
            </div>

            <div className="table-responsive">
              <table className="table table-hover align-middle staff-subject-mapping-table">
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>Subject</th>
                    <th>Type</th>
                    <th>Assigned Staff</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((subject) => (
                    <tr key={subject.subject_id}>
                      <td className="fw-bold text-dark">{subject.sNo}</td>
                      <td className="fw-bold text-dark">{subject.subject_code} - {subject.subject_name}</td>
                      <td>
                        <span className="badge bg-light text-dark border text-capitalize">{subject.subject_type || 'core'}</span>
                      </td>
                      <td>
                        <select
                          className="form-select"
                          value={subject.staff_id || ''}
                          onChange={(e) => handleStaffAssignment(subject.subject_id, e.target.value)}
                        >
                          <option value="">Select Staff</option>
                          {staff.map((row) => (
                            <option key={row.id} value={row.id}>{row.full_name} ({row.staff_id})</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center p-5 text-muted">
            {selectedTerm ? (loading ? 'Loading...' : 'No subjects found for selection.') : 'Please select all filters to view subjects.'}
          </div>
        )}
      </div>
      <ToastContainer position="top-right" autoClose={3000} />
    </AdShellAdmin>
  )
}
