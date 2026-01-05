import { useNavigate } from 'react-router-dom'
import AdminShell from '../../components/AdminShell'
import crestPrimary from '../../assets/media/images.png'

const libraryNavGroups = [
  {
    title: 'Library',
    static: true,
    items: [
      {
        to: '/library',
        label: 'Library Dashboard',
        icon: 'bi-book'
      }
    ]
  }
]

export default function LibraryDashboard() {
  const nav = useNavigate()

  return (
    <AdminShell
      onSignOut={() => {
        nav('/roles')
        return true
      }}
      navGroups={libraryNavGroups}
      brandTitle="Library Management Console"
      brandSubtitle="Vijayam"
      footerTitle="Library Management Studio"
      footerSubtitle="Crafted for Vijayam College"
    >
      <div className="desktop-container" style={{ overflowX: 'hidden' }}>
        <section className="setup-hero mb-4 text-center">
          <div className="setup-hero-copywrap mx-auto text-center" style={{ maxWidth: '640px' }}>
            <div className="admin-applications__crest mx-auto" aria-hidden="true">
              <img src={crestPrimary} alt="Vijayam crest" />
            </div>
            <h3 className="setup-hero-title mb-2">Vijayam Arts & Science College</h3>
            <p className="setup-hero-copy mb-3">Manage catalogues, lending, and returns with confidence.</p>
            <div className="setup-hero-chips d-flex flex-wrap gap-2 justify-content-center">
              <span className="setup-hero-chip text-uppercase">LIBRARY SERVICES</span>
              <span className="setup-hero-chip text-uppercase">CATALOG MANAGEMENT</span>
              <span className="setup-hero-chip text-uppercase">ISSUE & RETURN DESK</span>
            </div>
          </div>
        </section>
      </div>
    </AdminShell>
  )
}
