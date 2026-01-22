import { useEffect, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import crest from '../../assets/media/images.png'
import StudentShell from '../../components/StudentShell'
import { useStudentAuth } from '../../store/studentAuth'
import { supabase } from '../../../supabaseClient'
import './Student.css'

export default function StudentCertificate() {
  const { student } = useStudentAuth()
  const certificateRef = useRef(null)
  const [certificateExporting, setCertificateExporting] = useState(false)
  const [studentDetails, setStudentDetails] = useState(null)
  const details = studentDetails || student
  const renderField = (value) =>
    value ? (
      <span className="student-certificate__fill">{value}</span>
    ) : (
      <span className="student-certificate__blank" aria-hidden="true"></span>
    )

  useEffect(() => {
    if (!student?.id && !student?.student_id) return
    const loadDetails = async () => {
      try {
        let query = supabase
          .from('students')
          .select(
            'id, student_id, full_name, father_name, mother_name, course_name, academic_year, current_semester, hall_ticket_no, group_name'
          )
        if (student?.id) {
          query = query.eq('id', student.id)
        } else {
          query = query.eq('student_id', student.student_id)
        }
        const { data, error } = await query.maybeSingle()
        if (error) throw error
        if (data) setStudentDetails(data)
      } catch (err) {
        console.error('Failed to load student details for certificate', err)
      }
    }

    loadDetails()
  }, [student?.id, student?.student_id])

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
      <div className="students-section-shell">
        <div className="student-card mb-4">
          <div className="student-card__header">Bonafide Certificate</div>
          <div className="student-card__body">
            <p className="students-section-copy mb-0">
              View and download your bonafide certificate.
            </p>
          </div>
        </div>

        <div
          className={`student-certificate ${certificateExporting ? 'student-certificate--exporting' : ''
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
                <div>Certificate No: VJY/BC/{details?.student_id || '0000'}</div>
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
              <div className="student-certificate__content">
                <p className="student-certificate__text">
                  This is to certify that Mr./Ms.{' '}
                  {renderField(details?.full_name)}
                  , son/daughter of Mr./Ms.{` `}
                  {renderField(details?.father_name)}
                  , is a bonafide student of{' '}
                  <span className="student-certificate__fill">Vijayam Arts & Science College</span>
                  .
                </p>

                <p className="student-certificate__text">
                  He/She is studying in{' '}
                  {renderField(
                    [details?.course_name || details?.course, details?.group_name]
                      .filter(Boolean)
                      .join(' ')
                  )}{' '}
                  (Course / Department / Year / Semester) during the academic year{' '}
                  {renderField(details?.academic_year)}
                  .
                </p>

                <p className="student-certificate__text">
                  This certificate is issued for the purpose of{' '}
                  <span className="student-certificate__blank" aria-hidden="true"></span>.
                </p>

                <div className="student-certificate__meta-lines">
                  <div className="student-certificate__meta-line">
                    <span>Date:</span>
                    <span className="student-certificate__blank" aria-hidden="true"></span>
                  </div>
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
      </div>
    </StudentShell>
  )
}
