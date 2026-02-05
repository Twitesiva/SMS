import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../supabaseClient'
import StudentShell from '../../components/StudentShell'
import { useStudentAuth } from '../../store/studentAuth'
import './Student.css'
import { resolveStudentCourseGroup } from '../../lib/resolveStudentCourseGroup'

const formatDate = (dateString) => {
  if (!dateString) return '-'
  const parsed = new Date(dateString)
  if (Number.isNaN(parsed.getTime())) return dateString
  return parsed
    .toLocaleDateString('en-GB')
    .replace(/ /g, '-')
}

const toRoman = (value) => {
  const map = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']
  const num = Number(value)
  if (!Number.isNaN(num) && map[num - 1]) return map[num - 1]
  return value || '-'
}

const formatSemester = (value) => {
  const roman = toRoman(value)
  if (roman === '-') return '-'
  return `${roman} SEMESTER`
}

const buildRows = (details) => ({
  general: [
    { label: 'Student Name', value: details.full_name },
    { label: 'Register No.', value: details.register_no || details.hall_ticket_no },
    { label: 'Institution', value: details.institution || 'Vijayam Arts & Science College' },
    { label: 'Program', value: details.program || details.course_display || details.course_name || details.course },
    { label: 'Batch', value: details.batch || details.admission_year || details.academic_year },
    { label: 'Semester', value: formatSemester(details.current_semester || details.semester) },
  ],
  personal: [
    { label: 'Date of Birth', value: formatDate(details.date_of_birth || details.dob) },
    { label: 'Gender', value: details.gender },
    { label: 'Nationality', value: details.nationality },
  ],
  parent: [
    { label: 'Father Name', value: details.father_name },
    { label: 'Mother Name', value: details.mother_name },
    { label: 'Parent Contact No.', value: details.parent_no || details.Parent_no || details.parent_phone || '-' },
  ],
  address: [
    { label: 'Address', value: details.address },
    { label: 'Pincode', value: details.pincode || details.postal_code },
    { label: 'State', value: details.state },
    { label: 'Student Mobile No.', value: details.phone_number },
  ],
})

const normalizeValue = (value) => {
  if (value === undefined || value === null || value === '') return '-'
  return value
}

export default function StudentPersonalDetails() {
  const { student } = useStudentAuth()
  const [details, setDetails] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadDetails = async () => {
      if (!student?.id && !student?.student_id) return
      setLoading(true)
      setError('')
      try {
        let query = supabase.from('students').select('*')
        if (student?.id) {
          query = query.eq('id', student.id)
        } else {
          query = query.eq('student_id', student.student_id)
        }
        const { data, error: fetchError } = await query.maybeSingle()
        if (fetchError) throw fetchError
        const resolved = await resolveStudentCourseGroup(supabase, data || {})
        setDetails(resolved || {})
      } catch (err) {
        console.error(err)
        setError(err?.message || 'Unable to load student details.')
      } finally {
        setLoading(false)
      }
    }

    loadDetails()
  }, [student?.id, student?.student_id])

  const sections = useMemo(() => buildRows(details || {}), [details])

  return (
    <StudentShell>
      <div className="student-details">
        <div className="student-details__header">
          <h2>Personal Details</h2>
        </div>

        {loading && (
          <div className="student-details__loading" role="status" aria-live="polite">
            <div className="student-details__loading-header">
              <div className="student-loader__spinner" aria-hidden="true"></div>
              <div>
                <div className="student-loader__title">Loading personal details</div>
                <div className="student-loader__subtitle">Fetching your profile and academic info.</div>
              </div>
            </div>
            <div className="student-details__loading-grid" aria-hidden="true">
              {Array.from({ length: 4 }).map((_, index) => (
                <div className="student-loader-card" key={`loader-card-${index}`}>
                  <div className="student-loader-card__header student-loader__shimmer"></div>
                  <div className="student-loader-card__line student-loader__shimmer"></div>
                  <div className="student-loader-card__line student-loader__shimmer"></div>
                  <div className="student-loader-card__line student-loader__shimmer"></div>
                  <div className="student-loader-card__line student-loader__shimmer"></div>
                </div>
              ))}
            </div>
            <span className="sr-only">Loading details...</span>
          </div>
        )}
        {error && !loading && <div className="student-details__status student-details__status--error">{error}</div>}

        {!loading && !error && (
          <div className="student-details__grid">
            <div className="student-card">
              <div className="student-card__header">General Details</div>
              <div className="student-card__body">
                <div className="student-detail-list">
                  {sections.general.map((row) => (
                    <div className="student-detail-row" key={row.label}>
                      <div className="student-detail-label">{row.label}</div>
                      <div className="student-detail-colon">:</div>
                      <div className="student-detail-value">
                        {normalizeValue(row.value)}
                        {row.status && <span className="student-detail-status">[{row.status}]</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="student-card">
              <div className="student-card__header">Personal Details</div>
              <div className="student-card__body">
                <div className="student-detail-list">
                  {sections.personal.map((row) => (
                    <div className="student-detail-row" key={row.label}>
                      <div className="student-detail-label">{row.label}</div>
                      <div className="student-detail-colon">:</div>
                      <div className="student-detail-value">{normalizeValue(row.value)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="student-card">
              <div className="student-card__header">Parent Details</div>
              <div className="student-card__body">
                <div className="student-detail-list">
                  {sections.parent.map((row) => (
                    <div className="student-detail-row" key={row.label}>
                      <div className="student-detail-label">{row.label}</div>
                      <div className="student-detail-colon">:</div>
                      <div className="student-detail-value">{normalizeValue(row.value)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="student-card">
              <div className="student-card__header">Address for communication</div>
              <div className="student-card__body">
                <div className="student-detail-list">
                  {sections.address.map((row) => (
                    <div className="student-detail-row" key={row.label}>
                      <div className="student-detail-label">{row.label}</div>
                      <div className="student-detail-colon">:</div>
                      <div className="student-detail-value">{normalizeValue(row.value)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </StudentShell>
  )
}

