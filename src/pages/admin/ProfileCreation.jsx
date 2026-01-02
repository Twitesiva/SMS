import AdminShell from '../../components/AdminShell'
import crestPrimary from '../../assets/media/images.png'

const adminNavGroups = [
  {
    title: 'Student Portal',
    items: [
      {
        to: '/admin-portal/academic-years',
        label: 'Academic Years',
        icon: 'bi-calendar3'
      },
      {
        to: '/admin-portal/groups-courses',
        label: 'Groups & Courses',
        icon: 'bi-diagram-3'
      },
      {
        to: '/admin-portal/subjects',
        label: 'Subjects',
        icon: 'bi-journal-text'
      }
    ]
  },
  {
    title: 'Fees Creation',
    static: true,
    items: [
      {
        to: '/admin-portal/fees-creation',
        label: 'Student Fees Creation',
        icon: 'bi-currency-rupee'
      }
    ]
  },
  {
    title: 'Profile Creation',
    static: true,
    items: [
      {
        to: '/admin-portal/profile-creation',
        label: 'Staff Profile Creation',
        icon: 'bi-person-plus-fill'
      }
    ]
  },
  {
    title: 'Department',
    static: true,
    items: [
      {
        to: '/admin-portal/department',
        label: 'Department',
        icon: 'bi-diagram-3'
      }
    ]
  },
  {
    title: 'Class Time Table',
    static: true,
    items: [
      {
        to: '/admin-portal/class-time-table',
        label: 'Class Time Table',
        icon: 'bi-calendar-date'
      }
    ]
  }
]

export default function ProfileCreation() {
  return (
    <AdminShell
      navGroups={adminNavGroups}
      brandTitle="Admin Management Console"
      brandSubtitle="Chittoor"
      footerTitle="Admin Management Studio"
      footerSubtitle="Crafted for Vijayam College"
    >
      <div className="desktop-container" style={{ overflowX: 'hidden' }}>
        <section className="setup-hero mb-4 text-center">
          <div className="setup-hero-copywrap mx-auto text-center" style={{ maxWidth: '640px' }}>
            <div className="admin-applications__crest mx-auto" aria-hidden="true">
              <img src={crestPrimary} alt="Vijayam crest" />
            </div>
            <h3 className="setup-hero-title mb-2">Vijayam Arts & Science College</h3>
            <p className="setup-hero-copy mb-3">Collect, verify, and onboard applicants with confidence.</p>
            <div className="setup-hero-chips d-flex flex-wrap gap-2 justify-content-center">
              <span className="setup-hero-chip text-uppercase">SMART EXAMINATION PLATFORM</span>
              <span className="setup-hero-chip text-uppercase">ADMISSIONS CONTROL</span>
              <span className="setup-hero-chip text-uppercase">APPLICATIONS ADMIN CONSOLE</span>
            </div>
          </div>
        </section>

        <div className="row g-4 justify-content-center mx-0">
          <div className="col-12">
            <div className="card card-soft p-4">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                <div>
                  <h4 className="mb-1">Profile creation</h4>
                  <p className="text-muted mb-0">Create new staff profiles with academic, contact, and employment details.</p>
                </div>
                <button type="button" className="btn btn-outline-secondary">Reset</button>
              </div>

              <form className="row g-3" onSubmit={(event) => event.preventDefault()}>
                <div className="col-md-6">
                  <label className="form-label">Staff ID</label>
                  <input className="form-control" type="text" placeholder="Enter staff ID" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Full Name</label>
                  <input className="form-control" type="text" placeholder="Enter full name" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Gender</label>
                  <select className="form-select" defaultValue="">
                    <option value="" disabled>Select gender</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">DOB</label>
                  <input className="form-control" type="date" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Phone</label>
                  <input className="form-control" type="tel" placeholder="Enter phone number" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Aadhar no</label>
                  <input className="form-control" type="text" placeholder="Enter Aadhar number" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Email</label>
                  <input className="form-control" type="email" placeholder="name@vijayam.in" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Address</label>
                  <input className="form-control" type="text" placeholder="Enter address" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Designation</label>
                  <input className="form-control" type="text" placeholder="Enter designation" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Qualification</label>
                  <input className="form-control" type="text" placeholder="Enter qualification" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Experience</label>
                  <input className="form-control" type="text" placeholder="Enter experience" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Joining Date</label>
                  <input className="form-control" type="date" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Employment Type</label>
                  <select className="form-select" defaultValue="">
                    <option value="" disabled>Select employment type</option>
                    <option value="FULL_TIME">Full-time</option>
                    <option value="PART_TIME">Part-time</option>
                    <option value="CONTRACT">Contract</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Department</label>
                  <input className="form-control" type="text" placeholder="Enter department" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Status</label>
                  <select className="form-select" defaultValue="">
                    <option value="" disabled>Select status</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
                <div className="col-12 d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-outline-secondary">Save draft</button>
                  <button type="submit" className="btn btn-primary">Create profile</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  )
}

