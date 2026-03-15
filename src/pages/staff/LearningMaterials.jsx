import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import StaffShell from '../../components/StaffShell'
import { supabase } from '../../../supabaseClient'
import { useStaffAuth } from '../../store/staffAuth'
import { showToast } from '../../store/ui'
import './StaffPortal.css'


export default function LearningMaterials() {
  const { staff } = useStaffAuth()

  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [uploadedMaterials, setUploadedMaterials] = useState({}) // Stores materials per subject
  const [deleteModal, setDeleteModal] = useState({ show: false, materialId: null, subjectId: null, isDeleting: false })

  const [uploadSubjectId, setUploadSubjectId] = useState('')
  const [uploadFile, setUploadFile] = useState(null)
  const [isGlobalUploading, setIsGlobalUploading] = useState(false)

  useEffect(() => {
    if (staff?.id) fetchStaffSubjects()
  }, [staff])

  // Helper to convert file to Base64
  const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = error => reject(error)
    reader.readAsDataURL(file)
  })

  // Fetch materials for a specific subject (using one of its mapping IDs)
  // We can just fetch by subject_id really, but to be precise with mapping:
  // Actually, simpler is to just fetch by subject_id + teacher_id
  const fetchMaterialsForSubject = async (subjectId) => {
    try {
      const { data, error } = await supabase
        .from('learning_materials')
        .select(`
                id,
                file_url,
                created_at,
                teacher_subject_mapping!inner(subject_id)
            `)
        .eq('teacher_subject_mapping.subject_id', subjectId)
        .eq('created_by', staff.id) // Filter by creator
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching materials:', error)
        return
      }

      // Group by created_at or just show recent?
      // Let's just store the list
      setUploadedMaterials(prev => ({ ...prev, [subjectId]: data || [] }))

    } catch (err) {
      console.error(err)
    }
  }

  const fetchStaffSubjects = async () => {
    try {
      setLoading(true)
      setError('')

      // 1️⃣ Fetch mappings WITH ID
      const { data: mappings, error: mapError } = await supabase
        .from('teacher_subject_mapping')
        .select('id, subject_id, course_id, group_id, semester')
        .eq('teacher_id', staff.id)
        .eq('is_active', true)

      if (mapError) throw mapError
      if (!mappings || mappings.length === 0) {
        setSubjects([])
        return
      }

      // Collect IDs
      const subjectIds = [...new Set(mappings.map(m => m.subject_id))]
      const courseIds = [...new Set(mappings.map(m => m.course_id))]
      const groupIds = [...new Set(mappings.map(m => m.group_id))]

      // 2️⃣ Fetch names
      const [{ data: subjects }, { data: courses }, { data: groups }] =
        await Promise.all([
          supabase.from('subjects').select('subject_id, subject_name, subject_code').in('subject_id', subjectIds),
supabase.from('sections').select('id as course_id, section_name as course_name').in('id', courseIds),
supabase.from('classes').select('id as group_id, class_name as group_name').in('id', groupIds)
        ])

      // 3️⃣ Merge everything
      const merged = mappings.map(m => ({
        id: m.id, // Mapping ID
        subject_id: m.subject_id,
        subject: subjects.find(s => s.subject_id === m.subject_id)?.subject_name,
        code: subjects.find(s => s.subject_id === m.subject_id)?.subject_code,
        course: courses.find(c => c.course_id === m.course_id)?.course_name,
        group: groups.find(g => g.group_id === m.group_id)?.group_name,
        semester: m.semester
      }))

      // Filter duplicates based on subject name
      // BUT we need to store ALL mapping IDs for the subject to upload to all classes
      const subjectMap = new Map()

      merged.forEach(item => {
        if (item.subject) {
          if (!subjectMap.has(item.subject)) {
            subjectMap.set(item.subject, {
              ...item,
              mapping_ids: [item.id]
            })
          } else {
            const existing = subjectMap.get(item.subject)
            existing.mapping_ids.push(item.id)
          }
        }
      })

      const uniqueSubjects = Array.from(subjectMap.values())
      setSubjects(uniqueSubjects)

      // Fetch existing materials for these subjects
      // We'll do a simple loop for now or could do one big query
      // For simplicity/correctness with current UI:
      // We will actually just load them when user expands or just load all?
      // Let's load all for now as the list isn't huge likely

      // Actually, better to fetch ALL materials for this teacher and filter in UI?
      // Or just fetch per subject.
      // Let's try fetching materials for all subjects displayed
      const allMappingIds = merged.map(m => m.id)
      const { data: materials } = await supabase
        .from('learning_materials')
        .select('id, file_url, created_at, teacher_subject_mapping_id')
        .in('teacher_subject_mapping_id', allMappingIds)
        .order('created_at', { ascending: false })

      if (materials) {
        const matMap = {}
        // We need to map back to subject_id
        materials.forEach(mat => {
          // Find which subject this mapping belongs to
          const mapping = merged.find(m => m.id === mat.teacher_subject_mapping_id)
          if (mapping) {
            if (!matMap[mapping.subject_id]) matMap[mapping.subject_id] = []
            // Avoid duplicates if multiple mappings point to same file (conceptually)
            // But here they are distinct rows.
            // Let's just show distinct files by URL to avoid clutter
            const exists = matMap[mapping.subject_id].find(m => m.file_url === mat.file_url)
            if (!exists) {
              matMap[mapping.subject_id].push(mat)
            }
          }
        })
        setUploadedMaterials(matMap)
      }

    } catch (err) {
      console.error(err)
      setError('Failed to load assigned subjects')
    } finally {
      setLoading(false)
    }
  }

  const handleGlobalFileChange = (e) => {
    const file = e.target.files[0]
    if (file && file.type !== 'application/pdf') {
      showToast('Only PDF files are allowed', { type: 'danger' })
      e.target.value = null // Reset input
      return
    }
    setUploadFile(file)
  }

  const handleGlobalUpload = async () => {
    if (!uploadSubjectId) {
      showToast('Please select a subject', { type: 'warning' })
      return
    }
    if (!uploadFile) {
      showToast('Please select a PDF file', { type: 'warning' })
      return
    }

    const subject = subjects.find(s => String(s.subject_id) === String(uploadSubjectId))
    if (!subject) {
      showToast('Invalid subject selected', { type: 'danger' })
      return
    }

    try {
      setIsGlobalUploading(true)

      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) throw new Error('User not authenticated')

      let fileUrl = null

      // 1. Try Upload to Storage
      try {
        const BUCKET_NAME = 'documents' // Using 'documents' bucket
        const sanitizedName = uploadFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')
        const fileName = `learning-materials/${subject.subject_id}/${Date.now()}_${sanitizedName}`

        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(fileName, uploadFile)

        if (uploadError) throw uploadError

        const { data: publicURLData } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(fileName)

        fileUrl = publicURLData.publicUrl

      } catch (storageErr) {
        console.warn('Storage upload failed, falling back to Base64:', storageErr)
        fileUrl = await fileToDataUrl(uploadFile)
        showToast('Storage unconfigured. Saving file directly to database.', { type: 'info' })
      }

      if (!fileUrl) throw new Error('Failed to process file.')

      // 2. Insert into DB for EACH mapping ID associated with this subject
      if (!subject.mapping_ids || subject.mapping_ids.length === 0) {
        throw new Error('No valid classes found for this subject.')
      }

      const insertPayload = subject.mapping_ids.map(mappingId => ({
        teacher_subject_mapping_id: mappingId,
        file_url: fileUrl,
        created_by: userData.user.id
      }))

      const { error: insertError } = await supabase
        .from('learning_materials')
        .insert(insertPayload) // Insert simplified payload used in previous step
        .select() // Return data so we can update UI

      if (insertError) throw insertError

      showToast(`Material uploaded successfully!`, { type: 'success' })

      // Update local state to show new file immediately
      setUploadedMaterials(prev => {
        const newMat = {
          id: Date.now(), // Temp ID until refresh
          file_url: fileUrl,
          created_at: new Date().toISOString()
        }
        const existing = prev[subject.subject_id] || []
        return { ...prev, [subject.subject_id]: [newMat, ...existing] }
      })

      // Reset Form
      setUploadFile(null)
      // We purposefully don't reset subject ID so they can upload multiple if they want
      // But we should clear the file input.
      // Since it's uncontrolled in part, we might need a ref or key.

    } catch (err) {
      console.error(err)
      showToast(err.message || 'Upload failed', { type: 'danger' })
    } finally {
      setIsGlobalUploading(false)
    }
  }

  const handleDelete = (materialId, subjectId) => {
    setDeleteModal({ show: true, materialId, subjectId, isDeleting: false })
  }

  const confirmDelete = async () => {
    const { materialId, subjectId } = deleteModal
    if (!materialId) return

    try {
      setDeleteModal(prev => ({ ...prev, isDeleting: true }))

      const { error } = await supabase
        .from('learning_materials')
        .delete()
        .eq('id', materialId)

      if (error) throw error

      showToast('Material deleted', { type: 'success' })
      setUploadedMaterials(prev => ({
        ...prev,
        [subjectId]: prev[subjectId].filter(m => m.id !== materialId)
      }))

      // Close modal
      setDeleteModal({ show: false, materialId: null, subjectId: null, isDeleting: false })

    } catch (err) {
      console.error(err)
      showToast('Failed to delete material', { type: 'danger' })
      setDeleteModal(prev => ({ ...prev, isDeleting: false }))
    }
  }



  const handleViewFile = (url) => {
    if (!url) {
      showToast('Invalid file URL', { type: 'danger' })
      return
    }

    // Check if it's a Base64 string
    if (url.startsWith('data:')) {
      const win = window.open()
      if (win) {
        win.document.write(
          `
                <html>
                  <head>
                    <title>View Material</title>
                    <style>
                      body, html { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; }
                      iframe { width: 100%; height: 100%; border: none; }
                    </style>
                  </head>
                  <body>
                    <iframe src="${url}" allowfullscreen></iframe>
                  </body>
                </html>
                `
        )
      } else {
        showToast('Please allow popups to view this file', { type: 'warning' })
      }
    } else {
      // Normal URL
      window.open(url, '_blank')
    }
  }

  return (
    <StaffShell title="Learning Materials">

      <div className="students-section-shell">
        {/* 1. UPLOAD CONTAINER */}
        <div className="student-card mb-4">
          <div className="student-card__header">Upload New Material</div>
          <div className="student-card__body">
            <div className="row g-3 align-items-end">
              <div className="col-md-4">
                <label className="form-label small fw-bold text-muted">Select Subject</label>
                <select
                  className="form-select"
                  value={uploadSubjectId}
                  onChange={(e) => setUploadSubjectId(e.target.value)}
                >
                  <option value="">-- Choose Subject --</option>
                  {subjects.map(s => (
                    <option key={s.subject_id} value={s.subject_id}>
                      {s.subject} ({s.code})
                    </option>
                  ))}
                </select>
                {uploadSubjectId && uploadedMaterials[uploadSubjectId] && uploadedMaterials[uploadSubjectId].length > 0 && (
                  <div className="text-danger small mt-1 fw-bold">
                    <i className="bi bi-exclamation-circle me-1"></i>
                    Already uploaded materials for this subject.
                  </div>
                )}
              </div>
              <div className="col-md-5">
                <label className="form-label small fw-bold text-muted">Upload PDF</label>
                <input
                  key={uploadFile ? 'file-selected' : 'file-empty'} /* Reset on null */
                  type="file"
                  className="form-control"
                  accept="application/pdf"
                  onChange={handleGlobalFileChange}
                  disabled={uploadSubjectId && uploadedMaterials[uploadSubjectId] && uploadedMaterials[uploadSubjectId].length > 0}
                />
              </div>
              <div className="col-md-3">
                <button
                  className="btn btn-primary w-100"
                  onClick={handleGlobalUpload}
                  disabled={isGlobalUploading || !uploadSubjectId || !uploadFile || (uploadSubjectId && uploadedMaterials[uploadSubjectId] && uploadedMaterials[uploadSubjectId].length > 0)}
                >
                  {isGlobalUploading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Uploading...
                    </>
                  ) : (
                    <>Upload <i className="bi bi-upload ms-1"></i></>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 2. ASSIGNED SUBJECTS CONTAINER */}
        <div className="student-card">
          <div className="student-card__header">
            Assigned Subjects
          </div>
          <div className="student-card__body">


            {/* ASSIGNED SUBJECTS LIST */}
            <div className="mb-4">

              {loading && (
                <div className="student-details__loading" role="status" aria-live="polite">
                  <div className="student-details__loading-header">
                    <div className="student-loader__spinner" aria-hidden="true"></div>
                    <div>
                      <div className="student-loader__title">Loading learning materials</div>
                      <div className="student-loader__subtitle">Preparing your subjects and resources.</div>
                    </div>
                  </div>
                  <div className="student-details__loading-grid" aria-hidden="true">
                    <div className="student-loader-card">
                      <div className="student-loader-card__header student-loader__shimmer"></div>
                      <div className="student-loader-card__line student-loader__shimmer"></div>
                      <div className="student-loader-card__line student-loader__shimmer"></div>
                    </div>
                  </div>
                  <span className="sr-only">Loading materials...</span>
                </div>
              )}
              {error && <div className="text-danger">{error}</div>}

              {!loading && subjects.length > 0 && (
                <div className="d-flex flex-column gap-4">
                  {subjects.map((s) => (
                    <div
                      key={s.subject_id} // Use subject_id as key
                      className="p-0"
                    >
                      {/* UPLOADED MATERIALS LIST - ALWAYS SHOW TABLE HEADER IF NO FILES? Or show message? */}
                      {/* Let's show table if files exist, otherwise simplified 'No files' */}

                      {uploadedMaterials[s.subject_id] && uploadedMaterials[s.subject_id].length > 0 ? (
                        <div className="table-responsive border rounded">
                          <table className="table table-bordered table-striped align-middle mb-0 staff-learning-materials-table">
                            <thead className="table-light text-uppercase small fw-bold text-secondary">
                              <tr>
                                <th className="text-center" style={{ width: '60px' }}>S.No</th>
                                <th>Subject Name</th>
                                <th>Upload Date</th>
                                <th className="text-center" style={{ width: '220px' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {uploadedMaterials[s.subject_id].map((mat, idx) => (
                                <tr key={mat.id || idx}>
                                  <td className="text-center fw-medium text-secondary">{idx + 1}</td>
                                  <td className="fw-medium text-dark">{s.subject}</td>
                                  <td>
                                    <span className="fw-medium text-dark">
                                      {new Date(mat.created_at).toLocaleDateString('en-GB')}
                                    </span>
                                    <span className="text-muted small ms-2 ps-2">
                                      {new Date(mat.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </td>
                                  <td className="text-center">
                                    <div className="d-flex justify-content-center gap-2">
                                      <button
                                        onClick={() => handleViewFile(mat.file_url)}
                                        className="btn btn-sm btn-primary px-3"
                                        title="View"
                                      >
                                        View
                                      </button>
                                      <button
                                        className="btn btn-sm btn-outline-danger px-3"
                                        onClick={() => handleDelete(mat.id, s.subject_id)}
                                        title="Delete"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-muted fst-italic small p-2 bg-light rounded border">
                          No materials uploaded yet.
                        </div>
                      )}

                    </div>
                  ))}
                </div>
              )}

              {!loading && subjects.length === 0 && (
                <div className="alert alert-info">No subjects assigned.</div>
              )}
            </div> {/* Close mb-4 wrapper inside body */}
          </div> {/* Close student-card__body */}
        </div> {/* Close student-card */}
      </div> {/* Close students-section-shell */}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteModal.show && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1" role="dialog">
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">Confirm Deletion</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setDeleteModal({ show: false, materialId: null, subjectId: null, isDeleting: false })}
                  disabled={deleteModal.isDeleting}
                ></button>
              </div>
              <div className="modal-body">
                <p className="mb-0">Are you sure you want to delete this material? This action cannot be undone.</p>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-light border"
                  onClick={() => setDeleteModal({ show: false, materialId: null, subjectId: null, isDeleting: false })}
                  disabled={deleteModal.isDeleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={confirmDelete}
                  disabled={deleteModal.isDeleting}
                >
                  {deleteModal.isDeleting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </StaffShell>
  )
}

