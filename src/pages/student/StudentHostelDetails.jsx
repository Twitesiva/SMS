import { useEffect, useState } from 'react'
import { supabase } from '../../../supabaseClient'
import StudentShell from '../../components/StudentShell'
import { useStudentAuth } from '../../store/studentAuth'
import './Student.css'

const formatDateTime = (value) => {
  if (!value) return 'N/A'
  const date = new Date(value)
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const formatHostelFloor = (floorNo) => {
  const floor = Number(floorNo)
  if (!Number.isFinite(floor)) return 'N/A'
  if (floor === 0) return 'Ground Floor'
  if (floor === 1) return 'First Floor'
  if (floor === 2) return 'Second Floor'
  return `Floor ${floor}`
}

export default function StudentHostelDetails() {
  const { student } = useStudentAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [studentInfo, setStudentInfo] = useState(null)
  const [currentAllocation, setCurrentAllocation] = useState(null)

  useEffect(() => {
    if (!student?.id) {
      setError('Please sign in to view your hostel allocation.')
      setCurrentAllocation(null)
      return
    }

    const loadHostelDetails = async () => {
      setLoading(true)
      setError('')
      setWarning('')
      setCurrentAllocation(null)
      try {
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('id, student_id, full_name, academic_year, current_semester, year_of_study, is_hostel, hostel_ac')
          .eq('id', student.id)
          .maybeSingle()

        if (studentError) throw studentError
        if (!studentData) {
          setWarning('Student details not found.')
          setStudentInfo(null)
          return
        }

        setStudentInfo(studentData)

        if (!studentData.is_hostel) {
          setWarning('Hostel facility is not assigned to this student.')
          return
        }

        const { data: allocationData, error: allocationError } = await supabase
          .from('hostel_allocations')
          .select('academic_year, status, created_at, hostel_beds(bed_no, hostel_rooms(room_no, floor_no, room_type, hostel_blocks(block_name)))')
          .eq('student_id', student.id)
          .eq('status', 'ACTIVE')
          .maybeSingle()

        if (allocationError) throw allocationError
        setCurrentAllocation(allocationData || null)

      } catch (err) {
        console.error(err)
        setError(err?.message || 'Unable to load hostel allocation right now.')
        setCurrentAllocation(null)
      } finally {
        setLoading(false)
      }
    }

    loadHostelDetails()
  }, [student?.id])

  return (
    <StudentShell>
      <div className="students-section-shell">
        <div className="student-card mb-4">
          <div className="student-card__header">Hostel Allocation</div>
          <div className="student-card__body">
            <p className="students-section-copy mb-0">
              {studentInfo?.is_hostel
                ? 'Review your hostel allocation details.'
                : 'You are not currently registered as a hostel resident.'}
            </p>
          </div>
        </div>

        {studentInfo && (
          <div className="student-details__status mb-3">
            {studentInfo.is_hostel ? 'Hostel student' : 'Day scholar'}
          </div>
        )}

        {warning && !loading && !error && (
          <div className="student-details__status">{warning}</div>
        )}

        {loading && (
          <div className="student-details__loading" role="status" aria-live="polite">
            <div className="student-details__loading-header">
              <div className="student-loader__spinner" aria-hidden="true"></div>
              <div>
                <div className="student-loader__title">Loading hostel fees</div>
                <div className="student-loader__subtitle">Fetching hostel payments and fees.</div>
              </div>
            </div>
            <div className="student-details__loading-grid" aria-hidden="true">
              {Array.from({ length: 3 }).map((_, index) => (
                <div className="student-loader-card" key={`hostel-loader-${index}`}>
                  <div className="student-loader-card__header student-loader__shimmer"></div>
                  <div className="student-loader-card__line student-loader__shimmer"></div>
                  <div className="student-loader-card__line student-loader__shimmer"></div>
                  <div className="student-loader-card__line student-loader__shimmer"></div>
                </div>
              ))}
            </div>
            <span className="sr-only">Loading hostel fees...</span>
          </div>
        )}

        {error && !loading && (
          <div className="student-details__status student-details__status--error">{error}</div>
        )}

        {!loading && !error && studentInfo?.is_hostel && !currentAllocation && (
          <div className="student-details__status">No hostel allocation found.</div>
        )}

        {!loading && !error && currentAllocation && (
          <div className="student-card">
            <div className="student-card__header">Allocation Details</div>
            <div className="student-card__body">
              <div className="student-details-grid">
                <div className="student-details-grid__item">
                  <div className="student-details-grid__label">Academic Year</div>
                  <div className="student-details-grid__value">{currentAllocation.academic_year || 'N/A'}</div>
                </div>
                <div className="student-details-grid__item">
                  <div className="student-details-grid__label">Block</div>
                  <div className="student-details-grid__value">
                    {currentAllocation.hostel_beds?.hostel_rooms?.hostel_blocks?.block_name || 'N/A'}
                  </div>
                </div>
                <div className="student-details-grid__item">
                  <div className="student-details-grid__label">Room</div>
                  <div className="student-details-grid__value">
                    {currentAllocation.hostel_beds?.hostel_rooms?.room_no || 'N/A'}
                  </div>
                </div>
                <div className="student-details-grid__item">
                  <div className="student-details-grid__label">Bed</div>
                  <div className="student-details-grid__value">
                    {currentAllocation.hostel_beds?.bed_no || 'N/A'}
                  </div>
                </div>
                <div className="student-details-grid__item">
                  <div className="student-details-grid__label">Room Type</div>
                  <div className="student-details-grid__value">
                    {currentAllocation.hostel_beds?.hostel_rooms?.room_type?.replace(/_/g, ' ') || 'N/A'}
                  </div>
                </div>
                <div className="student-details-grid__item">
                  <div className="student-details-grid__label">Floor</div>
                  <div className="student-details-grid__value">
                    {formatHostelFloor(currentAllocation.hostel_beds?.hostel_rooms?.floor_no)}
                  </div>
                </div>
                <div className="student-details-grid__item">
                  <div className="student-details-grid__label">Allocated On</div>
                  <div className="student-details-grid__value">
                    {currentAllocation.created_at ? formatDateTime(currentAllocation.created_at) : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </StudentShell>
  )
}
