import { Link } from 'react-router-dom'
import crestPrimary from '../../assets/media/images.png'
import heroTexture from '../../assets/media/EMS.jpg'
import './Home.css'

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
          <div className="home-hero__grid home-hero__grid--single">
            <section className="home-hero__primary">
              <div className="home-hero__crest">
                <img src={crestPrimary} alt="Jazz Public School crest" />
              </div>
              <h1 className="home-hero__title">Jazz Public School</h1>
              <p className="home-hero__subtitle">School Management System</p>
              <p className="home-hero__tagline">
                <span className="home-hero__tagline-text">Choose your portal to continue.</span>
              </p>

              <div className="home-hero__actions home-hero__actions--single">
                <Link to="/roles" className="btn btn-hero-primary home-hero__action-btn home-hero__login-btn">
                  Login
                </Link>
              </div>
            </section>
          </div>
        </div>
      </header>
    </div>
  )
}
