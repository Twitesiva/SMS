import { useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import crest from '../../assets/media/images.png'
import StudentShell from '../../components/StudentShell'
import { useStudentAuth } from '../../store/studentAuth'

export default function StudentCertificate() {
  const { student } = useStudentAuth()
  const certificateRef = useRef(null)
  const [certificateExporting, setCertificateExporting] = useState(false)

  const handleCertificateDownload = () => {
    const node = certificateRef.current
    if (!node || certificateExporting) return
    const exportCertificate = async () => {
      setCertificateExporting(true)
      try {
        await new Promise((resolve) => setTimeout(resolve, 80))
        const canvas = await html2canvas(node, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
        })
        const imageData = canvas.toDataURL('image/png')
        const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' })
        const pageWidth = pdf.internal.pageSize.getWidth()
        const pageHeight = pdf.internal.pageSize.getHeight()
        const widthScale = pageWidth / canvas.width
        const heightScale = pageHeight / canvas.height
        const scale = Math.min(widthScale, heightScale)
        const imgWidth = canvas.width * scale
        const imgHeight = canvas.height * scale
        const xOffset = (pageWidth - imgWidth) / 2
        const yOffset = (pageHeight - imgHeight) / 2

        pdf.addImage(imageData, 'PNG', xOffset, yOffset, imgWidth, imgHeight)

        const fileId = student?.student_id || 'student'
        pdf.save(`bonafide_${fileId}.pdf`)
      } catch (error) {
        console.error('Failed to export certificate', error)
      } finally {
        setCertificateExporting(false)
      }
    }

    exportCertificate()
  }

  return (
    <StudentShell>
      <div
        className={`student-certificate ${
          certificateExporting ? 'student-certificate--exporting' : ''
        }`}
      >
        <div className="student-certificate__paper" ref={certificateRef}>
          <div className="student-certificate__header">
            <div className="student-certificate__brand">
              <img src={crest} alt="Vijayam crest" className="student-certificate__logo" />
              <div>
                <div className="student-certificate__college">Vijayam Arts & Science College</div>
                <div className="student-certificate__subtitle">Bonafide Certificate</div>
              </div>
            </div>
            <div className="student-certificate__meta">
              <div>Certificate No: VJY/BC/{student?.student_id || '0000'}</div>
              <div>
                Date:{' '}
                {new Date().toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </div>
              <button
                type="button"
                className="student-certificate__download"
                onClick={handleCertificateDownload}
                disabled={certificateExporting}
              >
                {certificateExporting ? 'Preparing PDF...' : 'Download PDF'}
              </button>
            </div>
          </div>

          <div className="student-certificate__title">Bonafide Certificate</div>

          <div className="student-certificate__body">
            <p className="student-certificate__text">
              This is to certify that{' '}
              <span className="student-certificate__highlight">
                {student?.full_name || 'Student Name'}
              </span>{' '}
              (Student ID:{' '}
              <span className="student-certificate__highlight">
                {student?.student_id || '—'}
              </span>
              ) is a bonafide student of Vijayam Arts & Science College. The student is
              enrolled in{' '}
              <span className="student-certificate__highlight">
                {student?.course_name || student?.course || 'Course'}
              </span>{' '}
              {student?.group_name ? `(${student.group_name})` : ''} for the academic year{' '}
              <span className="student-certificate__highlight">
                {student?.academic_year || '—'}
              </span>{' '}
              and is currently studying in{' '}
              <span className="student-certificate__highlight">
                {student?.current_semester
                  ? `Semester ${student.current_semester}`
                  : 'the current semester'}
              </span>
              .
            </p>

            <div className="student-certificate__details">
              <div className="student-certificate__detail">
                <span>Register No.</span>
                <span>{student?.hall_ticket_no || '—'}</span>
              </div>
              <div className="student-certificate__detail">
                <span>Course</span>
                <span>{student?.course_name || student?.course || '—'}</span>
              </div>
              <div className="student-certificate__detail">
                <span>Academic Year</span>
                <span>{student?.academic_year || '—'}</span>
              </div>
              <div className="student-certificate__detail">
                <span>Issued For</span>
                <span>Official purposes</span>
              </div>
              <div className="student-certificate__detail">
                <span>Group</span>
                <span>{student?.group_name || student?.group || '—'}</span>
              </div>
            </div>
          </div>

          <div className="student-certificate__footer">
            <div className="student-certificate__seal">College Seal</div>
            <div className="student-certificate__sign">
              <div className="student-certificate__sign-line"></div>
              <div className="student-certificate__sign-label">Principal</div>
            </div>
          </div>
        </div>
      </div>
    </StudentShell>
  )
}
