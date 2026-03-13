import { Link } from 'react-router-dom'
import crestPrimary from '../../assets/media/images.png'
import crestAccent from '../../assets/media/EMS2.jpg'
import heroTexture from '../../assets/media/EMS.jpg'
import './Home.css'

const statHighlights = [
  { value: '38+', label: 'UG & PG programmes' },
  { value: '18K+', label: 'Successful alumni' },
]

export default function Home() {
  return (
    <div className="home-shell">
      <Link
        to="/"
        className="home-back-btn"
        style={{
          position: 'absolute',
          top: '2rem',
          left: '2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          textDecoration: 'none',
          color: '#4b5563',
          fontWeight: 600,
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '0.8rem 1.5rem',
          borderRadius: '50px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          zIndex: 20
        }}
      >
        <i className="bi bi-arrow-left"></i> Back to Intro
      </Link>
      <header className="home-hero home-hero--modern">
        <div className="home-hero__bg" aria-hidden="true" style={{ '--hero-photo': `url(${heroTexture})` }} />
        <div className="container">
          <div className="home-hero__grid home-hero__grid--fixed">
            <section className="home-hero__primary">
              <div className="home-hero__crest">
                <img src={crestPrimary} alt="Vijayam crest" />
              </div>
              <h1 className="home-hero__title">Jazz Public School</h1>
              <p className="home-hero__subtitle">School Management System</p>
              <p className="home-hero__tagline">
                <span className="home-hero__tagline-text">Access Student Portal, Results & Timetables.</span>
                <span className="home-hero__tagline-arrow" aria-hidden="true">{'\u2193'}</span>
              </p>

              <div className="home-hero__actions home-hero__actions--triple">
                <Link
                  to="/admission"
                  className="btn btn-hero-primary home-hero__action-btn home-hero__action-btn--apply"
                >
                  Application
                </Link>

                <Link
                  to="/public/timetable"
                  className="btn btn-hero-secondary home-hero__action-btn home-hero__action-btn--timetable"
                >
                  Exam Timetable
                </Link>
              </div>
            </section>

            <aside className="home-hero__control home-hero__control--panel">
              <div className="home-hero__control-badge" aria-hidden="true">
                <img src={crestAccent} alt="Vijayam alternate crest" />
              </div>
              <div className="home-hero__control-header">
                <p className="home-hero__control-label">Exam Control Centre</p>
              </div>
              <div className="home-hero__microcopy">
                <span>Official control room for approvals & schedules</span>
                <span>Coordinated support for principals, staff, and students</span>
              </div>
              <p className="home-hero__control-login-label">Admin login</p>
              <div className="home-hero__stats home-hero__stats--stacked">
                {statHighlights.map((stat) => (
                  <div key={stat.label} className="home-hero__stat">
                    <span className="home-hero__stat-value">{stat.value}</span>
                    <span className="home-hero__stat-label">{stat.label}</span>
                  </div>
                ))}
              </div>
              <div className="home-hero__control-footer">
                <Link to="/roles" className="btn btn-hero-contrast home-hero__login-btn">
                  Login
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </header>
    </div>
  )
}

