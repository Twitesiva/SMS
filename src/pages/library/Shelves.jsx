import React from 'react'
import crestPrimary from '../../assets/media/images.png'

export default function Shelves() {
  return (
    <div className="desktop-container" style={{ overflowX: 'hidden' }}>
      <section className="setup-hero mb-4 text-center">
        <div className="setup-hero-copywrap mx-auto text-center" style={{ maxWidth: '640px' }}>
          <div className="admin-applications__crest mx-auto" aria-hidden="true">
            <img src={crestPrimary} alt="Vijayam crest" />
          </div>
          <h3 className="setup-hero-title mb-2">Shelf Management</h3>
          <p className="setup-hero-copy mb-3">Organize and track book locations.</p>
        </div>
      </section>
      <div className="text-center p-5 text-muted">
        <i className="bi bi-grid-3x3 gap-2 fs-1"></i>
        <p className="mt-3">Shelf management module coming soon.</p>
      </div>
    </div>
  )
}
