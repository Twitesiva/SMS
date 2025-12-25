import { jsPDF } from 'jspdf'
import { Link } from 'react-router-dom'

export default function ApplicationManual() {
  const downloadPdf = () => {
    const doc = new jsPDF()
    let y = 16
    doc.setFontSize(16)
    doc.text('Vijayam Science and Arts Degree College', 12, y); y += 8
    doc.setFontSize(12)
    doc.text('Manual Application Form (Blank)', 12, y); y += 10
    const line = (label) => { doc.text(label, 12, y); doc.line(70, y+1, 200, y+1); y += 10 }
    ;['Student ID','Admission No','HT No','Academic Year','Group','Course Code','Course Name','Full Name','DOB','Gender','Father\'s Name','Mother\'s Name','Mobile','Email','Nationality','State','Aadhar No','Postal Code','Religion','Caste','Sub Caste','Address'].forEach(line)
    doc.save('Application-Form-Blank.pdf')
  }

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-10">
          <div className="card card-soft p-4">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div className="d-flex align-items-center gap-2">
                <img src="/image.png" className="brand-logo" alt="logo" />
                <div><h3 className="fw-bold mb-0">Vijayam College of Arts & Science</h3><div className="text-muted">Chennai</div></div>
              </div>
              <Link to="/" className="btn btn-brand">Back to Home</Link>
            </div>
            <h5 className="mt-1">Application Form</h5>

            <div className="mt-3 d-flex gap-2">
              <button className="btn btn-brand btn-sm" onClick={downloadPdf}>Download Blank PDF</button>
              <button className="btn btn-outline-brand btn-sm" onClick={()=>window.print()}>Print This Page</button>
            </div>

            <div className="row g-3 mt-1">
              <div className="col-12"><h6 className="fw-bold mb-1">Student & Admission</h6><hr className="hr-soft" /></div>
              <div className="col-md-3"><label className="form-label">Student ID</label><input className="form-control" /></div>
              <div className="col-md-3"><label className="form-label">Admission No</label><input className="form-control"  /></div>
              <div className="col-md-3"><label className="form-label">Academic Year</label><input className="form-control" /></div>

              <div className="col-12"><h6 className="fw-bold mb-1">Group & Course</h6><hr className="hr-soft" /></div>
              <div className="col-md-4"><label className="form-label">Group</label><input className="form-control" /></div>
              <div className="col-md-4"><label className="form-label">Course Code</label><input className="form-control"/></div>
              <div className="col-md-4"><label className="form-label">Course Name</label><input className="form-control"  /></div>

              <div className="col-12"><h6 className="fw-bold mb-1">Personal Details</h6><hr className="hr-soft" /></div>
              <div className="col-md-6"><label className="form-label">Full Name</label><input className="form-control" /></div>
              <div className="col-md-3"><label className="form-label">Gender</label><input className="form-control"  /></div>
              <div className="col-md-3"><label className="form-label">DOB</label><input className="form-control"  /></div>
              <div className="col-md-6"><label className="form-label">Father's Name</label><input className="form-control"  /></div>
              <div className="col-md-6"><label className="form-label">Mother's Name</label><input className="form-control" /></div>

              <div className="col-12"><h6 className="fw-bold mb-1">Contact & Address</h6><hr className="hr-soft" /></div>
              <div className="col-md-3"><label className="form-label">Mobile</label><input className="form-control"  /></div>
              <div className="col-md-3"><label className="form-label">Email</label><input className="form-control" /></div>
              <div className="col-md-3"><label className="form-label">Nationality</label><input className="form-control" /></div>
              <div className="col-md-3"><label className="form-label">State</label><input className="form-control" /></div>
              <div className="col-md-4"><label className="form-label">Aadhar No</label><input className="form-control"  /></div>
              <div className="col-md-4"><label className="form-label">Postal Code (PIN)</label><input className="form-control"  /></div>
              <div className="col-md-4"><label className="form-label">Religion</label><input className="form-control" /></div>
              <div className="col-md-4"><label className="form-label">Caste</label><input className="form-control"/></div>
              <div className="col-md-4"><label className="form-label">Sub Caste</label><input className="form-control"/></div>
              <div className="col-12"><label className="form-label">Address</label><textarea className="form-control" rows="2" ></textarea></div>

              <div className="col-12 d-flex justify-content-end gap-2 mt-2">
                <button className="btn btn-outline-secondary" onClick={(e)=>{e.preventDefault(); window.print()}}>Print</button>
                <button className="btn btn-brand" onClick={(e)=>{e.preventDefault(); downloadPdf()}}>Download PDF</button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
