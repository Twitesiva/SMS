const LibraryPreloader = ({
  title = 'Loading library data',
  subtitle = 'Fetching the latest records.',
  statCount = 4,
  panelCount = 2,
  rowCount = 5,
  className = 'desktop-container library-skeleton-page'
}) => {
  const stats = Array.from({ length: Math.max(0, statCount) })
  const panels = Array.from({ length: Math.max(0, panelCount) })
  const rows = Array.from({ length: Math.max(0, rowCount) })

  return (
    <div className={className} role="status" aria-live="polite">
      <div className="library-skeleton">
        <div className="library-skeleton__header">
          <div className="library-skeleton__spinner" aria-hidden="true"></div>
          <div>
            <div className="library-skeleton__title">{title}</div>
            <div className="library-skeleton__subtitle">{subtitle}</div>
          </div>
        </div>

        {statCount > 0 && (
          <div className="library-skeleton__stats" aria-hidden="true">
            {stats.map((_, index) => (
              <div className="library-skeleton__card" key={`library-stat-${index}`}>
                <div className="library-skeleton__line library-skeleton__line--title library-skeleton__shimmer"></div>
                <div className="library-skeleton__line library-skeleton__line--value library-skeleton__shimmer"></div>
                <div className="library-skeleton__line library-skeleton__line--meta library-skeleton__shimmer"></div>
              </div>
            ))}
          </div>
        )}

        {panelCount > 0 && (
          <div className="library-skeleton__panels" aria-hidden="true">
            {panels.map((_, panelIndex) => (
              <div className="library-skeleton__panel" key={`library-panel-${panelIndex}`}>
                <div className="library-skeleton__panel-header">
                  <div className="library-skeleton__line library-skeleton__line--header library-skeleton__shimmer"></div>
                  <div className="library-skeleton__line library-skeleton__line--meta library-skeleton__shimmer"></div>
                </div>
                <div className="library-skeleton__table">
                  {rows.map((_, rowIndex) => (
                    <div className="library-skeleton__table-row" key={`library-row-${panelIndex}-${rowIndex}`}>
                      <div className="library-skeleton__cell library-skeleton__shimmer"></div>
                      <div className="library-skeleton__cell library-skeleton__shimmer"></div>
                      <div className="library-skeleton__cell library-skeleton__shimmer"></div>
                      <div className="library-skeleton__cell library-skeleton__cell--short library-skeleton__shimmer"></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <span className="sr-only">{title}...</span>
    </div>
  )
}

export default LibraryPreloader
