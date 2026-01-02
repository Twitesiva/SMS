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
  },
  {
    title: 'Class Time Table Creation',
    static: true,
    items: [
      {
        to: '/admin-portal/class-time-table-creation',
        label: 'Class Time Table Creation',
        icon: 'bi-calendar-plus'
      }
    ]
  }
]

export default function Department() {
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
            <p className="setup-hero-copy mb-3">Define, organize, and manage academic departments.</p>
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
                  <h4 className="mb-1">Department</h4>
                  <p className="text-muted mb-0">Create and maintain department records.</p>
                </div>
                <button type="button" className="btn btn-outline-secondary">Reset</button>
              </div>

              <form className="row g-3" onSubmit={(event) => event.preventDefault()}>
                <div className="col-md-6">
                  <label className="form-label">Department Name</label>
                  <input className="form-control" type="text" placeholder="Enter department name" />
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
                  <button type="button" className="btn btn-outline-secondary">Add other department</button>
                  <button type="submit" className="btn btn-primary">Create department</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  )
}

