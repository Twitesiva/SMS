import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import StaffShell from '../../components/StaffShell'
import { supabase } from '../../../supabaseClient'
import { useStaffAuth } from '../../store/staffAuth'

export default function LearningMaterials() {
  const { staff } = useStaffAuth()

  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (staff?.id) fetchStaffSubjects()
  }, [staff])

const fetchStaffSubjects = async () => {
  try {
    setLoading(true)
    setError('')

    // 1️⃣ Fetch mappings
    const { data: mappings, error: mapError } = await supabase
      .from('teacher_subject_mapping')
      .select('subject_id, course_id, group_id, semester')
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
    const groupIds  = [...new Set(mappings.map(m => m.group_id))]

    // 2️⃣ Fetch names
    const [{ data: subjects }, { data: courses }, { data: groups }] =
      await Promise.all([
        supabase.from('subjects').select('subject_id, subject_name').in('subject_id', subjectIds),
        supabase.from('courses').select('course_id, course_name').in('course_id', courseIds),
        supabase.from('groups').select('group_id, group_name').in('group_id', groupIds)
      ])

    // 3️⃣ Merge everything
    const merged = mappings.map(m => ({
      subject: subjects.find(s => s.subject_id === m.subject_id)?.subject_name,
      course:  courses.find(c => c.course_id === m.course_id)?.course_name,
      group:   groups.find(g => g.group_id === m.group_id)?.group_name,
      semester: m.semester
    }))

    setSubjects(merged)
  } catch (err) {
    console.error(err)
    setError('Failed to load assigned subjects')
  } finally {
    setLoading(false)
  }
}


  return (
    <StaffShell title="Learning Materials">
      <div className="card card-soft p-4">

        {/* HEADER */}
        <h3 className="fw-bold mb-1">LEARNING MATERIALS</h3>
        <p className="text-muted mb-3">
          Manage course-wise academic resources shared with students.
        </p>

        {/* ASSIGNED SUBJECTS (CLEAN) */}
<div className="mb-4">
  <h5 className="fw-semibold mb-2">Your Assigned Subjects</h5>

  {loading && <div className="text-muted">Loading…</div>}
  {error && <div className="text-danger">{error}</div>}

  {!loading && subjects.length > 0 && (
    <div className="d-flex flex-column gap-2">
      {subjects.map((s, idx) => (
        <div
          key={idx}
          className="px-3 py-2 border rounded bg-light"
          style={{ fontSize: '0.9rem' }}
        >
          <strong>{s.course}</strong>
          {' '}• {s.group}
          {' '}• <span className="text-primary fw-semibold">{s.subject}</span>
          {' '}• Sem {s.semester}
        </div>
      ))}
    </div>
  )}
</div>


        {/* UPLOAD MATERIALS */}
        <div className="card p-4 shadow-sm mb-4" style={{ borderLeft: '6px solid #0d6efd' }}>
          <h5 className="fw-semibold mb-2">Upload Materials</h5>
          <p className="text-muted mb-3">
            Add notes, presentations, videos, and reference links.
          </p>

          {/* FILE INPUT + UPLOAD BUTTON INLINE */}
          <div className="d-flex align-items-center gap-3">
            <input
              type="file"
              className="form-control"
              style={{ maxWidth: '320px' }}
            />

            <button className="btn btn-primary btn-sm px-4">
              Upload →
            </button>
          </div>
        </div>

        {/* ACTION ROW */}
        <div className="row g-4">

          {/* MANAGE MATERIALS */}
          <div className="col-md-6">
            <div className="card p-4 shadow-sm h-100" style={{ borderLeft: '6px solid #6c757d' }}>
              <h5 className="fw-semibold mb-2">Manage Materials</h5>
              <p className="text-muted">
                Edit, update, or control visibility of uploaded materials.
              </p>
              <div className="text-end mt-3">
                <Link
                  to="/staff/materials/manage"
                  className="btn btn-secondary btn-sm px-4"
                >
                  Manage →
                </Link>
              </div>
            </div>
          </div>

          {/* COMMENTS & FEEDBACK */}
          <div className="col-md-6">
            <div className="card p-4 shadow-sm h-100" style={{ borderLeft: '6px solid #198754' }}>
              <h5 className="fw-semibold mb-2">Comments & Feedback</h5>
              <p className="text-muted">
                View student questions and feedback on learning materials.
              </p>
              <div className="text-end mt-3">
                <Link
                  to="/staff/materials/feedback"
                  className="btn btn-success btn-sm px-4"
                >
                  View Feedback →
                </Link>
              </div>
            </div>
          </div>

          {/* INSIGHTS */}
          <div className="col-12">
            <div className="card p-4 shadow-sm" style={{ borderLeft: '6px solid #6610f2' }}>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="fw-semibold mb-1">Student Usage Insights</h5>
                  <p className="text-muted mb-0">
                    Track student engagement and material usage statistics.
                  </p>
                </div>
                <Link
                  to="/staff/materials/insights"
                  className="btn btn-outline-primary btn-sm px-4"
                >
                  View Insights →
                </Link>
              </div>
            </div>
          </div>

        </div>
      </div>
    </StaffShell>
  )
}
